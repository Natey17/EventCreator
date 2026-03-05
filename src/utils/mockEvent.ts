import { ImportedEvent } from '../types';
import { TEST_MODE } from '../config';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/** Returns a plausible future date string (7 days from now) as YYYY-MM-DD */
function futureDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

/**
 * Generates a draft ImportedEvent from a picked image.
 * When TEST_MODE is false, fields are empty so the user fills them manually.
 */
export function createEventDraft(imageUri: string, imageName?: string): ImportedEvent {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    title: TEST_MODE ? 'Untitled Event' : '',
    date: TEST_MODE ? futureDateString() : '',
    startTime: TEST_MODE ? '18:00' : '',
    endTime: TEST_MODE ? '20:00' : '',
    location: TEST_MODE ? '(Detected location)' : '',
    notes: TEST_MODE ? '(Detected notes)' : '',
    imageUri,
    imageName,
  };
}
