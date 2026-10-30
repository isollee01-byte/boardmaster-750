import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(x => x[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs');
for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(match[1]), `Missing anchor ${match[1]}`);
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (!/^(https?:|tel:)/.test(match[1])) await access(new URL('./dist/' + match[1], import.meta.url));
}
console.log('PASS: unique IDs, section anchors, local styles/scripts/images/page links');
