/**
 * Native stub — image preprocessing is a no-op on iOS/Android.
 * The full pipeline lives in imagePreprocess.web.ts.
 */
export async function preprocessImage(imageUri: string): Promise<string> {
  return imageUri;
}
