// 빌드마다 서비스 워커 캐시 이름에 빌드 지문을 넣습니다.
// - 새 빌드가 올라오면 sw.js 내용이 달라져 브라우저가 새 워커를 설치합니다.
// - 새 워커가 활성화될 때 열려 있던 화면(휴대폰에 앱처럼 띄워 둔 탭)을 새 버전으로 다시 엽니다.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const swPath = path.join(distDir, 'sw.js');

const html = await readFile(indexPath, 'utf8');
const match = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
if (!match) {
  console.warn('[stamp-sw] 빌드 지문을 찾지 못해 서비스 워커를 그대로 둡니다.');
  process.exit(0);
}

const stamp = match[1];
const sw = await readFile(swPath, 'utf8');
const next = sw.replace(/const CACHE = '[^']*';/, `const CACHE = 'nexus-shell-${stamp}';`);
if (next !== sw) await writeFile(swPath, next, 'utf8');
console.log(`[stamp-sw] cache = ${(next.match(/const CACHE = '([^']+)';/) || [])[1]}`);
