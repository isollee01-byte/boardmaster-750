import { readdir } from 'node:fs/promises';
import { extname } from 'node:path';

export const resourceFolders = [
  ['product', '제품자료'], ['safety', '안전자료'], ['installation', '시공자료']
];
const extensions = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.zip', '.jpg', '.jpeg', '.png']);
export async function listResources(root = new URL('./dist/resources/', import.meta.url)) {
  const items = [];
  for (const [folder, category] of resourceFolders) {
    const entries = await readdir(new URL(folder + '/', root), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.') || !extensions.has(extname(entry.name).toLowerCase())) continue;
      items.push({ title: entry.name.slice(0, -extname(entry.name).length), category, filename: entry.name,
        url: `resources/${folder}/${encodeURIComponent(entry.name)}` });
    }
  }
  return items.sort((a, b) => a.category.localeCompare(b.category, 'ko') || a.title.localeCompare(b.title, 'ko'));
}
