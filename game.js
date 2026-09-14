(() => {
  'use strict';
  const TYPES = ['🍎','🍊','🍋','🥝','🍇'];
  const FRUIT_NAMES = ['红苹果','橙子','柠檬','猕猴桃','葡萄'];
  const ENCOURAGEMENTS = ['太棒了！','势如破竹！','水果达人！','完美过关！','手速惊人！','继续冲关！'];
  const state = { level: 1, score: 0, roundScore: 0, levelStartScore: 0, bonus: 0, remaining: 0, target: 500, rows: 10, cols: 8, board: [], shuffles: 3, locked: false, sound: true };
  const $ = id => document.getElementById(id);
  const el = { board:$('board'), level:$('levelText'), score:$('scoreText'), target:$('targetText'), progress:$('progressBar'), shuffle:$('shuffleBtn'), shuffleCount:$('shuffleCount'), restart:$('restartBtn'), sound:$('soundBtn'), combo:$('comboLabel'), tip:$('tip'), modal:$('modal'), modalIcon:$('modalIcon'), modalTitle:$('modalTitle'), modalText:$('modalText'), modalBaseScore:$('modalBaseScore'), modalBonus:$('modalBonus'), modalScore:$('modalScore'), modalAction:$('modalAction') };
  let audio;

  function levelTarget(level){ return 500 + (level - 1) * 100; }
  function typeCount(){ return 5; }
  function scoreFor(count){ const base=count*5; if(count>=30)return base*4;if(count>=20)return base*3;if(count>=10)return base*2;return base; }
  function clearBonus(remaining){ return [2000,1700,1400,1200,1000,850,700,550,400,250,100][remaining] ?? 0; }
  function load(){
    try { const p=JSON.parse(localStorage.getItem('fruit-pop-progress')); if(p?.level) state.level=Math.min(100,Math.max(1,p.level));if(Number.isFinite(p?.score))state.score=Math.max(0,p.score);state.sound=p?.sound!==false; } catch(e){}
    startLevel();
  }
  function save(savedScore=state.levelStartScore){ localStorage.setItem('fruit-pop-progress',JSON.stringify({level:state.level,score:savedScore,sound:state.sound})); }
  function makeBoard(){
    const n=typeCount(state.level); state.board=[];
    for(let r=0;r<state.rows;r++){state.board[r]=[];for(let c=0;c<state.cols;c++){
      if(c>0 && Math.random()<.31) state.board[r][c]=state.board[r][c-1];
      else if(r>0 && Math.random()<.25) state.board[r][c]=state.board[r-1][c];
      else state.board[r][c]=Math.floor(Math.random()*n);
    }}
    if(!hasMoves()) makeBoard();
  }
  function startLevel(){
    state.roundScore=0;state.levelStartScore=state.score;state.bonus=0;state.remaining=0;state.target=levelTarget(state.level);state.shuffles=3;state.locked=false;makeBoard();render();el.tip.textContent='总分跨关累计，本页结束后统一结算';
  }
  function groupAt(row,col){
    const type=state.board[row]?.[col]; if(type==null)return[]; const found=[], seen=new Set([`${row},${col}`]), queue=[[row,col]];
    while(queue.length){ const [r,c]=queue.pop(); found.push([r,c]); [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr,nc])=>{ const k=`${nr},${nc}`; if(nr>=0&&nr<state.rows&&nc>=0&&nc<state.cols&&!seen.has(k)&&state.board[nr][nc]===type){seen.add(k);queue.push([nr,nc]);} }); }
    return found;
  }
  function hasMoves(){ for(let r=0;r<state.rows;r++)for(let c=0;c<state.cols;c++)if(groupAt(r,c).length>=2)return true; return false; }
  function render(){
    el.board.style.setProperty('--cols',state.cols); const frag=document.createDocumentFragment();
    for(let r=0;r<state.rows;r++)for(let c=0;c<state.cols;c++){ const b=document.createElement('button'),v=state.board[r][c]; b.className='cell'+(v==null?' empty':` type-${v}`); b.dataset.r=r;b.dataset.c=c;b.setAttribute('role','gridcell');b.setAttribute('aria-label',v==null?'空格':FRUIT_NAMES[v]);b.innerHTML=v==null?'':`<span class="fruit">${TYPES[v]}</span>`; frag.appendChild(b); }
    el.board.replaceChildren(frag); el.level.textContent=`${state.level} / 100`;el.score.textContent=state.score.toLocaleString();el.target.textContent=state.target.toLocaleString();el.progress.style.width=`${Math.min(100,state.score/state.target*100)}%`;el.shuffleCount.textContent=`${state.shuffles} 次`;el.shuffle.disabled=state.shuffles<=0;el.sound.textContent=state.sound?'🔊':'🔇';
  }
  function collapse(){
    for(let c=0;c<state.cols;c++){ const vals=[];for(let r=state.rows-1;r>=0;r--)if(state.board[r][c]!=null)vals.push(state.board[r][c]);for(let r=state.rows-1,i=0;r>=0;r--,i++)state.board[r][c]=i<vals.length?vals[i]:null; }
    let write=0;for(let c=0;c<state.cols;c++){let used=false;for(let r=0;r<state.rows;r++)if(state.board[r][c]!=null){used=true;break;}if(used){if(write!==c)for(let r=0;r<state.rows;r++){state.board[r][write]=state.board[r][c];state.board[r][c]=null;}write++;}}
  }
  function tapCell(e){ const b=e.target.closest('.cell');if(!b||state.locked)return;const group=groupAt(+b.dataset.r,+b.dataset.c);if(group.length<2){buzz(110);el.tip.textContent='至少要有两个相邻的同类水果';return;} state.locked=true;const gain=scoreFor(group.length);state.roundScore+=gain;state.score+=gain;group.forEach(([r,c])=>{ const node=el.board.children[r*state.cols+c];node.classList.add('popping');state.board[r][c]=null; }); showCombo(group.length,gain); tone(group.length);setTimeout(()=>{collapse();render();state.locked=false;checkState();},230); }
  function showCombo(count,gain){const bonus=count>=30?'四倍奖励':count>=20?'三倍奖励':count>=10?'双倍奖励':`连消 ${count}`;el.combo.textContent=`${bonus}  +${gain}`;el.combo.classList.remove('show');void el.combo.offsetWidth;el.combo.classList.add('show');}
  function checkState(){ if(!hasMoves())finishRound(); }
  function finishRound(){state.locked=true;state.remaining=state.board.flat().filter(v=>v!=null).length;state.bonus=clearBonus(state.remaining);state.score+=state.bonus;render();if(state.bonus>0){el.combo.textContent=`剩余奖励 +${state.bonus}`;el.combo.classList.remove('show');void el.combo.offsetWidth;el.combo.classList.add('show');}setTimeout(()=>showResult(state.score>=state.target),state.bonus>0?700:300);}
  function shuffle(){if(state.locked||state.shuffles<=0)return;const values=state.board.flat().filter(v=>v!=null);for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}let i=0;for(let r=state.rows-1;r>=0;r--)for(let c=0;c<state.cols;c++)state.board[r][c]=i<values.length?values[i++]:null;state.shuffles--;if(!hasMoves()&&values.length>1){const first=state.board[state.rows-1][0];state.board[state.rows-1][1]=first;}buzz(45);render();el.tip.textContent='水果位置已重排';checkState();}
  function showResult(win){state.locked=true;el.modal.hidden=false;el.modalBaseScore.textContent=state.roundScore.toLocaleString();el.modalBonus.textContent=state.bonus.toLocaleString();el.modalScore.textContent=state.score.toLocaleString();if(win){const last=state.level===100,cheer=ENCOURAGEMENTS[Math.floor(Math.random()*ENCOURAGEMENTS.length)];successTone(last);el.modalIcon.textContent=last?'🏆':'🎉';el.modalTitle.textContent=last?'100关全部通关！':cheer;el.modalText.textContent=last?'全部水果关卡已完成，你是最强水果达人！':`本页剩余 ${state.remaining} 个水果，累计总分达到目标！`;el.modalAction.textContent=last?'从第1关再战':'下一关';}else{el.modalIcon.textContent='🍎';el.modalTitle.textContent='差一点，再试一次！';el.modalText.textContent=`累计总分还差 ${(state.target-state.score).toLocaleString()} 分；失败后本页得分不计入累计。`;el.modalAction.textContent='重新挑战';}el.modalAction.dataset.win=win?'1':'0';}
  function modalAction(){const win=el.modalAction.dataset.win==='1';el.modal.hidden=true;if(win){if(state.level===100){state.level=1;state.score=0;}else state.level++;state.levelStartScore=state.score;save(state.score);}else state.score=state.levelStartScore;startLevel();}
  function restartLevel(){state.score=state.levelStartScore;startLevel();}
  function note(freq,start,duration=.13,type='sine',volume=.055){const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,start);g.gain.setValueAtTime(volume,start);g.gain.exponentialRampToValueAtTime(.001,start+duration);o.connect(g).connect(audio.destination);o.start(start);o.stop(start+duration);}
  function tone(size){if(!state.sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const now=audio.currentTime;note(220+Math.min(size,30)*18,now,.11,'sine');note(330+Math.min(size,30)*15,now+.045,.13,'triangle',.04);}catch(e){}}
  function successTone(finalLevel){if(!state.sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();const now=audio.currentTime+.04,notes=finalLevel?[523,659,784,1047,1319]:[523,659,784,1047];notes.forEach((n,i)=>note(n,now+i*.12,.24,'triangle',.06));}catch(e){}}
  function buzz(ms){if(state.sound&&navigator.vibrate)navigator.vibrate(ms);}
  el.board.addEventListener('click',tapCell);el.shuffle.addEventListener('click',shuffle);el.restart.addEventListener('click',restartLevel);el.modalAction.addEventListener('click',modalAction);el.sound.addEventListener('click',()=>{state.sound=!state.sound;save(state.levelStartScore);render();});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
  load();
})();
