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
  // Google Calendar fields — present when the event was successfully created in GCal
  googleEventId?: string;
  googleCalendarId?: string;
  googleHtmlLink?: string;
  importedAt?: string;  // ISO timestamp of successful GCal import
};
