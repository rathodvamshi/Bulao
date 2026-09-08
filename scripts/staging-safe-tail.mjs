import { spawn } from 'node:child_process';
import path from 'node:path';
const cli = path.resolve('backend/node_modules/wrangler/bin/wrangler.js');
const child = spawn(process.execPath, [cli, 'tail', '--env', 'staging', '--format', 'json'], { cwd: path.resolve('backend'), stdio: ['ignore', 'pipe', 'pipe'] });
let buffer = '';
function emit(event) {
  for (const entry of event.logs || []) for (const value of entry.message || []) {
    let log; try { log = typeof value === 'string' ? JSON.parse(value) : value; } catch { continue; }
    if (!log || !['AUTH_HASH_CHECK', 'MSG91_DEBUG'].includes(log.event)) continue;
    console.log(JSON.stringify({ event: log.event, requestId: /^[a-f0-9-]{36}$/.test(log.requestId || '') ? log.requestId : undefined,
      present: typeof log.present === 'boolean' ? log.present : undefined, length_ok: typeof log.length_ok === 'boolean' ? log.length_ok : undefined,
      operation: ['send','verify','resend'].includes(log.operation) ? log.operation : undefined,
      status: typeof log.status === 'number' ? log.status : undefined, code: /^PROVIDER_[A-Z_]+$/.test(log.code || '') ? log.code : undefined }));
  }
}
child.stdout.on('data', data => {
  buffer += data.toString();
  while (true) {
    const start = buffer.indexOf('{'); if (start < 0) { buffer = ''; return; }
    let depth = 0, quoted = false, escaped = false, end = -1;
    for (let i = start; i < buffer.length; i++) {
      const c = buffer[i]; if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
      else if (c === '"') quoted = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { end = i; break; }
    }
    if (end < 0) return;
    const raw = buffer.slice(start, end + 1); buffer = buffer.slice(end + 1);
    try { emit(JSON.parse(raw)); } catch {}
  }
});
child.stderr.on('data', () => {});
child.on('exit', code => { console.log(JSON.stringify({ event: 'STAGING_TAIL_ENDED', code })); process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill());
console.log('Starting staging-only tail; output restricted to safe diagnostic fields.');
