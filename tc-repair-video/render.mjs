// Rendert player.html Frame für Frame (Playwright/Chromium) und muxt mit der Sprecherspur zu MP4.
// Aufruf: node render.mjs [--fps 30] [--from 0] [--to <sek>] [--out build/tc-service-repair.mp4] [--still 12.5]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fps = Number(arg('fps', 30));
const out = path.resolve(ROOT, arg('out', 'build/tc-service-repair.mp4'));
const still = arg('still', null);

const content = JSON.parse(readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
// Bilder (Logo, Porträt) nur verwenden, wenn die Datei tatsächlich vorliegt – sonst Text-Fallback
for (const sc of content.scenes) for (const k of ['logo', 'portrait']) {
  if (sc.data[k] && !existsSync(path.join(ROOT, sc.data[k]))) sc.data[k] = null;
}
const timeline = JSON.parse(readFileSync(path.join(ROOT, 'build/timeline.json'), 'utf8'));
const from = Number(arg('from', 0));
const to = Number(arg('to', timeline.duration));

const browser = await playwright.chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.addInitScript((v) => { window.VIDEO = v; }, { content, timeline });
await page.goto('file://' + path.join(ROOT, 'player.html'));
await page.waitForFunction(() => window.PLAYER_READY === true);
await page.evaluate(() => document.fonts.ready);
// Bilder vollständig laden
await page.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));

if (still) {
  const list = still.split(',').map(Number);
  for (const t of list) {
    await page.evaluate((t) => window.seek(t), t);
    const file = path.join(ROOT, `build/still_${String(t).replace('.', '_')}.png`);
    await page.screenshot({ path: file });
    console.log('Standbild', file);
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-ss', String(from), '-t', String(to - from), '-i', path.join(ROOT, 'build/narration.wav'),
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round((to - from) * fps);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const t = from + i / fps;
  await page.evaluate((t) => window.seek(t), t);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % (fps * 5) === 0) process.stdout.write(`\r${i}/${total} Frames (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`\nFertig: ${out}`);
