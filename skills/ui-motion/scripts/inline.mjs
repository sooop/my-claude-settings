#!/usr/bin/env node
// 단일 HTML(아티팩트 등)에 모션 자산을 끼워 넣는다. 내용을 다시 타이핑하지 않으려는 용도다.
// 사용: node inline.mjs <page.html>
//   <style>/*__MOTION_CSS__*/</style> 와 <script>/*__MOTION_JS__*/</script> 자리표시자를 자산 내용으로 바꾼다.
//   이미 끼워 넣은 페이지에 다시 실행하면 최신 자산으로 교체한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const page = process.argv[2];
if (!page) { console.error('사용: node inline.mjs <page.html>'); process.exit(2); }
const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
let html = readFileSync(page, 'utf8');
let count = 0;
for (const [tag, file] of [['CSS', 'motion.css'], ['JS', 'motion.js']]) {
  const body = readFileSync(join(assets, file), 'utf8').trim();
  const open = `/*__MOTION_${tag}__*/`, close = `/*__MOTION_${tag}_END__*/`;
  const filled = new RegExp(`${open.replace(/[*/]/g, '\\$&')}[\\s\\S]*?${close.replace(/[*/]/g, '\\$&')}`);
  const block = `${open}\n${body}\n${close}`;
  if (filled.test(html)) { html = html.replace(filled, () => block); count++; }
  else if (html.includes(open)) { html = html.replace(open, () => block); count++; }
  else console.error(`자리표시자 ${open} 가 없습니다`);
}
writeFileSync(page, html);
console.log(`${count}/2 개 자산을 끼워 넣었습니다: ${page}`);
process.exit(count === 2 ? 0 : 1);
