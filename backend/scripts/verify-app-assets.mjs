import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base='https://bulao-api-staging.codecheck369.workers.dev/api/v1';
const report=JSON.parse(await readFile(new URL('../../output/app-assets/report.json',import.meta.url),'utf8'));
const response=await fetch(`${base}/assets`,{signal:AbortSignal.timeout(20000)});
assert.equal(response.status,200);
const body=await response.json();assert.equal(body.success,true);
for(const expected of report){
  const actual=body.data.assets.find(a=>a.id===expected.id);
  assert.ok(actual);assert.equal(actual.url,expected.url);assert.equal(actual.revision,expected.revision);
  assert.ok(actual.width>0 && actual.height>0);
  const image=await fetch(actual.url,{method:'HEAD',signal:AbortSignal.timeout(20000)});
  assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/^image\//);
  console.log(`Verified registry + CDN: ${actual.id}`);
}
assert.ok(body.data.assets.every(a=>!('userId' in a) && !('ownerId' in a)));
assert.equal((await fetch(`${base}/images/confirm`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId:'invalid'})})).status,401);
assert.equal((await fetch(`${base}/health`)).status,200);
console.log('Public metadata contains no owner records; upload confirmation requires authentication; API health OK.');
