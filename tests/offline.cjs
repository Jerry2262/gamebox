const { chromium } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const url = p => pathToFileURL(path.resolve(p)).href;
const screenshot = (page, options) => process.env.SKIP_SHOTS ? Promise.resolve() : page.screenshot(options);

async function testSpider(scope, page, label) {
  await scope.waitForSelector('#board .card',{state:'attached'});
  assert.equal(await scope.evaluate(() => state.suits), 1);
  assert.equal(await scope.locator('#board .pile').count(), 10);
  assert.equal(await scope.locator('#board .card').count(), 54);
  assert.equal(await scope.locator('#stock .card').count(), 5);
  await screenshot(page, {path:`tests/${label}-spider.png`});
  const before = await scope.evaluate(() => JSON.stringify(state));
  await scope.locator('#deal').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.evaluate(() => state.stock.length), 4);
  await scope.locator('#undo').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.evaluate(() => JSON.stringify(state)), before);
  await scope.locator('#hint').click({force:!!process.env.FORCE_ACTION});
  await scope.locator('#rules').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.locator('#rulebook.on').count(), 1);
  assert.match(await scope.locator('#rulebook').innerText(), /同花色/);
  await scope.evaluate(() => toggleBook(false));
  for (const n of [2,4,1]) {
    await scope.locator(`#suits button[data-n="${n}"]`).click({force:!!process.env.FORCE_ACTION});
    assert.equal(await scope.evaluate(() => state.suits), n);
    assert.equal(await scope.locator('#board .card').count(), 54);
  }
  // An open sheet hides the controls behind it; their keys must not reach them.
  await scope.locator('#deal').click({force:!!process.env.FORCE_ACTION});
  const stockBefore = await scope.evaluate(() => state.stock.length);
  await page.keyboard.press('F1');
  assert.equal(await scope.locator('#help.on').count(), 1);
  await page.keyboard.press('Enter');
  assert.equal(await scope.evaluate(() => state.stock.length), stockBefore, 'Enter must not deal behind an open sheet');
  assert.equal(await scope.locator('#help.on').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await scope.locator('#help.on').count(), 0);
  // A key already held when the sheet opens must not reach the button behind it.
  await scope.evaluate(() => { autoStop(); history = []; });
  const heldBefore = await scope.evaluate(() => ({stock: state.stock.length, history: history.length, serial}));
  await scope.locator('#new').focus();
  await page.keyboard.down(' ');
  await page.keyboard.press('F1');
  assert.equal(await scope.locator('#help.on').count(), 1);
  await page.keyboard.up(' ');
  await page.waitForTimeout(100);
  assert.deepEqual(await scope.evaluate(() => ({stock: state.stock.length, history: history.length, serial})), heldBefore, 'a held key must not reach the control behind a sheet');
  assert.equal(await scope.locator('#help.on').count(), 1);
  await page.keyboard.press('Escape');
  // Deterministic position: move a two-card run by real mouse clicks, then undo.
  await scope.evaluate(() => {
    autoStop(); selection = null; history = [];
    const c = (r,s,id,up=true) => ({r,s,id,up});
    state = {suits:1, tableau:Array.from({length:10},(_,p)=>[c(13,0,'k'+p)]),stock:[],done:[]};
    state.tableau[0] = [c(6,0,'hidden',false),c(9,0,'nine'),c(8,0,'eight')];
    state.tableau[1] = [c(10,0,'ten')]; state.tableau[2] = [c(7,0,'seven')]; serial++; render();
  });
  await scope.locator('.card[data-pile="0"][data-idx="1"]').click({position:{x:16,y:5},force:!!process.env.FORCE_ACTION});
  await scope.locator('.card[data-pile="1"][data-idx="0"]').click({position:{x:16,y:5},force:!!process.env.FORCE_ACTION});
  assert.deepEqual(await scope.evaluate(() => state.tableau[1].map(c=>c.r)), [10,9,8]);
  assert.equal(await scope.evaluate(() => state.tableau[0][0].up), true);
  await scope.locator('#undo').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.evaluate(() => state.tableau[0][0].up), false);
  // Compositor-less environments can exercise clicks but cannot acknowledge mousemove.
  if (!process.env.SKIP_SHOTS) {
  // Repeat the same move with a real drag (uses page coordinates, also inside iframe).
  const a = await scope.locator('.card[data-pile="0"][data-idx="1"]').boundingBox();
  const b = await scope.locator('.card[data-pile="1"][data-idx="0"]').boundingBox();
  await page.mouse.move(a.x+18,a.y+5); await page.mouse.down();
  await page.mouse.move(b.x+22,b.y+20,{steps:12}); await page.mouse.up();
  assert.deepEqual(await scope.evaluate(() => state.tableau[1].map(c=>c.r)), [10,9,8]);
  // Undo while a run is held: the drag must not keep using the old column index.
  const c = await scope.locator('.card[data-pile="1"][data-idx="1"]').boundingBox();
  await page.mouse.move(c.x+18,c.y+5); await page.mouse.down();
  await page.keyboard.press('Control+z');
  await page.mouse.move(c.x+40,c.y+40,{steps:4}); await page.mouse.up();
  assert.deepEqual(await scope.evaluate(() => ({
    col0: state.tableau[0].map(x=>x.r), col1: state.tableau[1].map(x=>x.r), history: history.length
  })), {col0:[6,9,8],col1:[10],history:0});
  // A keyboard move while a card is held must also drop the drag state.
  await scope.evaluate(() => {
    autoStop(); selection = null; history = [];
    const c = (r,s,id,up=true) => ({r,s,id,up});
    state = {suits:1, tableau:Array.from({length:10},(_,p)=>[c(13,0,'k'+p)]),stock:[],done:[]};
    state.tableau[0] = [c(6,0,'hidden',false),c(9,0,'nine'),c(8,0,'eight')];
    state.tableau[1] = [c(10,0,'ten')]; state.tableau[2] = [c(7,0,'seven')]; serial++; render();
  });
  await scope.locator('.card[data-pile="0"][data-idx="1"]').click({position:{x:16,y:5},force:!!process.env.FORCE_ACTION});
  const held = await scope.locator('.card[data-pile="0"][data-idx="1"]').boundingBox();
  await page.mouse.move(held.x+18,held.y+5); await page.mouse.down();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.mouse.move(held.x+58,held.y+45,{steps:4}); await page.mouse.up();
  assert.deepEqual(await scope.evaluate(() => ({
    col0: state.tableau[0].map(x=>x.r), col1: state.tableau[1].map(x=>x.r), flipped: state.tableau[0][0].up
  })), {col0:[6],col1:[10,9,8],flipped:true}, 'keyboard move while dragging drops the drag state');
  // Opening a sheet mid-drag ends the gesture instead of playing it out on release.
  await scope.evaluate(() => {
    autoStop(); selection = null; history = [];
    const c = (r,s,id,up=true) => ({r,s,id,up});
    state = {suits:1, tableau:Array.from({length:10},(_,p)=>[c(13,0,'k'+p)]),stock:[],done:[]};
    state.tableau[0] = [c(6,0,'hidden',false),c(9,0,'nine'),c(8,0,'eight')];
    state.tableau[1] = [c(10,0,'ten')]; state.tableau[2] = [c(7,0,'seven')]; serial++; render();
  });
  const holdCard = await scope.locator('.card[data-pile="0"][data-idx="1"]').boundingBox();
  const dropTarget = await scope.locator('.card[data-pile="1"][data-idx="0"]').boundingBox();
  await page.mouse.move(holdCard.x+18, holdCard.y+5); await page.mouse.down();
  await page.mouse.move(dropTarget.x+22, dropTarget.y+20, {steps:12});
  await page.keyboard.press('F1');
  assert.equal(await scope.locator('#help.on').count(), 1);
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.deepEqual(await scope.evaluate(() => ({
    col0: state.tableau[0].map(x=>x.r), col1: state.tableau[1].map(x=>x.r),
    ghost: document.querySelectorAll('#drag .card').length,
    hidden: [...document.querySelectorAll('#board .card')].filter(el => el.style.visibility === 'hidden').length
  })), {col0:[6,9,8],col1:[10],ghost:0,hidden:0}, 'a sheet ends the drag instead of completing it');
  await page.keyboard.press('Escape');
  assert.equal(await scope.locator('#help.on').count(), 0);
  }
  // Enter on a focused toolbar button must activate it, not the table.
  await scope.evaluate(() => { history = []; serial = 0; });
  await scope.locator('#new').focus();
  await page.keyboard.press('Enter');
  assert.ok(await scope.evaluate(() => serial > 0), 'Enter activates the focused toolbar button');
  // A selection must not outlive the position it was made in: the automatic
  // demonstration can play a move while a run is still held.
  const stale = await scope.evaluate(() => {
    autoStop(); history = [];
    const c = (r,s,id,up=true) => ({r,s,id,up});
    state = {suits:1, tableau:Array.from({length:10},(_,p)=>[c(13,0,'k'+p)]),stock:[],done:[]};
    state.tableau[0] = [c(9,0,'nine'),c(8,0,'eight')];
    state.tableau[1] = [c(10,0,'ten')]; serial++; render();
    selection = {pile:0, idx:1, serial};
    applyMove(0, 1, 1);                    // the position changes under the held run
    render();
    return {dropped: selection === null, col1: state.tableau[1].map(x=>x.r)};
  });
  assert.deepEqual(stale, {dropped:true, col1:[10,8]}, 'stale selection is dropped on redraw');
  console.log(`PASS ${label}: spider deal/undo/hints/rules/suits/click/flip${process.env.SKIP_SHOTS?' (drag and screenshots skipped: test compositor unavailable)':'/drag'}`);
}

async function testTetris(scope, page, label) {
  await scope.waitForSelector('#start-button',{state:'attached'});
  await screenshot(page, {path:`tests/${label}-tetris.png`});
  await scope.locator('#start-button').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.evaluate(() => tetrisGame.gameRunning), true);
  const y = await scope.evaluate(() => tetrisGame.currentPiece.y);
  await page.waitForTimeout(1050);
  assert.ok(await scope.evaluate(() => tetrisGame.currentPiece.y) > y, 'Gravity runs');
  await scope.evaluate(() => {
    tetrisGame.clearGameInterval();
    tetrisGame.board=Array.from({length:20},()=>Array(10).fill(0));
    tetrisGame.currentPiece={type:'T',rotation:0,x:4,y:1};
    tetrisGame.render();
  });
  await scope.locator('#game-canvas').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.x), 3, 'Exactly one cell per key');
  await page.keyboard.press('ArrowUp');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.rotation), 1);
  await page.keyboard.press('ArrowDown');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.y), 2);
  const next = await scope.evaluate(() => tetrisGame.nextPiece.type);
  await page.keyboard.press('Space');
  assert.equal(await scope.evaluate(() => tetrisGame.currentPiece.type), next, 'Next preview matches');
  assert.equal(await scope.evaluate(() => tetrisGame.board.flat().filter(Boolean).length), 4);
  // Space on a focused button activates it instead of hard-dropping the piece.
  await scope.locator('#pause-button').focus();
  await page.keyboard.press('Space');
  assert.equal(await scope.evaluate(() => tetrisGame.paused), true, 'Space activates the focused pause button');
  await scope.locator('#resume-button').click({force:!!process.env.FORCE_ACTION});
  await scope.locator('#pause-button').click({force:!!process.env.FORCE_ACTION});
  const piece = await scope.evaluate(() => JSON.stringify(tetrisGame.currentPiece));
  await page.waitForTimeout(1050);
  assert.equal(await scope.evaluate(() => JSON.stringify(tetrisGame.currentPiece)), piece);
  assert.equal(await scope.evaluate(() => tetrisGame.paused), true);
  await scope.locator('#resume-button').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.evaluate(() => tetrisGame.gameRunning), true);
  await scope.locator('#replay-button').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.locator('#score').innerText(), '0');
  assert.equal(await scope.locator('#lines').innerText(), '0');
  const result = await scope.evaluate(() => {
    const g = tetrisGame; g.clearGameInterval();
    g.board=Array.from({length:20},()=>Array(10).fill(0));
    g.board[19]=Array(10).fill('I');g.board[18]=Array(10).fill('I');
    g.clearLines();g.clearGameInterval();
    return {lines:g.lines,score:g.score,cells:g.board.flat().filter(Boolean).length};
  });
  assert.deepEqual(result,{lines:2,score:100,cells:0});
  await scope.evaluate(() => {
    tetrisGame.board=Array.from({length:20},()=>Array(10).fill('O'));
    tetrisGame.spawnPiece();
  });
  assert.equal(await scope.evaluate(() => tetrisGame.gameOver), true);
  await scope.locator('#restart-button').click({force:!!process.env.FORCE_ACTION});
  assert.equal(await scope.evaluate(() => tetrisGame.gameOver), false);
  // Board buttons must not drag the page around when they take focus.
  const dirButton = scope.locator('[data-key="ArrowLeft"]');
  await dirButton.scrollIntoViewIfNeeded();
  const scrollBefore = await scope.evaluate(() => window.scrollY);
  assert.ok(scrollBefore > 0, 'the page is scrolled down to reach the board buttons');
  const dirBox = await dirButton.boundingBox();
  await page.mouse.click(dirBox.x + dirBox.width/2, dirBox.y + dirBox.height/2);
  await page.waitForTimeout(150);
  assert.equal(await scope.evaluate(() => window.scrollY), scrollBefore, 'board buttons take focus without scrolling the page');
  const aboveTop = await scope.evaluate(() => {
    const g = tetrisGame; g.clearGameInterval();
    g.currentPiece = {type:'T',rotation:0,x:0,y:-1};
    return g.isValidPosition();
  });
  assert.equal(aboveTop, false, 'A piece may not sit above the board');
  console.log(`PASS ${label}: tetris start/gravity/keys/rotation/drop/preview/pause/replay/lines/gameover`);
}

(async () => {
  const browser = await chromium.launch({headless:true,args:['--disable-gpu','--disable-gpu-compositing','--disable-accelerated-2d-canvas','--disable-software-rasterizer']});
  try {
    const context = await browser.newContext({viewport:{width:1366,height:768},offline:true,reducedMotion:'reduce'});
    const errors=[],requests=[];
    context.on('page', p => {
      p.on('pageerror', e => errors.push(e.message));
      p.on('request', r => {if (/^https?:/i.test(r.url())) requests.push(r.url());});
    });
    const page=await context.newPage();
    await page.goto(url('gamebox/index.html'));
    await page.getByRole('link',{name:/蜘蛛纸牌/}).click({force:!!process.env.FORCE_ACTION});
    await testSpider(page,page,'folder');
    await page.getByRole('link',{name:/返回首页/}).click({force:!!process.env.FORCE_ACTION});
    await page.getByRole('link',{name:/俄罗斯方块/}).click({force:!!process.env.FORCE_ACTION});
    await testTetris(page,page,'folder');
    await page.getByRole('link',{name:/返回首页/}).click({force:!!process.env.FORCE_ACTION});
    await page.goto(url('游戏盒子.html'));
    assert.equal(await page.title(),'游戏盒子');
    await screenshot(page, {path:'tests/home.png'});
    await page.locator('[data-game="spider"]').click({force:!!process.env.FORCE_ACTION});
    let child = await page.locator('#game-frame').elementHandle();
    let frame = await child.contentFrame();
    await testSpider(frame,page,'single');
    await frame.getByRole('link',{name:/返回首页/}).click({force:!!process.env.FORCE_ACTION});
    await page.waitForFunction(() => document.getElementById('game-frame').hidden,null,{polling:100});
    await page.locator('[data-game="tetris"]').click({force:!!process.env.FORCE_ACTION});
    await testTetris(frame,page,'single');
    await frame.getByRole('link',{name:/返回首页/}).click({force:!!process.env.FORCE_ACTION});
    await page.waitForFunction(() => document.getElementById('game-frame').hidden,null,{polling:100});
    for (const size of [{width:1024,height:600},{width:1280,height:720}]) {
      await page.setViewportSize(size);
      await page.locator('[data-game="spider"]').click({force:!!process.env.FORCE_ACTION});
      await frame.waitForSelector('#board .card',{state:'attached'});
      const metrics=await frame.evaluate(() => ({
        overflow:document.documentElement.scrollWidth>innerWidth,
        cards:[...document.querySelectorAll('#board .card')].every(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;})
      }));
      assert.deepEqual(metrics,{overflow:false,cards:true},'Spider fits small desktop');
      await frame.locator('#deal').click({force:!!process.env.FORCE_ACTION});
      await frame.locator('#undo').click({force:!!process.env.FORCE_ACTION});
      await screenshot(page, {path:`tests/single-spider-${size.width}.png`});
      await frame.getByRole('link',{name:/返回首页/}).click({force:!!process.env.FORCE_ACTION});
      await page.waitForFunction(() => document.getElementById('game-frame').hidden,null,{polling:100});
      await page.locator('[data-game="tetris"]').click({force:!!process.env.FORCE_ACTION});
      await frame.waitForSelector('#start-button',{state:'attached'});
      await frame.locator('#start-button').click({force:!!process.env.FORCE_ACTION});
      await frame.locator('#pause-button').click({force:!!process.env.FORCE_ACTION});
      await screenshot(page, {path:`tests/single-tetris-${size.width}.png`});
      await frame.getByRole('link',{name:/返回首页/}).click({force:!!process.env.FORCE_ACTION});
      await page.waitForFunction(() => document.getElementById('game-frame').hidden,null,{polling:100});
    }
    assert.deepEqual(errors,[],'Browser script errors');
    assert.deepEqual(requests,[],'No HTTP requests, not even while offline');
    console.log('PASS: folder and standalone file:// offline navigation; 1366×768 / 1280×720 / 1024×600; no script errors or HTTP requests');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
