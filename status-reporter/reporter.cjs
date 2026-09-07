const { execFile } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const configPath = process.argv[2];
if (!configPath) throw new Error('Missing reporter configuration path.');
const config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
const endpoint = `${config.siteUrl.replace(/\/+$/, '')}/api/status`;
const probe = join(__dirname, 'media-probe.ps1');

function run(file, args) {
  return new Promise((resolve) => execFile(file, args, { windowsHide: true, timeout: 10000, encoding: 'utf8' }, (error, stdout) => resolve(error ? '' : stdout.trim())));
}

async function report() {
  const tasks = (await run('tasklist.exe', ['/fo', 'csv', '/nh'])).toLowerCase();
  const steamOnline = tasks.includes('"steam.exe"');
  let music = { state: tasks.includes('"cloudmusic.exe"') ? 'online' : 'offline' };
  if (music.state === 'online') {
    const output = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probe]);
    try { music = JSON.parse(output); } catch { }
  }
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ steamOnline, neteaseState: music.state, song: music.song || undefined }),
    });
  } catch { }
}

report();
setInterval(report, 5000);
