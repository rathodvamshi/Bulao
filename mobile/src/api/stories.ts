import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './client';

export type StoryScene = {
  id: string; label: string; url: string; width: number; height: number;
  sortOrder: number; fit: 'contain' | 'cover'; scale: number; offset: number;
};
export type StoryCollection = { collection: string; revision: string; scenes: StoryScene[] };
export type StoryId = 'hire-someone' | 'request-service';
const cacheKey = (id: StoryId) => `app-stories:v1:${id}`;
const pending = new Map<StoryId, Promise<StoryCollection>>();

export function validStory(value: unknown, id: StoryId): value is StoryCollection {
  const v = value as StoryCollection | null;
  if (!v || v.collection !== id || typeof v.revision !== 'string' || !v.revision || !Array.isArray(v.scenes) || !v.scenes.length || v.scenes.length > 50) return false;
  const ids = new Set<string>();
  return v.scenes.every((s,i) => {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || typeof s.label !== 'string' || s.sortOrder !== i) return false;
    ids.add(s.id);
    return typeof s.url === 'string' && /^https:\/\/res\.cloudinary\.com\/japfuiuz\/image\/upload\//.test(s.url)
      && Number.isFinite(s.width) && s.width > 0 && Number.isFinite(s.height) && s.height > 0
      && ['contain','cover'].includes(s.fit) && Number.isFinite(s.scale) && s.scale >= 0.5 && s.scale <= 2
      && Number.isFinite(s.offset) && s.offset >= 0 && s.offset <= 1;
  });
}
export async function cachedStory(id: StoryId): Promise<StoryCollection | null> {
  try {
    const text = await AsyncStorage.getItem(cacheKey(id));
    const value: unknown = text ? JSON.parse(text) : null;
    return validStory(value,id) ? value : null;
  } catch { return null; }
}
export function fetchStory(id: StoryId): Promise<StoryCollection> {
  const existing = pending.get(id);
  if (existing) return existing;
  const task = (async () => {
    const value = await api<unknown>(`/stories/${id}`);
    if (!validStory(value,id)) throw new Error('Invalid story collection');
    await AsyncStorage.setItem(cacheKey(id),JSON.stringify(value)).catch(()=>{});
    return value;
  })();
  pending.set(id, task);
  void task.finally(()=>pending.delete(id)).catch(()=>{});
  return task;
}
