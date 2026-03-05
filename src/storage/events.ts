import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImportedEvent } from '../types';

const EVENTS_KEY = '@event_importer_events';

export async function getEvents(): Promise<ImportedEvent[]> {
  try {
    const data = await AsyncStorage.getItem(EVENTS_KEY);
    return data ? (JSON.parse(data) as ImportedEvent[]) : [];
  } catch {
    return [];
  }
}

export async function addEvent(event: ImportedEvent): Promise<void> {
  const events = await getEvents();
  events.unshift(event);
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export async function clearEvents(): Promise<void> {
  await AsyncStorage.removeItem(EVENTS_KEY);
}
