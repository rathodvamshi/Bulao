import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = 'https://bulao-api-staging.codecheck369.workers.dev/api/v1';
const report = JSON.parse(await readFile(new URL('../../output/story-images/upload-report.json',import.meta.url),'utf8'));
for (const published of report) {
  const response = await fetch(`${base}/stories/${published.collection}`,{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'public, max-age=300');
  const body = await response.json();
  assert.equal(body.success,true);
  assert.equal(body.data.revision,published.revision);
  assert.equal(body.data.scenes.length,published.scenes.length);
  for (const [i,scene] of body.data.scenes.entries()) {
    assert.equal(scene.sortOrder,i);
    assert.equal(scene.id,published.scenes[i].id);
    assert.equal(scene.url,published.scenes[i].url);
    const image = await fetch(scene.url,{method:'HEAD',signal:AbortSignal.timeout(20000)});
    assert.equal(image.status,200);
    assert.match(image.headers.get('content-type'),/^image\//);
  }
  console.log(`${published.collection}: ${body.data.scenes.length} ordered records and CDN images verified; revision ${published.revision}`);
}
assert.equal((await fetch(`${base}/stories/unknown`)).status,404);
assert.equal((await fetch(`${base}/health`)).status,200);
console.log('Unknown collection rejected; existing API health OK.');
