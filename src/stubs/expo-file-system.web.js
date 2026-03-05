/**
 * Web stub for expo-file-system.
 * The native module registration in expo-file-system 18.0.x is broken on web.
 * This stub prevents the registerWebModule crash and satisfies any callers
 * (e.g. expo-asset) that conditionally use the file system on web.
 */

export const EncodingType = { Base64: 'base64', UTF8: 'utf8' };
export const FileSystemSessionType = { BACKGROUND: 0, FOREGROUND: 1 };
export const FileSystemUploadType = { BINARY_CONTENT: 0, MULTIPART: 1 };

export const documentDirectory = null;
export const cacheDirectory = null;
export const bundleDirectory = null;

export async function getInfoAsync() {
  return { exists: false, isDirectory: false, uri: '', size: 0, modificationTime: 0 };
}
export async function readAsStringAsync() { return ''; }
export async function writeAsStringAsync() {}
export async function deleteAsync() {}
export async function moveAsync() {}
export async function copyAsync() {}
export async function makeDirectoryAsync() {}
export async function readDirectoryAsync() { return []; }
export async function downloadAsync() { return { uri: '', status: 0, headers: {}, md5: '' }; }
export async function uploadAsync() { return { body: '', headers: {}, status: 0 }; }
export async function createDownloadResumable() { return null; }
export async function createUploadTask() { return null; }

export default {
  EncodingType,
  documentDirectory,
  cacheDirectory,
  bundleDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  moveAsync,
  copyAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  downloadAsync,
  uploadAsync,
};
