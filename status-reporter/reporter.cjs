const { execFile, execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const settingsPath = process.argv[2];
if (!settingsPath) throw new Error('Missing reporter settings path.');
const settings = JSON.parse(readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, ''));
if (typeof settings.siteUrl !== 'string' || !/^https:\/\//i.test(settings.siteUrl)) throw new Error('The reporter site URL must use HTTPS.');
const endpoint = `${settings.siteUrl.replace(/\/+$/, '')}/api/status`;
const probe = join(__dirname, 'media-probe.ps1');
const decryptor = join(__dirname, 'decrypt-token.ps1');

function run(file, args) {
  return new Promise((resolve) => execFile(file, args, { windowsHide: true, timeout: 10000, encoding: 'utf8' }, (error, stdout) => resolve(error ? '' : stdout.trim())));
}

function readToken() {
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', decryptor, settingsPath], { windowsHide: true, timeout: 10000, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function report(token) {
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
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ steamOnline, neteaseState: music.state, song: music.song || undefined }),
    });
  } catch { }
}

async function main() {
  const token = readToken();
  if (!token) throw new Error('Unable to decrypt the reporter token. Run install.ps1 again as the same Windows user.');
  await report(token);
  setInterval(() => void report(token), 15_000);
}

void main();
