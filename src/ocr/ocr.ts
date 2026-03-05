/**
 * Native (iOS / Android) OCR stub.
 * Tesseract.js relies on Web Workers + WASM which aren't available in the
 * React Native JS engine (Hermes).  Native OCR can be added here later
 * (e.g. via expo-camera text recognition or react-native-mlkit-ocr).
 */

export const OCR_SUPPORTED = false;

export type OcrProgress = {
  status: string;
  progress: number; // 0–1
};

export type OcrResult = {
  rawText: string;
  confidence: number; // 0–100
};

export async function runOcr(
  _imageUri: string,
  _onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  // Not implemented on native — caller checks OCR_SUPPORTED before calling.
  return { rawText: '', confidence: 0 };
}
