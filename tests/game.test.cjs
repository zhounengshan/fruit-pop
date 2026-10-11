const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise production functions with a minimal DOM and controllable animation timers.
function boot(saved = {}, failStorage = false) {
  const timers = [];
  const elements = new Map();
  function element() {
    return { children: [], dataset: {}, style: {setProperty() {}}, classList: {add(){},remove(){},toggle(){}},
      addEventListener(name, fn) { (this.listeners ??= {})[name] = fn; }, setAttribute(){}, remove(){},
      appendChild(child) {this.children.push(child);}, replaceChildren(...children) {this.children = children.flatMap(c => c.fragment ? c.children : [c]);},
      getBoundingClientRect() {return {left:0,top:0,width:40,height:40};} };
  }
  const document = {body:element(),createElement:element,createDocumentFragment(){return {...element(),fragment:true};},
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}};
  let stored = JSON.stringify(saved);
  const context = {document, navigator:{}, window:{location:{href:'http://localhost/'}}, URL, console,
    localStorage:{getItem(){return stored;},setItem(k,v){if(failStorage)throw Error('disabled');stored=v;}},
    Audio:class {paused=true;play(){return Promise.resolve();}pause(){}},
    setTimeout(fn,delay){timers.push({fn,delay});}};
  const source = fs.readFileSync(require.resolve('../game.js'),'utf8').replace('  load();',
    '  globalThis.testGame = {state, el, startLevel, load, save, actionAt, expandChain, executeAction, collapse, refillBoard, hasMoves, checkState, finishRound, modalAction, remainingCount, goalWon, fruitPool, fruitTone, render, showCollection, BOMB, SUPER_BOMB, ROCKET, RAINBOW, CRATE}; load();');
  vm.runInNewContext(source,context);
  const api = context.testGame;
  api.state.sound = api.state.music = false;
  return {...api,flush(){while(timers.length){const pending=timers.splice(0);for(const timer of pending)timer.fn();}},elements,getSaved:()=>JSON.parse(stored)};
}
function empty(g){g.state.board=Array.from({length:10},()=>Array(8).fill(null));g.state.locks=Array.from({length:10},()=>Array(8).fill(null));}
function act(g,r,c){g.executeAction(g.expandChain(g.actionAt(r,c)),r,c);g.flush();}

const g = boot({level:123,score:45678,starsByLevel:{1:3,2:2},streak:4,highestLevel:123});
assert.equal(g.state.level,123);assert.equal(g.state.score,45678);assert.equal(g.state.totalStars,5);
assert.equal(g.state.streak,4);assert.ok(g.state.pool.includes(15));
assert.equal(g.state.goal.kind,'rescue');
for(let level=1;level<=1000;level++){
  g.state.level=level;g.startLevel();
  assert.equal(g.remainingCount(),80);
  assert.ok(g.hasMoves());
  assert.ok(g.state.pool.length>=4&&g.state.pool.length<=6);
  assert.equal(new Set(g.state.pool.map(g.fruitTone)).size,g.state.pool.length);
  for(const cell of g.el.board.children){
    if(cell.dataset.type!==''&&Number(cell.dataset.type)<100){
      const tone=g.fruitTone(Number(cell.dataset.type));
      assert.ok(cell.className.includes(`tone-${tone}`));
      assert.ok(!cell.innerHTML.includes('fruit-mark'));
    }
  }
  for(const type of g.state.board.flat())assert.ok(type>=100||g.state.pool.includes(type));
  if(g.state.goal.kind==='rescue')assert.equal(g.state.board.flat().filter(v=>v===g.CRATE).length,g.state.goal.target);
  if(g.state.goal.kind==='boss')assert.ok(g.state.pool.includes(g.state.boss.fruit));
}
const late=new Set();for(let level=201;level<=260;level++)for(const v of g.fruitPool(level))late.add(v);
assert.equal(late.size,20);
const css=fs.readFileSync(require.resolve('../style.css'),'utf8');
// Fruit icons sit on transparent tiles with a fine neutral line, not colour blocks.
assert.match(css,/\.cell\.fruit-tile \{ background:transparent; border:1px solid #ffffff26; box-shadow:none;/);
assert.ok(!css.includes('--fruit-bg'));
assert.match(css,/brightness\(1\.18\) saturate\(1\)/);
assert.ok(!/\.cell\.type-\d+[^\n]*background/.test(css));
assert.ok(!css.includes('.fruit-mark'));
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const playScreen=html.split('</main>')[0];
assert.ok(!playScreen.includes('fruitLine'));
assert.ok(!playScreen.includes('scoreText'));
assert.ok(!playScreen.includes('missionStrip'));
assert.ok(!playScreen.includes('helpBtn'));
assert.ok(playScreen.includes('menuBtn'));
g.el.menu.listeners.click();assert.equal(g.el.menuModal.hidden,false);
g.el.menuClose.listeners.click();assert.equal(g.el.menuModal.hidden,true);
// Natural colours remain stable, and there are no extra markers on fruits.
g.state.level=403;g.startLevel();const before=Array.from(g.state.pool,type=>[type,g.fruitTone(type)]);
g.state.board[0][0]=null;g.refillBoard();g.render();
assert.deepEqual(Array.from(g.state.pool,type=>[type,g.fruitTone(type)]),before);
// Collapse conserves all remaining tile/lock pairs, including formerly-special IDs 5..8.
g.state.level=1;g.startLevel();empty(g);
for(let r=0;r<10;r++){g.state.board[r][0]=r;g.state.locks[r][0]=r%2?'ice':null;}
g.collapse();assert.equal(g.remainingCount(),10);assert.deepEqual(Array.from(g.state.board,v=>v[0]),[0,1,2,3,4,5,6,7,8,9]);
assert.equal(g.state.locks[9][0],'ice');
// Every special threshold produces exactly one replacement.
for(const [count,special] of [[2,null],[6,g.ROCKET],[10,g.BOMB],[20,g.SUPER_BOMB],[30,g.RAINBOW]]){
  g.state.level=1;g.startLevel();empty(g);
  for(let i=0;i<count;i++)g.state.board[9-Math.floor(i/8)][i%8]=0;
  act(g,9,0);
  assert.equal(g.remainingCount(),special==null?0:1);
  if(special!=null)assert.ok(g.state.board.flat().includes(special));
}
// Queued effects are unique and chain across bombs and rockets.
g.state.level=1;g.startLevel();empty(g);
g.state.board[9][0]=g.BOMB;g.state.board[9][1]=g.ROCKET;g.state.board[9][7]=g.BOMB;g.state.board[8][7]=0;
const chain=g.expandChain(g.actionAt(9,0));assert.equal(chain.chainCount,3);assert.equal(chain.cells.length,4);
act(g,9,0);assert.equal(g.remainingCount(),0);
// Null spaces are excluded when choosing rainbow colour.
g.state.level=1;g.startLevel();empty(g);g.state.board[9][0]=g.RAINBOW;g.state.board[9][1]=7;
assert.equal(g.actionAt(9,0).cells.length,2);
// Harvest counts the right fruit and immediately wins; repeated result checks do not duplicate rewards.
g.state.level=2;g.startLevel();empty(g);const harvest=g.state.goal.fruit;
g.state.goal.target=2;g.state.board[9][0]=harvest;g.state.board[9][1]=harvest;
act(g,9,0);assert.equal(g.state.collected,2);assert.equal(g.el.modalAction.dataset.win,'1');
const streak=g.state.streak;g.checkState();g.flush();assert.equal(g.state.streak,streak);
g.modalAction();assert.equal(g.state.level,3);
// Crate opening, replenishment, hammer move exemption, exhaustion and callback cancellation.
g.state.level=3;g.startLevel();empty(g);g.state.goal.target=1;
g.state.board[9][0]=0;g.state.board[9][1]=0;g.state.board[9][2]=g.CRATE;
act(g,9,0);assert.equal(g.state.cratesOpened,1);assert.equal(g.el.modalAction.dataset.win,'1');
g.state.level=4;g.startLevel();empty(g);g.state.board[9][0]=0;g.state.board[9][1]=0;
act(g,9,0);assert.equal(g.remainingCount(),80);assert.equal(g.state.moves,1);
g.executeAction({cells:[[9,0]],type:g.BOMB,label:'hammer',hammer:true},9,0);g.flush();assert.equal(g.state.moves,1);
g.state.moves=g.state.goal.limit;g.checkState();g.flush();assert.equal(g.el.modalAction.dataset.win,'0');
g.state.level=2;g.startLevel();empty(g);g.state.board[9][0]=0;g.state.board[9][1]=0;
g.executeAction(g.actionAt(9,0),9,0);g.startLevel();g.flush();assert.equal(g.remainingCount(),80);assert.equal(g.state.moves,0);
assert.doesNotThrow(()=>boot({level:5},true));
// A stranded objective cannot pass merely because the score is high.
g.state.level=2;g.startLevel();empty(g);g.state.board[9][0]=0;
g.state.shuffles=0;g.state.hammers=0;g.state.roundScore=99999;g.state.collected=0;
g.checkState();g.flush();assert.equal(g.el.modalAction.dataset.win,'0');
console.log('PASS: 1000 levels, 20-fruit rotation, old saves, collapse conservation, special thresholds, chain reactions, objectives, refill, moves, storage and stale timers');
