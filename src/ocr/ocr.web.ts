/**
 * Web OCR — Tesseract.js v5 with image preprocessing and a multi-pass strategy.
 *
 * Strategy
 * ────────
 *   1. Pre-process  — grayscale + contrast + sharpen via Canvas API.
 *   2. OCR pass 1   — PSM 11 (sparse text): best for scattered poster/flyer text.
 *   3. OCR pass 2   — PSM  3 (auto):        general-purpose fallback.
 *   4. Select best  — scored by (confidence × log(1 + wordCount)) so we balance
 *                     recognition accuracy against text coverage.
 *
 * Worker / core / lang files are served from CDN so Metro never bundles the
 * large WASM binary or Web Worker script.  Language data is cached in IndexedDB
 * by Tesseract.js after the first run.
 */
import { createWorker, OEM, PSM } from 'tesseract.js';
import { preprocessImage } from './imagePreprocess';

export const OCR_SUPPORTED = true;

export type OcrProgress = {
  status: string;
  progress: number; // 0–1
};

export type OcrResult = {
  rawText: string;
  confidence: number; // 0–100
};

// Pin to the same major version as the installed package so CDN files match.
const T_VERSION = '5';
const WORKER_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${T_VERSION}/dist/worker.min.js`;
const LANG_URL   = 'https://tessdata.projectnaptha.com/4.0.0';
const CORE_URL   = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${T_VERSION}/tesseract-core-simd-lstm.wasm.js`;

export async function runOcr(
  imageUri: string,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {

  // ── 1. Preprocess ───────────────────────────────────────────────────────────
  onProgress?.({ status: 'Preprocessing image…', progress: 0 });
  let processedUri = imageUri;
  try {
    processedUri = await preprocessImage(imageUri);
  } catch {
    // Fall through with the raw URI — OCR still works, just less accurate.
  }

  // ── 2. Multi-pass OCR ───────────────────────────────────────────────────────
  // opIdx drives the progress calculation:
  //   0 → worker init + language loading  (maps to overall 0–33 %)
  //   1 → pass 1 recognition              (maps to overall 33–67 %)
  //   2 → pass 2 recognition              (maps to overall 67–100 %)
  let opIdx = 0;

  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: WORKER_URL,
    langPath:   LANG_URL,
    corePath:   CORE_URL,
    logger: (m: { status: string; progress: number }) => {
      const progress = (opIdx + (m.progress ?? 0)) / 3;
      onProgress?.({ status: m.status, progress: Math.min(0.99, progress) });
    },
  });

  type PassResult = { text: string; confidence: number };
  let r1: PassResult = { text: '', confidence: 0 };
  let r2: PassResult = { text: '', confidence: 0 };

  try {
    // Pass 1: sparse-text — finds text wherever it is on the page regardless of
    // layout order; ideal for posters where headlines, dates, and addresses are
    // scattered across the image.
    opIdx = 1;
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const res1 = await worker.recognize(processedUri);
    r1 = { text: res1.data.text ?? '', confidence: res1.data.confidence ?? 0 };

    // Pass 2: auto — Tesseract attempts to infer page layout itself; often
    // returns higher confidence on images with more structured layouts.
    opIdx = 2;
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const res2 = await worker.recognize(processedUri);
    r2 = { text: res2.data.text ?? '', confidence: res2.data.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }

  // ── 3. Pick the better result ───────────────────────────────────────────────
  // Score = confidence × log(1 + wordCount).
  // log dampens the effect of raw word count so a highly-confident shorter
  // result can beat a low-confidence verbose one.
  const score = ({ text, confidence }: PassResult) =>
    confidence * Math.log1p(text.split(/\s+/).filter(Boolean).length);

  const best = score(r1) >= score(r2) ? r1 : r2;

  onProgress?.({ status: 'Done', progress: 1 });

  return {
    rawText:    best.text,
    confidence: best.confidence,
  };
}
