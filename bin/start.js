#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { isIP } from 'net';
import { createRequire } from 'module';
import sirv from 'sirv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

// Validate environment variables before use (exit before starting on invalid values)
const PORT = process.env.PORT || '3000';
const HOST = process.env.HOST || 'localhost';
const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

if (!/^\d{1,5}$/.test(PORT) || Number(PORT) < 1 || Number(PORT) > 65535) {
  console.error(`Invalid PORT: ${JSON.stringify(PORT)} (expected 1-65535)`);
  process.exit(1);
}
if (!isIP(HOST) && !HOSTNAME.test(HOST)) {
  console.error(`Invalid HOST: ${JSON.stringify(HOST)} (expected a hostname or IP address)`);
  process.exit(1);
}

if (!existsSync(join(distDir, 'index.html'))) {
  console.log('  dist/ not found, building (first run)...');
  // Run the bundled vite package directly with node, without a shell
  const require = createRequire(import.meta.url);
  const viteBin = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
  const build = spawnSync(process.execPath, [viteBin, 'build'], { cwd: rootDir, stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('Build failed.');
    process.exit(build.status || 1);
  }
}

console.log('');
console.log('  local-ai-chat-frontend');
console.log('  ====================================');
console.log(`  Server: http://${HOST}:${PORT}`);
console.log('');
console.log('  Recommended LLM provider ports:');
console.log('    Ollama:    http://localhost:11434');
console.log('    GPT4ALL:   http://localhost:4891');
console.log('    LM Studio: http://localhost:1234');
console.log('');
console.log('  Tip: Customize with environment variables');
console.log('    PORT=8080 npx https://github.com/hidao80/local-ai-chat-frontend');
console.log('    HOST=0.0.0.0 PORT=3000 npx https://github.com/hidao80/local-ai-chat-frontend  (LAN access)');
console.log('');

// Add security headers to every response (same values as nginx.conf)
const securityHeaders = JSON.parse(
  readFileSync(join(__dirname, 'security-headers.json'), 'utf8')
);
// single: unknown paths return index.html because this is an SPA
const serve = sirv(distDir, { single: true, etag: true });

const server = createServer((req, res) => {
  for (const [name, value] of Object.entries(securityHeaders)) {
    res.setHeader(name, value);
  }
  serve(req, res, () => {
    res.statusCode = 404;
    res.end('Not Found');
  });
});

server.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

server.listen(Number(PORT), HOST);

const shutdown = () => {
  console.log('\n  Shutting down...');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
