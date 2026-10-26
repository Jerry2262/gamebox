// 无依赖静态与模型测试：node tests/spider.test.cjs（不启动浏览器）
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'gamebox', 'spider.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
assert.match(html, /lang="zh-CN"/);
assert.match(script, /let suitCount = 1;/);
assert.match(html, /id="home" href="index.html"/);
assert.doesNotMatch(html, /rel="manifest"|<script[^>]+src=|<link[^>]+href="https?:/);
assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|WebSocket|serviceWorker/);
const deck = html.match(/<style id="deck">([\s\S]*?)<\/style>/)[1];
assert.equal([...deck.matchAll(/\.card\.c-[A-Z0-9]+\{/g)].length, 54, '内联卡图应为54张');
assert.doesNotMatch(html, /MIT License|Copyright \(c\)|CC0|RevK|开源|许可/, '不应残留版权与署名文字');
for (const label of html.matchAll(/(?:title|aria-label)="([^"]+)"/g)) {
  if (!label[1].includes('SUIT_LABEL')) assert.match(label[1], /[\u4e00-\u9fff]/);
}
assert.match(script, /const SUIT_LABEL = \{1: '1 花色', 2: '2 花色', 4: '4 花色'\}/);
const context = vm.createContext({structuredClone, Math});
const model = script.slice(0, script.indexOf('const SUIT_PATH'));
vm.runInContext(model, context);
vm.runInContext(`
for (const suits of [1,2,4]) {
  const st = deal(suits);
  if (st.tableau.length !== 10 || st.stock.length !== 5) throw Error('发牌结构');
  if (st.tableau.reduce((n,p) => n+p.length,0) !== 54) throw Error('初始54张');
  if (st.tableau.filter(p => p.at(-1).up).length !== 10) throw Error('翻牌');
  if (st.tableau.flat().concat(st.stock.flat()).some(c => c.s >= suits)) throw Error('花色');
}
const c = (r,s=0,up=true) => ({r,s,up});
const st = {tableau:[[c(9),c(8),c(7)],[c(8,1)],[]],stock:[[c(1)]],done:[]};
if (!isMovableRun(st,0,0)) throw Error('同花色整组');
st.tableau[0][1].s=1;
if (isMovableRun(st,0,0) || !isMovableRun(st,0,2)) throw Error('混花色不可整组');
if (!canDrop(st,c(7),1) || !canDrop(st,c(13),2) || canDrop(st,c(6),1)) throw Error('接牌');
if (canDealStock(st)) throw Error('空列禁止发牌');
state={tableau:[Array.from({length:13},(_,i)=>c(13-i)),[c(2,0,false)]],stock:[],done:[]};
collect(0);
if (state.done.length!==1 || state.tableau[0].length) throw Error('自动收齐');
state={tableau:[[c(9,0,false),c(8)],[c(9)],...Array.from({length:8},()=>[])],stock:[],done:[]};
history=[];
if (!move(0,1,1) || !state.tableau[0][0].up || history.length!==1) throw Error('移动翻牌与撤销快照');
if (history[0].tableau[0][0].up) throw Error('快照不能被改写');
`, context);
console.log('蜘蛛纸牌：静态、语法、内联素材完整性及核心规则测试通过');
