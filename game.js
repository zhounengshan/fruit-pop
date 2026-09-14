(() => {
  'use strict';

  const FRUITS = ['🍎', '🍊', '🍋', '🥝', '🍇'];
  const FRUIT_NAMES = ['红苹果', '橙子', '柠檬', '猕猴桃', '葡萄'];
  const BOMB = 5;
  const RAINBOW = 6;
  const SPECIALS = {
    [BOMB]: { icon: '💣', name: '炸弹果' },
    [RAINBOW]: { icon: '🌈', name: '彩虹果' }
  };
  const ENCOURAGEMENTS = {
    1: ['顺利过关！', '继续前进！', '节奏不错！'],
    2: ['太棒了！', '水果达人！', '势如破竹！'],
    3: ['完美清屏！', '三星高手！', '无懈可击！']
  };
  const STAGES = [
    { max: 20, name: '阳光果园', theme: 'orchard' },
    { max: 40, name: '热带海岛', theme: 'tropic' },
    { max: 60, name: '落日农场', theme: 'sunset' },
    { max: 80, name: '冰雪果境', theme: 'ice' },
    { max: 100, name: '星空果园', theme: 'space' }
  ];

  const state = {
    level: 1,
    score: 0,
    roundScore: 0,
    levelStartScore: 0,
    bonus: 0,
    remaining: 0,
    target: 500,
    rows: 10,
    cols: 8,
    board: [],
    shuffles: 3,
    locked: false,
    sound: true,
    vibrate: true,
    confirmTap: true,
    selected: null,
    starsByLevel: {},
    totalStars: 0,
    combo: 0,
    lastClearAt: 0
  };

  const $ = id => document.getElementById(id);
  const el = {
    board: $('board'),
    level: $('levelText'),
    score: $('scoreText'),
    target: $('targetText'),
    progress: $('progressBar'),
    roundScore: $('roundScoreText'),
    gap: $('gapText'),
    remaining: $('remainingText'),
    stars: $('starsText'),
    stageName: $('stageName'),
    shuffle: $('shuffleBtn'),
    shuffleCount: $('shuffleCount'),
    restart: $('restartBtn'),
    sound: $('soundBtn'),
    settings: $('settingsBtn'),
    combo: $('comboLabel'),
    tip: $('tip'),
    previewBar: $('previewBar'),
    previewText: $('previewText'),
    previewScore: $('previewScore'),
    modal: $('modal'),
    modalIcon: $('modalIcon'),
    modalTitle: $('modalTitle'),
    modalText: $('modalText'),
    modalBaseScore: $('modalBaseScore'),
    modalBonus: $('modalBonus'),
    modalScore: $('modalScore'),
    modalAction: $('modalAction'),
    resultStars: $('resultStars'),
    settingsModal: $('settingsModal'),
    soundToggle: $('soundToggle'),
    vibrateToggle: $('vibrateToggle'),
    confirmToggle: $('confirmToggle'),
    settingsClose: $('settingsClose')
  };

  let audio;

  function levelTarget(level) {
    return 500 + (level - 1) * 100;
  }

  function typeCount(level) {
    return level <= 10 ? 4 : 5;
  }

  function shuffleAllowance(level) {
    if (level <= 30) return 3;
    if (level <= 60) return 2;
    return 1;
  }

  function scoreFor(count) {
    const base = count * 5;
    if (count >= 30) return base * 4;
    if (count >= 20) return base * 3;
    if (count >= 10) return base * 2;
    return base;
  }

  function clearBonus(remaining) {
    return [2000, 1700, 1400, 1200, 1000, 850, 700, 550, 400, 250, 100][remaining] ?? 0;
  }

  function currentStage() {
    return STAGES.find(stage => state.level <= stage.max) || STAGES.at(-1);
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('fruit-pop-progress'));
      if (saved?.level) state.level = Math.min(100, Math.max(1, saved.level));
      if (Number.isFinite(saved?.score)) state.score = Math.max(0, saved.score);
      state.sound = saved?.sound !== false;
      state.vibrate = saved?.vibrate !== false;
      state.confirmTap = saved?.confirmTap !== false;
      if (saved?.starsByLevel && typeof saved.starsByLevel === 'object') state.starsByLevel = saved.starsByLevel;
      state.totalStars = Object.values(state.starsByLevel).reduce((sum, value) => sum + Number(value || 0), 0);
    } catch (error) {
      state.starsByLevel = {};
    }
    startLevel();
  }

  function save(savedScore = state.levelStartScore) {
    localStorage.setItem('fruit-pop-progress', JSON.stringify({
      level: state.level,
      score: savedScore,
      sound: state.sound,
      vibrate: state.vibrate,
      confirmTap: state.confirmTap,
      starsByLevel: state.starsByLevel
    }));
  }

  function makeBoard() {
    const count = typeCount(state.level);
    state.board = [];
    for (let row = 0; row < state.rows; row++) {
      state.board[row] = [];
      for (let col = 0; col < state.cols; col++) {
        if (col > 0 && Math.random() < .31) state.board[row][col] = state.board[row][col - 1];
        else if (row > 0 && Math.random() < .25) state.board[row][col] = state.board[row - 1][col];
        else state.board[row][col] = Math.floor(Math.random() * count);
      }
    }
    if (!hasMoves()) makeBoard();
  }

  function startLevel() {
    state.roundScore = 0;
    state.levelStartScore = state.score;
    state.bonus = 0;
    state.remaining = 0;
    state.target = levelTarget(state.level);
    state.shuffles = shuffleAllowance(state.level);
    state.locked = false;
    state.combo = 0;
    state.lastClearAt = 0;
    clearSelection();
    makeBoard();
    render();
    el.tip.textContent = state.confirmTap ? '首次点选预览，第二次确认消除' : '点击两个或更多相邻的同类水果';
  }

  function groupAt(row, col) {
    const type = state.board[row]?.[col];
    if (type == null || type >= BOMB) return [];
    const found = [];
    const seen = new Set([`${row},${col}`]);
    const queue = [[row, col]];
    while (queue.length) {
      const [currentRow, currentCol] = queue.pop();
      found.push([currentRow, currentCol]);
      [[currentRow - 1, currentCol], [currentRow + 1, currentCol], [currentRow, currentCol - 1], [currentRow, currentCol + 1]].forEach(([nextRow, nextCol]) => {
        const key = `${nextRow},${nextCol}`;
        if (nextRow >= 0 && nextRow < state.rows && nextCol >= 0 && nextCol < state.cols && !seen.has(key) && state.board[nextRow][nextCol] === type) {
          seen.add(key);
          queue.push([nextRow, nextCol]);
        }
      });
    }
    return found;
  }

  function bombCells(row, col) {
    const cells = [];
    for (let nextRow = row - 1; nextRow <= row + 1; nextRow++) {
      for (let nextCol = col - 1; nextCol <= col + 1; nextCol++) {
        if (nextRow >= 0 && nextRow < state.rows && nextCol >= 0 && nextCol < state.cols && state.board[nextRow][nextCol] != null) cells.push([nextRow, nextCol]);
      }
    }
    return cells;
  }

  function rainbowCells(row, col) {
    const counts = Array(FRUITS.length).fill(0);
    state.board.flat().forEach(value => { if (value >= 0 && value < FRUITS.length) counts[value]++; });
    const targetType = counts.indexOf(Math.max(...counts));
    const cells = [[row, col]];
    for (let nextRow = 0; nextRow < state.rows; nextRow++) {
      for (let nextCol = 0; nextCol < state.cols; nextCol++) {
        if (state.board[nextRow][nextCol] === targetType) cells.push([nextRow, nextCol]);
      }
    }
    return cells;
  }

  function actionAt(row, col) {
    const type = state.board[row]?.[col];
    if (type === BOMB) return { cells: bombCells(row, col), type, label: '炸弹果爆破' };
    if (type === RAINBOW) return { cells: rainbowCells(row, col), type, label: '彩虹果清除' };
    const cells = groupAt(row, col);
    return { cells, type, label: `连消 ${cells.length} 个` };
  }

  function hasMoves() {
    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) {
        const type = state.board[row][col];
        if (type === BOMB || type === RAINBOW || groupAt(row, col).length >= 2) return true;
      }
    }
    return false;
  }

  function remainingCount() {
    return state.board.flat().filter(value => value != null).length;
  }

  function render() {
    const selectedKeys = new Set((state.selected?.cells || []).map(([row, col]) => `${row},${col}`));
    const fragment = document.createDocumentFragment();
    el.board.style.setProperty('--cols', state.cols);
    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) {
        const button = document.createElement('button');
        const value = state.board[row][col];
        const isSpecial = value === BOMB || value === RAINBOW;
        const specialClass = value === BOMB ? ' special-bomb' : value === RAINBOW ? ' special-rainbow' : '';
        button.className = `cell${value == null ? ' empty' : isSpecial ? specialClass : ` type-${value}`}${selectedKeys.has(`${row},${col}`) ? ' selected' : ''}`;
        button.dataset.r = row;
        button.dataset.c = col;
        button.setAttribute('role', 'gridcell');
        const name = value == null ? '空格' : isSpecial ? SPECIALS[value].name : FRUIT_NAMES[value];
        const icon = value == null ? '' : isSpecial ? SPECIALS[value].icon : FRUITS[value];
        button.setAttribute('aria-label', name);
        button.innerHTML = icon ? `<span class="fruit">${icon}</span>` : '';
        fragment.appendChild(button);
      }
    }
    el.board.replaceChildren(fragment);
    const stage = currentStage();
    document.body.dataset.theme = stage.theme;
    el.stageName.textContent = `${stage.name} · 第${Math.ceil(state.level / 10)}阶段`;
    el.level.textContent = `${state.level} / 100`;
    el.score.textContent = state.score.toLocaleString();
    el.target.textContent = state.target.toLocaleString();
    el.roundScore.textContent = state.roundScore.toLocaleString();
    el.gap.textContent = Math.max(0, state.target - state.score).toLocaleString();
    el.remaining.textContent = remainingCount();
    el.stars.textContent = state.totalStars;
    el.progress.style.width = `${Math.min(100, state.score / state.target * 100)}%`;
    el.shuffleCount.textContent = `${state.shuffles} 次`;
    el.shuffle.disabled = state.shuffles <= 0;
    el.sound.textContent = state.sound ? '🔊' : '🔇';
  }

  function clearSelection() {
    state.selected = null;
    if (!el.previewBar) return;
    el.previewBar.classList.remove('ready');
    el.previewText.textContent = '先点选水果群，查看本次得分';
    el.previewScore.textContent = '';
  }

  function selectAction(action) {
    state.selected = action;
    el.previewBar.classList.add('ready');
    el.previewText.textContent = `${action.label}，再次点击确认`;
    el.previewScore.textContent = `+${scoreFor(action.cells.length)}`;
    render();
    softTone(action.cells.length);
  }

  function sameSelection(row, col) {
    return state.selected?.cells.some(([selectedRow, selectedCol]) => selectedRow === row && selectedCol === col);
  }

  function tapCell(event) {
    const button = event.target.closest('.cell');
    if (!button || state.locked) return;
    const row = Number(button.dataset.r);
    const col = Number(button.dataset.c);
    const action = actionAt(row, col);
    if (action.cells.length < 2 && action.type < BOMB) {
      clearSelection();
      render();
      buzz(80);
      el.tip.textContent = '至少要有两个相邻的同类水果';
      return;
    }
    if (state.confirmTap && !sameSelection(row, col)) {
      selectAction(action);
      return;
    }
    executeAction(state.confirmTap && state.selected ? state.selected : action, row, col);
  }

  function executeAction(action, originRow, originCol) {
    state.locked = true;
    const gain = scoreFor(action.cells.length);
    const now = Date.now();
    state.combo = now - state.lastClearAt < 2600 ? state.combo + 1 : 1;
    state.lastClearAt = now;
    state.roundScore += gain;
    state.score += gain;

    action.cells.forEach(([row, col]) => {
      const node = el.board.children[row * state.cols + col];
      node?.classList.add('popping');
      state.board[row][col] = null;
    });

    let createdSpecial = null;
    if (action.type < BOMB && action.cells.length >= 20) createdSpecial = RAINBOW;
    else if (action.type < BOMB && action.cells.length >= 10) createdSpecial = BOMB;
    if (createdSpecial != null) state.board[originRow][originCol] = createdSpecial;

    clearSelection();
    showCombo(action.cells.length, gain, action.type, createdSpecial);
    tone(action.cells.length, action.type >= BOMB);
    buzz(action.type >= BOMB ? [35, 35, 70] : 35);
    setTimeout(() => {
      collapse();
      render();
      state.locked = false;
      checkState();
    }, 260);
  }

  function collapse() {
    for (let col = 0; col < state.cols; col++) {
      const values = [];
      for (let row = state.rows - 1; row >= 0; row--) if (state.board[row][col] != null) values.push(state.board[row][col]);
      for (let row = state.rows - 1, index = 0; row >= 0; row--, index++) state.board[row][col] = index < values.length ? values[index] : null;
    }
    let writeCol = 0;
    for (let col = 0; col < state.cols; col++) {
      const used = state.board.some(row => row[col] != null);
      if (!used) continue;
      if (writeCol !== col) {
        for (let row = 0; row < state.rows; row++) {
          state.board[row][writeCol] = state.board[row][col];
          state.board[row][col] = null;
        }
      }
      writeCol++;
    }
  }

  function showCombo(count, gain, actionType, createdSpecial) {
    let label;
    if (actionType === BOMB) label = '💥 炸弹果';
    else if (actionType === RAINBOW) label = '🌈 彩虹清除';
    else if (count >= 30) label = '四倍奖励';
    else if (count >= 20) label = '三倍奖励';
    else if (count >= 10) label = '双倍奖励';
    else label = `连消 ${count}`;
    if (state.combo >= 3) label += ` · ${state.combo}连击`;
    if (createdSpecial === BOMB) label += ' · 生成炸弹';
    if (createdSpecial === RAINBOW) label += ' · 生成彩虹';
    el.combo.textContent = `${label}  +${gain}`;
    el.combo.classList.remove('show');
    void el.combo.offsetWidth;
    el.combo.classList.add('show');
  }

  function checkState() {
    if (!hasMoves()) finishRound();
  }

  function finishRound() {
    state.locked = true;
    clearSelection();
    state.remaining = remainingCount();
    state.bonus = clearBonus(state.remaining);
    state.score += state.bonus;
    render();
    if (state.bonus > 0) {
      el.combo.textContent = `剩余 ${state.remaining} 个 · 奖励 +${state.bonus}`;
      el.combo.classList.remove('show');
      void el.combo.offsetWidth;
      el.combo.classList.add('show');
    }
    setTimeout(() => showResult(state.score >= state.target), state.bonus > 0 ? 750 : 320);
  }

  function shuffle() {
    if (state.locked || state.shuffles <= 0) return;
    clearSelection();
    const values = state.board.flat().filter(value => value != null);
    for (let index = values.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [values[index], values[target]] = [values[target], values[index]];
    }
    let index = 0;
    for (let row = state.rows - 1; row >= 0; row--) {
      for (let col = 0; col < state.cols; col++) state.board[row][col] = index < values.length ? values[index++] : null;
    }
    state.shuffles--;
    if (!hasMoves() && values.length > 1) {
      const firstStandard = values.find(value => value < BOMB) ?? 0;
      state.board[state.rows - 1][0] = firstStandard;
      state.board[state.rows - 1][1] = firstStandard;
    }
    buzz(45);
    render();
    el.tip.textContent = '水果位置已重排';
    checkState();
  }

  function starRating(win) {
    if (!win) return 0;
    if (state.remaining === 0) return 3;
    if (state.remaining <= 5) return 2;
    return 1;
  }

  function showResult(win) {
    state.locked = true;
    const stars = starRating(win);
    el.modal.hidden = false;
    el.modalBaseScore.textContent = state.roundScore.toLocaleString();
    el.modalBonus.textContent = state.bonus.toLocaleString();
    el.modalScore.textContent = state.score.toLocaleString();
    el.resultStars.textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;

    if (win) {
      const previousStars = Number(state.starsByLevel[state.level] || 0);
      if (stars > previousStars) {
        state.starsByLevel[state.level] = stars;
        state.totalStars += stars - previousStars;
      }
      const finalLevel = state.level === 100;
      const milestone = state.level % 10 === 0;
      const pool = ENCOURAGEMENTS[stars];
      const cheer = pool[Math.floor(Math.random() * pool.length)];
      successTone(finalLevel || milestone);
      el.modalIcon.textContent = finalLevel ? '🏆' : milestone ? '🎁' : stars === 3 ? '👑' : '🎉';
      el.modalTitle.textContent = finalLevel ? '100关全部通关！' : milestone ? `第 ${state.level} 关里程碑！` : cheer;
      el.modalText.textContent = finalLevel
        ? `共获得 ${state.totalStars} 颗星，你是最强水果达人！`
        : `本页剩余 ${state.remaining} 个水果，获得 ${stars} 颗星。累计总分已达到目标！`;
      el.modalAction.textContent = finalLevel ? '从第1关再战' : '下一关';
      if (milestone || finalLevel || stars === 3) celebrate();
    } else {
      el.modalIcon.textContent = '🍎';
      el.modalTitle.textContent = '差一点，再试一次！';
      el.modalText.textContent = `累计总分还差 ${(state.target - state.score).toLocaleString()} 分；失败后本页得分不计入累计。`;
      el.modalAction.textContent = '重新挑战';
    }
    el.modalAction.dataset.win = win ? '1' : '0';
  }

  function celebrate() {
    const icons = ['🍎', '🍊', '🍋', '🥝', '🍇', '⭐'];
    for (let index = 0; index < 18; index++) {
      const piece = document.createElement('i');
      piece.className = 'celebration-piece';
      piece.textContent = icons[index % icons.length];
      piece.style.setProperty('--x', `${8 + Math.random() * 84}vw`);
      piece.style.setProperty('--delay', `${Math.random() * .35}s`);
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1800);
    }
  }

  function modalAction() {
    const win = el.modalAction.dataset.win === '1';
    el.modal.hidden = true;
    if (win) {
      if (state.level === 100) {
        state.level = 1;
        state.score = 0;
      } else {
        state.level++;
      }
      state.levelStartScore = state.score;
      save(state.score);
    } else {
      state.score = state.levelStartScore;
    }
    startLevel();
  }

  function restartLevel() {
    state.score = state.levelStartScore;
    startLevel();
  }

  function openSettings() {
    el.soundToggle.checked = state.sound;
    el.vibrateToggle.checked = state.vibrate;
    el.confirmToggle.checked = state.confirmTap;
    el.settingsModal.hidden = false;
  }

  function closeSettings() {
    state.sound = el.soundToggle.checked;
    state.vibrate = el.vibrateToggle.checked;
    state.confirmTap = el.confirmToggle.checked;
    el.settingsModal.hidden = true;
    clearSelection();
    save(state.levelStartScore);
    render();
    el.tip.textContent = state.confirmTap ? '首次点选预览，第二次确认消除' : '点击两个或更多相邻的同类水果';
  }

  function ensureAudio() {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  }

  function note(frequency, start, duration = .13, type = 'sine', volume = .055) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function softTone(size) {
    if (!state.sound) return;
    try {
      ensureAudio();
      note(180 + Math.min(size, 30) * 8, audio.currentTime, .07, 'sine', .025);
    } catch (error) {}
  }

  function tone(size, special = false) {
    if (!state.sound) return;
    try {
      ensureAudio();
      const now = audio.currentTime;
      note(220 + Math.min(size, 30) * 18, now, .11, special ? 'sawtooth' : 'sine');
      note(330 + Math.min(size, 30) * 15, now + .045, .13, 'triangle', .04);
    } catch (error) {}
  }

  function successTone(bigMoment) {
    if (!state.sound) return;
    try {
      ensureAudio();
      const now = audio.currentTime + .04;
      const notes = bigMoment ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
      notes.forEach((frequency, index) => note(frequency, now + index * .12, .24, 'triangle', .06));
    } catch (error) {}
  }

  function buzz(pattern) {
    if (state.vibrate && navigator.vibrate) navigator.vibrate(pattern);
  }

  el.board.addEventListener('click', tapCell);
  el.shuffle.addEventListener('click', shuffle);
  el.restart.addEventListener('click', restartLevel);
  el.modalAction.addEventListener('click', modalAction);
  el.settings.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', closeSettings);
  el.sound.addEventListener('click', () => {
    state.sound = !state.sound;
    el.soundToggle.checked = state.sound;
    save(state.levelStartScore);
    render();
  });

  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  load();
})();
