import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.resolve('backend/node_modules/wrangler/package.json'));
const { build } = require('esbuild');
await build({ entryPoints: ['backend/src/app.ts'], outfile: 'backend/dist/worker.mjs', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:workers'], logLevel: 'warning' });
console.log('Worker local bundle passed (no Wrangler, credentials, deployment or network).');
