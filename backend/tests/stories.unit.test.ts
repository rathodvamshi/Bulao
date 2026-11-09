import { afterEach, expect, it, vi } from 'vitest';
import { preloadNextStoryImage } from '../../mobile/src/utils/storyImageLoading';
import { stories } from '../src/modules/images/stories';
import { ApiError } from '../src/middleware/errors';

stories.onError((e,c)=>c.json({error: e instanceof ApiError ? e.code : 'INTERNAL'}, e instanceof ApiError ? e.status : 500));
afterEach(()=>vi.useRealTimers());

it('preloads only one next image after allowing the current image to appear',async()=>{
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue(true);
  const ready = vi.fn();
  preloadNextStoryImage('next.jpg',load,ready);
  await vi.advanceTimersByTimeAsync(499);
  expect(load).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledExactlyOnceWith('next.jpg');
  expect(ready).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(20000);
  expect(load).toHaveBeenCalledTimes(1);
});
it('does not mark failed images ready and limits retries',async()=>{
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue(false);
  const ready = vi.fn();
  preloadNextStoryImage('next.jpg',load,ready);
  await vi.advanceTimersByTimeAsync(20000);
  expect(load).toHaveBeenCalledTimes(2);
  expect(ready).not.toHaveBeenCalled();
});
it('cancels pending work when paused or hidden',async()=>{
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue(true);
  const cancel = preloadNextStoryImage('next.jpg',load,vi.fn());
  cancel();
  await vi.advanceTimersByTimeAsync(20000);
  expect(load).not.toHaveBeenCalled();
});
it('ignores a late download completion after navigation',async()=>{
  vi.useFakeTimers();
  let complete!: (ready:boolean)=>void;
  const load = vi.fn(()=>new Promise<boolean>(resolve=>{complete=resolve;}));
  const ready = vi.fn();
  const cancel = preloadNextStoryImage('next.jpg',load,ready);
  await vi.advanceTimersByTimeAsync(500);
  cancel();
  complete(true);
  await vi.advanceTimersByTimeAsync(10000);
  expect(ready).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledTimes(1);
});
function database(rows: unknown[]) {
  const all = vi.fn().mockResolvedValue({results:rows});
  const bind = vi.fn().mockReturnValue({all});
  const prepare = vi.fn().mockReturnValue({bind});
  return { DB:{prepare},prepare,bind };
}
it('rejects unknown collections without querying the database',async()=>{
  const env = database([]);
  const response = await stories.request('/private-photos',{},env);
  expect(response.status).toBe(404);
  expect(env.prepare).not.toHaveBeenCalled();
});
it('returns only the active ordered revision with public cache headers',async()=>{
  const scenes = [{id:'first',revision:'abc',sortOrder:0},{id:'second',revision:'abc',sortOrder:1}];
  const env = database(scenes);
  const response = await stories.request('/hire-someone',{},env);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  expect((await response.json()).data).toEqual({collection:'hire-someone',revision:'abc',scenes});
  expect(env.bind).toHaveBeenCalledWith('hire-someone');
  expect(env.prepare.mock.calls[0][0]).toContain('c.active_revision = i.revision');
  expect(env.prepare.mock.calls[0][0]).toContain('ORDER BY i.sort_order');
});
it('returns 404 for an unpublished collection',async()=>{
  const response = await stories.request('/request-service',{},database([]));
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toBeNull();
});
