// 发布验证：把成品单独复制到空目录再打开，确认脱离项目也能运行。
// 需要 Playwright；命令见 README。
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const artifact = path.join(root, '游戏盒子.html');
const sandbox = path.join(root, '.release-check');
const isolated = path.join(sandbox, '游戏盒子.html');

async function testSpider(scope, page, label) {
  await scope.waitForSelector('#board .card', { state: 'attached' });
  assert.equal(await scope.evaluate(() => state.suits), 1);
  assert.equal(await scope.locator('#board .pile').count(), 10);
  assert.equal(await scope.locator('#board .card').count(), 54);
  assert.equal(await scope.locator('#stock .card').count(), 5);
  await page.screenshot({ path: `tests/${label}-spider.png` });
  const before = await scope.evaluate(() => JSON.stringify(state));
  await scope.locator('#deal').click();
  assert.equal(await scope.evaluate(() => state.stock.length), 4);
  await scope.locator('#undo').click();
  assert.equal(await scope.evaluate(() => JSON.stringify(state)), before);
  await scope.locator('#rules').click();
  assert.equal(await scope.locator('#rulebook.on').count(), 1);
  await scope.evaluate(() => toggleBook(false));
  for (const n of [2, 4, 1]) {
    await scope.locator(`#suits button[data-n="${n}"]`).click();
    assert.equal(await scope.evaluate(() => state.suits), n);
    assert.equal(await scope.locator('#board .card').count(), 54);
  }
  // 固定牌局：点击移动同花色整组，再撤销，再用真实拖拽重复一次
  await scope.evaluate(() => {
    autoStop(); selection = null; history = [];
    const c = (r, s, id, up = true) => ({ r, s, id, up });
    state = { suits: 1, tableau: Array.from({ length: 10 }, (_, p) => [c(13, 0, 'k' + p)]), stock: [], done: [] };
    state.tableau[0] = [c(6, 0, 'hidden', false), c(9, 0, 'nine'), c(8, 0, 'eight')];
    state.tableau[1] = [c(10, 0, 'ten')];
    state.tableau[2] = [c(7, 0, 'seven')];
    serial++; render();
  });
  await scope.locator('.card[data-pile="0"][data-idx="1"]').click({ position: { x: 16, y: 5 } });
  await scope.locator('.card[data-pile="1"][data-idx="0"]').click({ position: { x: 16, y: 5 } });
  assert.deepEqual(await scope.evaluate(() => state.tableau[1].map(c => c.r)), [10, 9, 8]);
  assert.equal(await scope.evaluate(() => state.tableau[0][0].up), true);
  await scope.locator('#undo').click();
  assert.equal(await scope.evaluate(() => state.tableau[0][0].up), false);
  const a = await scope.locator('.card[data-pile="0"][data-idx="1"]').boundingBox();
  const b = await scope.locator('.card[data-pile="1"][data-idx="0"]').boundingBox();
  await page.mouse.move(a.x + 18, a.y + 5); await page.mouse.down();
  await page.mouse.move(b.x + 22, b.y + 20, { steps: 12 }); await page.mouse.up();
  assert.deepEqual(await scope.evaluate(() => state.tableau[1].map(c => c.r)), [10, 9, 8]);
  console.log(`PASS ${label} 蜘蛛纸牌：发牌/撤销/提示/玩法/花色切换/点击移动/真实拖拽/翻牌`);
}

async function testTetris(scope, page, label) {
  await scope.waitForSelector('#start-button', { state: 'attached' });
  await page.screenshot({ path: `tests/${label}-tetris.png` });
  await scope.locator('#start-button').click();
  assert.equal(await scope.evaluate(() => tetrisGame.gameRunning), true);
  const y = await scope.evaluate(() => tetrisGame.currentPiece.y);
  await page.waitForTimeout(1050);
  assert.ok(await scope.evaluate(() => tetrisGame.currentPiece.y) > y, '方块应自然下落');
  await scope.evaluate(() => {
    tetrisGame.clearGameInterval();
    tetrisGame.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    tetrisGame.currentPiece = { type: 'T', rotation: 0, x: 4, y: 1 };
    tetrisGame.render();
  });
  await scope.locator('#game-canvas').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.x), 3, '一次按键只移动一格');
  await page.keyboard.press('ArrowUp');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.rotation), 1);
  await page.keyboard.press('ArrowDown');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.y), 2);
  const next = await scope.evaluate(() => tetrisGame.nextPiece.type);
  await page.keyboard.press('Space');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.type), next, '下一个方块预览应与实际一致');
  assert.equal(await scope.evaluate(() => tetrisGame.board.flat().filter(Boolean).length), 4);
  await scope.locator('#pause-button').click();
  const piece = await scope.evaluate(() => JSON.stringify(tetrisGame.currentPiece));
  await page.waitForTimeout(1050);
  assert.equal(await scope.evaluate(() => JSON.stringify(tetrisGame.currentPiece)), piece);
  assert.equal(await scope.evaluate(() => tetrisGame.paused), true);
  await scope.locator('#resume-button').click();
  assert.equal(await scope.evaluate(() => tetrisGame.gameRunning), true);
  await scope.locator('#replay-button').click();
  assert.equal(await scope.locator('#score').innerText(), '0');
  assert.equal(await scope.locator('#lines').innerText(), '0');
  const cleared = await scope.evaluate(() => {
    const g = tetrisGame; g.clearGameInterval();
    g.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    g.board[19] = Array(10).fill('I'); g.board[18] = Array(10).fill('I');
    g.clearLines(); g.clearGameInterval();
    return { lines: g.lines, score: g.score, cells: g.board.flat().filter(Boolean).length };
  });
  assert.deepEqual(cleared, { lines: 2, score: 100, cells: 0 });
  await scope.evaluate(() => {
    tetrisGame.board = Array.from({ length: 20 }, () => Array(10).fill('O'));
    tetrisGame.spawnPiece();
  });
  assert.equal(await scope.evaluate(() => tetrisGame.gameOver), true);
  await scope.locator('#restart-button').click();
  assert.equal(await scope.evaluate(() => tetrisGame.gameOver), false);
  console.log(`PASS ${label} 俄罗斯方块：开始/自然下落/按键/旋转/软降/硬降/预览一致/暂停冻结/继续/重玩清零/消行计分/结束重开`);
}

(async () => {
  // 空目录里只放这一个文件，模拟发送给他人后的真实场景
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  fs.copyFileSync(artifact, isolated);
  assert.deepEqual(fs.readdirSync(sandbox), ['游戏盒子.html'], '空目录内应只有这一个文件');
  const mainUrl = pathToFileURL(isolated).href;

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas', '--disable-software-rasterizer'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true, reducedMotion: 'reduce' });
    const errors = [], foreign = [];
    // 允许：主文档本身（原样或解码后）、内联 data:、iframe 的 about: 文档。
    // 其余一律算外部依赖，包括同目录的 file:// 文件。
    const allowed = new Set([mainUrl, decodeURI(mainUrl)]);
    context.on('page', p => {
      p.on('pageerror', e => errors.push(e.message));
      p.on('request', r => {
        const u = r.url();
        if (u.startsWith('data:') || u.startsWith('about:')) return;
        if (allowed.has(u) || allowed.has(decodeURI(u))) return;
        foreign.push(u);
      });
    });
    const page = await context.newPage();
    await page.goto(mainUrl);
    assert.equal(await page.title(), '游戏盒子');

    await page.locator('[data-game="spider"]').click();
    let frame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
    await testSpider(frame, page, 'isolated');
    await frame.getByRole('link', { name: /返回首页/ }).click();
    await page.waitForFunction(() => document.getElementById('game-frame').hidden, null, { polling: 100 });

    await page.locator('[data-game="tetris"]').click();
    await testTetris(frame, page, 'isolated');
    await frame.getByRole('link', { name: /返回首页/ }).click();
    await page.waitForFunction(() => document.getElementById('game-frame').hidden, null, { polling: 100 });

    assert.deepEqual(errors, [], '不应有浏览器脚本错误');
    assert.deepEqual(foreign, [], '不应有任何外部或同级文件请求');
    console.log('PASS 发布验证：成品单独置于空目录，断网 file:// 运行两款游戏；无同级文件请求、无网络请求、无脚本错误');
  } finally {
    if (browser) await browser.close();
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
