export type ImportedEvent = {
  id: string;
  createdAt: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  location: string;
  notes: string;
  imageUri: string;
  imageName?: string;
};
