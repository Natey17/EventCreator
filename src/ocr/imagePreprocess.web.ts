/**
 * Web image preprocessing pipeline using the Canvas API.
 *
 * Pipeline applied before Tesseract OCR:
 *   1. Optional upscale  — small images (< 1 000 px on longest side) are scaled
 *      up to ≈ 1 200 px so Tesseract has enough resolution to read the text.
 *   2. Grayscale + contrast  — converts to luminosity-weighted greyscale, then
 *      stretches pixel values away from the midpoint (factor 1.4) to maximise
 *      separation between text and background.
 *   3. Sharpening  — applies a 3 × 3 unsharp kernel so character edges are
 *      crisper going into the recognition engine.
 *
 * If anything fails the original URI is returned unchanged.
 */

/** Returns a preprocessed PNG data URL, or the original URI on failure. */
export async function preprocessImage(imageUri: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const img = document.createElement('img') as HTMLImageElement;

    img.onload = () => {
      try {
        // ── 1. Compute target dimensions (upscale small images, cap large ones) ──
        const MIN_SIDE = 1_000;
        const MAX_SIDE = 2_500;
        const longSide = Math.max(img.naturalWidth, img.naturalHeight);
        const scale =
          longSide < MIN_SIDE
            ? Math.min(2, MIN_SIDE / longSide)
            : longSide > MAX_SIDE
              ? MAX_SIDE / longSide
              : 1;

        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(imageUri); return; }

        ctx.drawImage(img, 0, 0, w, h);

        // ── 2. Grayscale + contrast ───────────────────────────────────────────
        const imageData = ctx.getImageData(0, 0, w, h);
        applyGrayscaleContrast(imageData.data, 1.4);
        ctx.putImageData(imageData, 0, 0);

        // ── 3. Sharpening ─────────────────────────────────────────────────────
        const sharpened = applySharpen(ctx, w, h);
        ctx.putImageData(sharpened, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageUri);
      }
    };

    img.onerror = () => resolve(imageUri);

    // blob: and data: URIs are same-origin; setting crossOrigin would taint the
    // canvas and make toDataURL() throw a SecurityError.
    if (!imageUri.startsWith('blob:') && !imageUri.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.src = imageUri;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert pixel data to luminosity-weighted greyscale then stretch contrast
 * around the midpoint (128).  factor > 1 increases contrast.
 */
function applyGrayscaleContrast(data: Uint8ClampedArray, factor: number): void {
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luminance weights
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast stretch: pull values away from 128
    const adjusted = Math.min(255, Math.max(0, (g - 128) * factor + 128));
    data[i] = data[i + 1] = data[i + 2] = adjusted;
    // Alpha left unchanged (data[i + 3])
  }
}

/**
 * Apply a 3 × 3 unsharp-sharpening kernel.
 * Kernel:  [ 0 -1  0 ]
 *          [-1  5 -1 ]   (sum = 1 → identity-preserving)
 *          [ 0 -1  0 ]
 */
function applySharpen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): ImageData {
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = ctx.createImageData(w, h);
  const d = out.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;

      // Border pixels: copy unchanged
      if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
        d[i] = src[i];
        d[i + 1] = src[i + 1];
        d[i + 2] = src[i + 2];
        d[i + 3] = src[i + 3];
        continue;
      }

      // Apply kernel to each colour channel
      for (let c = 0; c < 3; c++) {
        d[i + c] = Math.min(
          255,
          Math.max(
            0,
            5 * src[i + c]
              - src[((y - 1) * w + x) * 4 + c]
              - src[((y + 1) * w + x) * 4 + c]
              - src[(y * w + (x - 1)) * 4 + c]
              - src[(y * w + (x + 1)) * 4 + c],
          ),
        );
      }
      d[i + 3] = 255;
    }
  }

  return out;
}
