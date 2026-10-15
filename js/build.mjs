import { cp, mkdir, rm, copyFile, readdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
if (path.resolve(output) !== path.resolve(root, 'dist') || path.dirname(output) !== root) throw new Error('Destino de build fora do projeto.');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('O destino do build não pode ser um link.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
await mkdir(path.join(output, 'js'));
for (const filename of (await readdir(path.join(root, 'js'))).filter(file => file.endsWith('.js'))) await copyFile(path.join(root, 'js', filename), path.join(output, 'js', filename));
for (const filename of (await readdir(root)).filter(file => file.endsWith('.html'))) await copyFile(path.join(root, filename), path.join(output, filename));
await copyFile(path.join(root, 'styles.css'), path.join(output, 'styles.css'));
console.log('Site pronto em dist/.');
