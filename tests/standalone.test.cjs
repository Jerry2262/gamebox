// 单文件自包含检查：node tests/standalone.test.cjs
// 验证 游戏盒子.html 单独拷到空目录也能用：不存在任何相对路径或网络引用。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '..', '游戏盒子.html');
const html = fs.readFileSync(file, 'utf8');

// 1. 外层文档自身不得有任何外部引用
const outerRefs = [...html.matchAll(/\b(href|src)="([^"]*)"/g)].map(m => m[2])
  .filter(u => !u.startsWith('data:') && !u.startsWith('#'));
assert.deepEqual(outerRefs, [], '外层文档存在外部引用');

// 2. 取出内嵌的两款游戏，逐个检查
const line = html.split('\n').find(l => l.startsWith('const games = '));
assert.ok(line, '未找到内嵌游戏数据');
const games = JSON.parse(line.slice('const games = '.length).replace(/;\s*$/, ''));
assert.deepEqual(Object.keys(games).sort(), ['spider', 'tetris']);

for (const [name, page] of Object.entries(games)) {
  assert.match(page, /<!doctype html>/i, `${name}: 不是完整页面`);
  const refs = [...page.matchAll(/\b(href|src)="([^"]*)"/g)].map(m => m[2])
    .filter(u => !u.startsWith('data:') && !u.startsWith('#'));
  assert.deepEqual(refs, [], `${name}: 存在相对路径或网络引用 ${refs}`);
  assert.doesNotMatch(page, /<script[^>]+src=/i, `${name}: 外链脚本`);
  assert.doesNotMatch(page, /<link[^>]+href="(?!data:)/i, `${name}: 外链样式`);
  assert.doesNotMatch(page, /<img[^>]+src="(?!data:)/i, `${name}: 外链图片`);
  // CSS 里的 url() 必须是内联数据；# 与 %23（编码后的 #）是同一文档内的滤镜/遮罩引用
  const cssUrls = [...page.matchAll(/url\((["']?)([^"')]+)\1\)/g)].map(m => m[2])
    .filter(u => !u.startsWith('data:') && !u.startsWith('#') && !u.startsWith('%23'));
  assert.deepEqual(cssUrls, [], `${name}: CSS 引用外部资源`);
  // 运行期不得自行发起请求或加载模块
  assert.doesNotMatch(page, /\bfetch\s*\(|XMLHttpRequest|WebSocket|serviceWorker|import\s*\(|new\s+Worker/, `${name}: 运行期网络/模块调用`);
  // 回首页必须走内部消息，不能指向 index.html
  assert.doesNotMatch(page, /index\.html/, `${name}: 仍指向外部 index.html`);
  assert.match(page, /gamebox-home/, `${name}: 缺少回首页消息`);
}

// 内嵌素材本身必须存在（蜘蛛纸牌的 54 张卡图内联在样式里）
assert.match(html, /data:image\/svg\+xml/, '未内联图片资源');

// 3. 整份文件不得出现其它文件名或协议
assert.doesNotMatch(html, /licenses\/|upstream\//, '残留外部许可路径');
assert.doesNotMatch(html, /["'(]https?:\/\/(?!www\.w3\.org)/, '残留 http(s) 引用');

// 4. 启动脚本语法可用
for (const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(s[1]);

console.log(`单文件自包含检查通过：外层 0 个外部引用；内嵌 ${Object.keys(games).length} 款游戏全部内联，` +
  `无相对路径、无网络调用、无外链脚本或样式，回首页走内部消息。`);
