// Web implementation — uses a hidden <input type="file"> to open the OS file picker.
export type PickedFile = {
  uri: string;
  name: string;
};

export async function pickImage(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({ uri, name: file.name });
    };

    // Fallback: if the dialog is dismissed without a file
    input.addEventListener('cancel', () => resolve(null));

    input.click();
  });
}
