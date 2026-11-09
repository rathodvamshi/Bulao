// One-step operator workflow: upload -> verify CDN -> register in current D1.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = fileURLToPath(new URL('../../',import.meta.url));
const args = process.argv.slice(2);
const option = name => { const index=args.indexOf(name); return index<0 ? undefined : args[index+1]; };
const manifestPath = new URL('./app-assets.json',import.meta.url);
const assets = JSON.parse(await readFile(manifestPath,'utf8'));
const id = option('--id');
if (id) {
  const file = option('--file');
  if (!file) throw new Error('--file is required with --id');
  const entry = {id,group:option('--group') ?? 'screens',file,maxWidth:Number(option('--width') ?? 1080)};
  const index = assets.findIndex(a=>a.id===id);
  if(index<0) assets.push(entry); else assets[index]=entry;
}
const config = JSON.parse(await readFile(path.join(root,'backend/secrets.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));
const cloud = process.env.CLOUDINARY_CLOUD_NAME ?? config.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY ?? config.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET ?? config.CLOUDINARY_API_SECRET;
if(!cloud || !key || !secret) throw new Error('Cloudinary credentials are required');
const quote = s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=[]; const report=[];
for(const a of assets.filter(a=>!id || a.id===id)) {
  if(!/^[a-z0-9-]+$/.test(a.id) || !/^[a-z0-9-]+$/.test(a.group) || !Number.isInteger(a.maxWidth) || a.maxWidth<64 || a.maxWidth>2048) throw new Error('Invalid asset metadata');
  const filePath=path.resolve(root,a.file);
  if(!filePath.startsWith(path.join(root,'mobile/assets/images')+path.sep)) throw new Error('Source must be inside mobile/assets/images');
  const format=path.extname(filePath).slice(1).toLowerCase();
  if(!['png','jpg','jpeg','webp'].includes(format)) throw new Error('Use PNG, JPEG or WebP');
  const bytes=await readFile(filePath);
  const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
  const publicId=`bulao/app-assets/${a.group}/${a.id}-${hash}`;
  const fields={public_id:publicId,overwrite:'false',timestamp:String(Math.floor(Date.now()/1000))};
  const signature=createHash('sha1').update(Object.keys(fields).sort().map(k=>`${k}=${fields[k]}`).join('&')+secret).digest('hex');
  const form=new FormData();
  for(const [k,v] of Object.entries({...fields,api_key:key,signature})) form.set(k,v);
  form.set('file',new Blob([bytes],{type:`image/${format==='jpg'?'jpeg':format}`}),path.basename(filePath));
  const response=await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`,{method:'POST',body:form,signal:AbortSignal.timeout(120000),redirect:'error'});
  if(!response.ok) throw new Error(`Upload failed (${response.status}) for ${a.id}`);
  const uploaded=await response.json();
  if(uploaded.public_id!==publicId || !uploaded.version || !uploaded.width || !uploaded.height || !uploaded.bytes || !['png','jpg','jpeg','webp'].includes(uploaded.format)) throw new Error('Invalid image response');
  const url=`https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_${a.maxWidth},q_auto,f_auto/v${uploaded.version}/${publicId}.${uploaded.format}`;
  const check=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(60000)});
  if(!check.ok || !check.headers.get('content-type')?.startsWith('image/')) throw new Error(`Delivery failed for ${a.id}`);
  const revision=`${hash}-${a.maxWidth}`;
  sql.push(`INSERT INTO app_assets(id,group_name,public_id,url,width,height,bytes,revision,updated_at) VALUES(${[a.id,a.group,publicId,url,uploaded.width,uploaded.height,uploaded.bytes,revision].map(quote).join(',')},unixepoch()) ON CONFLICT(id) DO UPDATE SET group_name=excluded.group_name,public_id=excluded.public_id,url=excluded.url,width=excluded.width,height=excluded.height,bytes=excluded.bytes,revision=excluded.revision,updated_at=excluded.updated_at;`);
  report.push({id:a.id,url,revision});
  console.log(`Verified ${a.id}`);
}
const output=path.join(root,'output/app-assets'); await mkdir(output,{recursive:true});
const sqlFile=path.join(output,'publish.sql');
await writeFile(sqlFile,sql.join('\n')+'\n');
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const wrangler=path.join(root,'backend/node_modules/wrangler/bin/wrangler.js');
if(!args.includes('--prepare-only')) {
  const result=spawnSync(process.execPath,[wrangler,'d1','execute','DB','--remote','--env','staging','--file',sqlFile],{cwd:path.join(root,'backend'),stdio:'inherit',env:{...process.env,WRANGLER_LOG_PATH:path.join(root,'output/wrangler-assets.log')}});
  if(result.status!==0) throw new Error('D1 registration failed; rerun safely to finish');
}
if(id) await writeFile(manifestPath,JSON.stringify(assets,null,2)+'\n');
console.log(args.includes('--prepare-only')?'Prepared SQL; not published':'Published image metadata to staging D1');
