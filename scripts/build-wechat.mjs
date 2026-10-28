import { build } from 'esbuild';
import { mkdir, rm, copyFile, readdir, readFile, writeFile, stat, rename, mkdtemp } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/wechat');
await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(root, 'dist/.wechat-build-'));
try {
const compiled = await build({
  entryPoints: [join(root, 'src/wechat.ts')],
  outfile: join(staging, 'game.js'),
  write: false,
  bundle: true,
  platform: 'neutral',
  mainFields: ['module', 'main'],
  format: 'iife',
  target: 'es2017',
  minify: true,
  // Runtime package stays below the WeChat main-package budget; do not ship debug maps.
  sourcemap: false,
  legalComments: 'eof',
  logLevel: 'info',
});
// The WeChat preview packer rejected optional chaining despite simulator support.
// ES2017 lowering is mandatory; keep a regression guard for the observed tokens.
if (/\?\.(?!\d)|\?\?/.test(compiled.outputFiles[0].text)) {
  throw new Error('WeChat bundle retains optional chaining/nullish coalescing unsupported by the preview packer.');
}
await writeFile(join(staging, 'game.js'), compiled.outputFiles[0].contents);
await copyFile(join(root, 'wechat/game.json'), join(staging, 'game.json'));
const project = JSON.parse(await readFile(join(root, 'wechat/project.config.json'), 'utf8'));
let local = {};
try { local = JSON.parse(await readFile(join(root, 'wechat/project.local.config.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
project.appid = process.env.WECHAT_APP_ID || local.appid || project.appid;
if (project.appid !== 'testappid' && !/^wx[a-zA-Z0-9]{16}$/.test(project.appid)) {
  throw new Error('WECHAT_APP_ID / local appid must be a WeChat AppID beginning with wx, followed by 16 characters.');
}
await writeFile(join(staging, 'project.config.json'), JSON.stringify(project, null, 2) + '\n');

// Copy only explicitly supported runtime assets; docs/references never enters a build.
const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.wav', '.mp3', '.ogg', '.json']);
async function copyAssets(source, target) {
  await mkdir(target, { recursive: true });
  let entries;
  try { entries = await readdir(source, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    if (entry.isDirectory()) await copyAssets(join(source, entry.name), join(target, entry.name));
    else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) {
      await copyFile(join(source, entry.name), join(target, entry.name));
    }
  }
}
await copyAssets(join(root, 'public/assets'), join(staging, 'assets'));

// Audio is generated offline through Starti/ElevenLabs and shipped as local MP3s.
for (const kind of ['drop', 'merge', 'over', 'music']) {
  const audio = join(staging, 'assets/audio', `${kind}.mp3`);
  if ((await stat(audio)).size === 0) throw new Error(`Empty required audio: ${kind}`);
}
async function assetFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await assetFiles(join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}
const expectedAssets = new Set(await assetFiles(join(staging, 'assets')));
async function packageBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) bytes += await packageBytes(path);
    else if (entry.isFile()) bytes += (await stat(path)).size;
  }
  return bytes;
}
const limit = 4 * 1024 * 1024;
const stagedBytes = await packageBytes(staging);
if (stagedBytes > limit) throw new Error('WeChat main-package budget exceeded (4 MiB). Optimize images or introduce subpackages before importing/uploading.');

// Validate everything before publishing. Each file is replaced with rename, so
// an open Developer Tools project never sees a missing/partially written entry.
// Unchanged files are left alone to avoid unnecessary automatic rebuilds.
async function publishFiles(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name), to = join(target, entry.name);
    if (entry.isDirectory()) { await publishFiles(from, to); continue; }
    let existing;
    try { existing = await readFile(to); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const incoming = await readFile(from);
    if (!existing || !existing.equals(incoming)) await rename(from, to);
  }
}
// Assets and config become available before the new entry starts referencing them.
await publishFiles(join(staging, 'assets'), join(output, 'assets'));
for (const name of ['game.json', 'project.config.json', 'game.js']) {
  const source = join(staging, name), target = join(output, name);
  let existing;
  try { existing = await readFile(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const incoming = await readFile(source);
  if (!existing || !existing.equals(incoming)) await rename(source, target);
}
// The build owns assets/: prune retired v1 images and synthesized WAVs so
// repeated builds cannot accidentally ship unused media or exceed the budget.
for (const relative of await assetFiles(join(output, 'assets'))) {
  if (!expectedAssets.has(relative)) await rm(join(output, 'assets', relative));
}
// Preserve tool-local/private config; only the obsolete generated map is removed.
await rm(join(output, 'game.js.map'), { force: true });
const bytes = await packageBytes(output);
console.log(`WeChat project: ${output}`);
console.log(project.appid === 'testappid' ? 'Using testappid: local tools only; configure your own Mini Game AppID for account-bound preview/upload.' : 'Using configured Mini Game AppID.');

console.log(`WeChat package: ${bytes.toLocaleString('en-US')} bytes / ${limit.toLocaleString('en-US')} bytes (${(bytes / 1024 / 1024).toFixed(2)} MiB).`);
if (bytes > limit) throw new Error('WeChat import directory exceeds 4 MiB; remove obsolete assets or introduce subpackages.');
} finally {
  await rm(staging, { recursive: true, force: true });
}
