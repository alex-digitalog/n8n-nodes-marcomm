// ponytail: tsc does not copy SVG icons and codex files. Two node folders and one credentials folder, so a plain copy instead of a bundler.
import { cpSync } from 'node:fs';

const keep = (src) => !src.endsWith('.ts');
for (const dir of ['nodes/Marcomm', 'nodes/MarcommTrigger', 'credentials']) {
  cpSync(new URL(`../${dir}`, import.meta.url), new URL(`../dist/${dir}`, import.meta.url), { recursive: true, filter: keep });
}
