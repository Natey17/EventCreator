/**
 * Native implementation — reads a local file URI as a base64 data URI.
 * Uses expo-file-system which is available in managed/bare Expo workflows.
 */
import * as FileSystem from 'expo-file-system';

export async function imageUriToBase64(uri: string): Promise<string> {
  // Already a data URI — return as-is.
  if (uri.startsWith('data:')) return uri;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Guess MIME type from the file extension.
  const ext  = uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
  const mime = ext === 'png' ? 'image/png'
             : ext === 'gif' ? 'image/gif'
             : 'image/jpeg';

  return `data:${mime};base64,${base64}`;
}
