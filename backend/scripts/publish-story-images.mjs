// Upload originals to the existing Cloudinary account, then generate a D1 seed.
// No database writes are performed by this script. Review/apply the generated SQL.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'backend/secrets.json'), 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '{}';
  throw error;
}));
const cloud = process.env.CLOUDINARY_CLOUD_NAME || config.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY || config.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET || config.CLOUDINARY_API_SECRET;
if (!cloud || !key || !secret) throw new Error('Cloudinary credentials are missing');
const collections = JSON.parse(await readFile(new URL('./story-images.json', import.meta.url), 'utf8'));
for (const c of collections) {
  if (!['hire-someone','request-service'].includes(c.id) || !Array.isArray(c.scenes) || !c.scenes.length || c.scenes.length > 50) throw new Error('Invalid collection manifest');
  const ids = new Set();
  for (const [i,s] of c.scenes.entries()) {
    if (!/^[a-z0-9-]+$/.test(s.id) || ids.has(s.id) || s.sortOrder !== i || typeof s.label !== 'string' || !s.label || !['contain','cover'].includes(s.fit) || !Number.isFinite(s.scale) || s.scale < 0.5 || s.scale > 2 || !Number.isFinite(s.offset) || s.offset < 0 || s.offset > 1) throw new Error('Invalid scene manifest');
    ids.add(s.id);
    const allowed = path.join(root,'mobile/assets/images/provider') + path.sep;
    if (!path.resolve(root,s.file).startsWith(allowed)) throw new Error('Scene source must be inside provider image assets');
  }
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const sql = [];
const report = [];
for (const collection of collections) {
  const assets = [];
  for (const scene of collection.scenes) {
    const file = await readFile(path.join(root, scene.file));
    const hash = createHash('sha256').update(file).digest('hex').slice(0, 16);
    const publicId = `bulao/app-stories/${collection.id}/${scene.id}-${hash}`;
    const fields = { public_id: publicId, overwrite: 'false', timestamp: String(Math.floor(Date.now()/1000)) };
    const signature = createHash('sha1').update(Object.keys(fields).sort().map(k=>`${k}=${fields[k]}`).join('&')+secret).digest('hex');
    const form = new FormData();
    for (const [k,v] of Object.entries({...fields, api_key:key, signature})) form.set(k,v);
    form.set('file', new Blob([file], {type:'image/png'}), `${scene.id}.png`);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {method:'POST', body:form, signal:AbortSignal.timeout(120000), redirect:'error'});
    if (!response.ok) throw new Error(`Cloudinary upload failed (${response.status}) for ${scene.id}`);
    const asset = await response.json();
    if (asset.public_id !== publicId || !asset.width || !asset.height || !asset.version || !asset.bytes || !['png','jpg','webp'].includes(asset.format)) throw new Error(`Invalid upload response for ${scene.id}`);
    const url = `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1122,q_auto,f_auto/v${asset.version}/${publicId}.${asset.format}`;
    // Check delivery before publishing any database pointer.
    const check = await fetch(url, {method:'HEAD', signal:AbortSignal.timeout(60000)});
    if (!check.ok || !check.headers.get('content-type')?.startsWith('image/')) throw new Error(`Image delivery failed for ${scene.id}`);
    assets.push({...scene, publicId, url, width:asset.width, height:asset.height, bytes:asset.bytes});
    console.log(`Verified ${collection.id}/${scene.id}`);
  }
  const revision = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0,16);
  for (const a of assets) {
    sql.push(`INSERT OR IGNORE INTO story_images (collection_id,revision,id,sort_order,label,public_id,url,width,height,bytes,fit,scale,offset) VALUES (${[collection.id,revision,a.id,a.sortOrder,a.label,a.publicId,a.url,a.width,a.height,a.bytes,a.fit,a.scale,a.offset].map(quote).join(',')});`);
  }
  // Last statement activates only after every row in the revision exists.
  sql.push(`INSERT INTO story_collections (id,active_revision,updated_at) SELECT ${quote(collection.id)},${quote(revision)},unixepoch() WHERE (SELECT count(*) FROM story_images WHERE collection_id=${quote(collection.id)} AND revision=${quote(revision)})=${assets.length} ON CONFLICT(id) DO UPDATE SET active_revision=excluded.active_revision,updated_at=excluded.updated_at;`);
  report.push({collection:collection.id,revision,scenes:assets});
}
await mkdir(path.join(root,'output/story-images'),{recursive:true});
await writeFile(path.join(root,'output/story-images/publish.sql'),sql.join('\n')+'\n');
await writeFile(path.join(root,'output/story-images/upload-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('All images verified. SQL ready: output/story-images/publish.sql');
