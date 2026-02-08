#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const PORT = process.env.PORT || '3000';
const HOST = process.env.HOST || 'localhost';

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
console.log('    PORT=8080 npx local-ai-chat-frontend');
console.log('    HOST=0.0.0.0 PORT=3000 npx local-ai-chat-frontend  (LAN access)');
console.log('');

const sirv = spawn(
  'npx',
  ['sirv-cli', distDir, '--port', PORT, '--host', HOST, '--single', '--cors', '--dev'],
  { stdio: 'inherit', shell: true }
);

sirv.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n  Shutting down...');
  sirv.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  sirv.kill('SIGTERM');
  process.exit(0);
});
