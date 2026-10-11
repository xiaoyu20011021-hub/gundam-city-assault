import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional maintenance utility. Normal game startup uses the committed local assets.
// Exact archive checksums keep updates deliberate instead of silently changing visuals.
const assetRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets');
const manifest = JSON.parse(await readFile(join(assetRoot, 'manifest.json'), 'utf8'));
const taskTempRoot = resolve(tmpdir());
const taskTemp = await mkdtemp(join(taskTempRoot, 'sd-gundam-assets-'));
const safePath = (parent, child) => {
  const target = resolve(parent, child);
  const rel = relative(parent, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Unsafe asset path: ${child}`);
  return target;
};
try {
  for (const pack of manifest.packages) {
    const url = new URL(pack.archive);
    if (url.protocol !== 'https:' || url.hostname !== 'kenney.nl') throw new Error(`Unexpected source: ${url}`);
    console.log(`Downloading ${pack.name} ${pack.version}…`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${pack.name}: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    const checksum = createHash('sha256').update(data).digest('hex');
    if (checksum !== pack.sha256) throw new Error(`${pack.name}: archive changed. Review the official pack and update manifest.json deliberately.`);
    const archive = safePath(taskTemp, `${pack.id}.zip`);
    const extracted = safePath(taskTemp, pack.id);
    await writeFile(archive, data);
    await mkdir(extracted);
    if (process.platform === 'win32') {
      const quote = value => `'${value.replaceAll("'", "''")}'`;
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(extracted)}`], { stdio: 'inherit' });
    } else {
      execFileSync('unzip', ['-q', archive, '-d', extracted], { stdio: 'inherit' });
    }
    for (const file of pack.files) {
      const source = safePath(extracted, file.source);
      const destination = safePath(assetRoot, file.destination);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    console.log(`Prepared ${pack.files.length} files from ${pack.name}.`);
  }
} finally {
  const taskRel = relative(taskTempRoot, taskTemp);
  if (taskRel.startsWith('sd-gundam-assets-') && !taskRel.includes(sep) && taskTemp !== taskTempRoot) {
    await rm(taskTemp, { recursive: true, force: true });
  }
}
