import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
const root=path.resolve('mobile/dist');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,`.${pathname}`);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}try{if(!(await stat(file)).isFile())file=path.join(root,'index.html');}catch{file=path.join(root,'index.html');}res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(500).end('Preview unavailable');}}).listen(8081,'127.0.0.1',()=>console.log('Bulao preview: http://localhost:8081'));
