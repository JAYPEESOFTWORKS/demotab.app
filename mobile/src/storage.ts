import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Project } from './types';

const KEY = 'storydraft/projects/v1';

export async function loadProjects(): Promise<Project[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Project[];
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function saveProjects(projects: Project[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(projects));
  } catch {
    // Persistence is best-effort; the in-memory copy remains authoritative.
  }
}
