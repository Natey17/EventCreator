/**
 * Web implementation — converts a blob URL or data URI to a base64 data URI
 * using the Fetch API + FileReader (no native modules required).
 */
export async function imageUriToBase64(uri: string): Promise<string> {
  // Already a data URI — return as-is.
  if (uri.startsWith('data:')) return uri;

  const response = await fetch(uri);
  const blob     = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader    = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = () => reject(new Error('FileReader failed to read image'));
    reader.readAsDataURL(blob); // → "data:image/jpeg;base64,..."
  });
}
