import { writeFile } from 'node:fs/promises';
import { listResources } from './resources.mjs';
const items = await listResources();
await writeFile(new URL('./dist/resources/index.json', import.meta.url), JSON.stringify(items, null, 2) + '\n');
console.log(`기술자료 ${items.length}건 목록 생성 완료. dist 폴더 전체를 배포하세요.`);
