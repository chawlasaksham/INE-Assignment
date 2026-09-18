#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '../backend');
const scriptPath = path.join(backendDir, 'scripts/runHeaded.js');
const args = [scriptPath, ...process.argv.slice(2)];

const child = spawn('node', args, {
  cwd: backendDir,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

