(() => {
  'use strict';

  const FRUITS = ['🍎','🍊','🍋','🥝','🍇','🍓','🍌','🍉','🍍','🍑','🍒','🥭','🫐','🍐','🥥','🍈','🍏','🍅','🥑','🫒'];
  const FRUIT_NAMES = ['红苹果','橙子','柠檬','猕猴桃','葡萄','草莓','香蕉','西瓜','菠萝','桃子','樱桃','芒果','蓝莓','梨','椰子','蜜瓜','青苹果','番茄','牛油果','橄榄'];
  const UNLOCK_LEVELS = [1,1,1,1,1,5,10,15,20,30,40,50,65,80,100,120,140,160,180,200];
  // Choose one fruit per natural colour family; no extra symbols on the fruit.
  const FRUIT_TONES = [0,1,1,2,4,0,1,2,1,0,0,1,3,2,5,2,2,0,2,2];
  const BOMB = 100;
  const SUPER_BOMB = 101;
  const CRATE = 102;
  const RAINBOW = 103;
  const ROCKET = 104;
  const SPECIALS = {
    [BOMB]: { icon: '😈', name: '魔鬼水果炸弹' },
    [SUPER_BOMB]: { icon: '👹', name: '超级魔鬼炸弹' },
    [CRATE]: { icon: '📦', name: '水果箱' },
    [RAINBOW]: { icon: '🌈', name: '幸运彩虹果' },
    [ROCKET]: { icon: '🚀', name: '十字火箭' }
  };
  const ENCOURAGEMENTS = {
    1: ['顺利过关！', '继续前进！', '节奏不错！'],
    2: ['太棒了！', '水果达人！', '势如破竹！'],
    3: ['完美清屏！', '三星高手！', '无懈可击！']
  };
  const STAGES = [
    { name: '阳光果园', theme: 'orchard' },
    { name: '热带海岛', theme: 'tropic' },
    { name: '落日农场', theme: 'sunset' },
    { name: '冰雪果境', theme: 'ice' },
    { name: '星空果园', theme: 'space' }
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
    shufflesUsed: 0,
    locked: false,
    sound: true,
    music: true,
    musicVolume: .35,
    vibrate: true,
    confirmTap: false,
    selected: null,
    starsByLevel: {},
    totalStars: 0,
    combo: 0,
    maxCombo: 0,
    lastClearAt: 0,
    feverMoves: 0,
    specialsCreated: 0,
    locks: [],
    obstacle: null,
    levelReward: null,
    rewardChoice: null,
    streak: 0,
    bestStreak: 0,
    highestLevel: 1,
    bestCombo: 0,
    perfectClears: 0,
    bestSingleClear: 0,
    boss: null,
    pool: [], goal: null, moves: 0, collected: 0, cratesOpened: 0,
    cleared: 0, hammers: 2, hammerArmed: false, roundToken: 0, finished: false
  };

  const $ = id => document.getElementById(id);
  const el = {
    board: $('board'), level: $('levelText'), score: $('scoreText'), target: $('targetText'),
    progress: $('progressBar'), roundScore: $('roundScoreText'), gap: $('gapText'),
    remaining: $('remainingText'), stars: $('starsText'), stageName: $('stageName'),
    shuffle: $('shuffleBtn'), shuffleCount: $('shuffleCount'), restart: $('restartBtn'),
    sound: $('soundBtn'), music: $('musicBtn'), settings: $('settingsBtn'), combo: $('comboLabel'),
    tip: $('tip'), previewBar: $('previewBar'), previewText: $('previewText'), previewScore: $('previewScore'),
    missionStrip: $('missionStrip'), missionText: $('missionText'), missionStatus: $('missionStatus'),
    feverPanel: $('feverPanel'), feverLabel: $('feverLabel'), feverBar: $('feverBar'),
    bossPanel: $('bossPanel'), bossIcon: $('bossIcon'), bossName: $('bossName'), bossTarget: $('bossTarget'),
    bossBar: $('bossBar'), bossHp: $('bossHp'), modal: $('modal'), modalIcon: $('modalIcon'),
    modalTitle: $('modalTitle'), modalText: $('modalText'), modalBaseScore: $('modalBaseScore'),
    modalBonus: $('modalBonus'), modalMission: $('modalMission'), modalScore: $('modalScore'),
    modalAction: $('modalAction'), resultStars: $('resultStars'), settingsModal: $('settingsModal'),
    musicToggle: $('musicToggle'), soundToggle: $('soundToggle'), vibrateToggle: $('vibrateToggle'),
    confirmToggle: $('confirmToggle'), musicVolume: $('musicVolume'), settingsClose: $('settingsClose'),
    collection: $('collectionBtn'), collectionModal: $('collectionModal'), collectionClose: $('collectionClose'),
    collectionItems: $('collectionItems'), records: $('recordsText'), streak: $('streakText'),
    obstacleHint: $('obstacleHint'), goalTitle: $('goalTitle'), goalText: $('goalText'),
    goalProgress: $('goalProgress'), moves: $('movesText'),
    menu: $('menuBtn'), menuModal: $('menuModal'), menuClose: $('menuClose'),
    hammer: $('hammerBtn'), hammerCount: $('hammerCount'), help: $('helpBtn'),
    helpModal: $('helpModal'), helpClose: $('helpClose'), settle: $('settleBtn')
  };

  let audio;
  const musicPlayer = new Audio();
  musicPlayer.loop = true;
  musicPlayer.preload = 'auto';

  function levelTarget(level) {
    return 500 + (level - 1) * 100;
  }

  function typeCount(level) {
    return level < 10 ? 4 : level < 80 ? 5 : 6;
  }

  function fruitPool(level) {
    const unlocked = UNLOCK_LEVELS.map((at, type) => ({at, type})).filter(item => item.at <= level).map(item => item.type);
    const count = Math.min(typeCount(level), new Set(unlocked.map(type => FRUIT_TONES[type])).size);
    const newest = level >= 200 ? unlocked[Math.floor((level - 200) / 3) % unlocked.length] : unlocked[unlocked.length - 1];
    const start = Math.floor((level - 1) / 3) % unlocked.length;
    const pool = [newest];
    for (let offset = 0; pool.length < count; offset++) {
      const type = unlocked[(start + offset) % unlocked.length];
      if (!pool.some(other => FRUIT_TONES[other] === FRUIT_TONES[type])) pool.push(type);
    }
    return pool;
  }

  function randomFruit() {
    return state.pool[Math.floor(Math.random() * state.pool.length)];
  }

  function fruitTone(type) { return FRUIT_TONES[type]; }

  function goalFor(level) {
    const tier = Math.min(8, Math.floor(level / 30));
    if (level % 10 === 0) return { kind: 'boss', name: '👾 巨兽讨伐', limit: 30, refill: true, target: 0 };
    const kind = ['classic', 'harvest', 'rescue', 'bloom', 'sprint'][(level - 1) % 5];
    if (kind === 'harvest') return { kind, name: '🧺 水果订单', limit: 24, refill: true, target: 16 + tier * 2, fruit: state.pool[(level - 1) % state.pool.length] };
    if (kind === 'rescue') return { kind, name: '📦 宝箱营救', limit: 26, refill: true, target: 4 + Math.min(4, tier) };
    if (kind === 'bloom') return { kind, name: '🌱 丰收接力', limit: 26, refill: true, target: 90 + tier * 8 };
    if (kind === 'sprint') return { kind, name: '⚡ 步数挑战', limit: 16, refill: true, target: 400 + tier * 50 };
    return { kind, name: '🍃 经典清盘', limit: null, refill: false, target: 250 + tier * 30 };
  }

  function goalValue() {
    if (state.goal.kind === 'harvest') return state.collected;
    if (state.goal.kind === 'rescue') return state.cratesOpened;
    if (state.goal.kind === 'bloom') return state.cleared;
    if (state.goal.kind === 'boss') return state.boss ? state.boss.maxHp - state.boss.hp : 0;
    return state.roundScore;
  }

  function goalTarget() {
    return state.goal.kind === 'boss' ? state.boss.maxHp : state.goal.target;
  }

  function goalWon() { return goalValue() >= goalTarget(); }

  function goalDescription() {
    if (state.goal.kind === 'harvest') return `收集 ${fruitLook(state.goal.fruit).icon} ${fruitLook(state.goal.fruit).name} ${state.goal.target} 个`;
    if (state.goal.kind === 'rescue') return `打开 ${state.goal.target} 个水果箱；消旁边一组或用特效`;
    if (state.goal.kind === 'bloom') return `累计消除 ${state.goal.target} 个水果；新水果持续落下`;
    if (state.goal.kind === 'boss') return `消除 ${fruitLook(state.boss.fruit).icon} 攻击巨兽；新水果持续落下`;
    return state.goal.kind === 'classic' ? `完成清盘结算，单关得分达到 ${state.goal.target}` : `${state.goal.limit} 步内获得 ${state.goal.target} 分`;
  }

  function refillBoard() {
    for (let row = state.rows - 1; row >= 0; row--) {
      for (let col = 0; col < state.cols; col++) {
        if (state.board[row][col] == null) {
          const below = state.board[row + 1]?.[col];
          state.board[row][col] = below != null && below < BOMB && Math.random() < .35 ? below : randomFruit();
          state.locks[row][col] = null;
        }
      }
    }
  }

  function gameplayTip() {
    return '6～9个得🚀 · 10～19个得😈 · 20～29个得👹 · 30个以上得🌈；特效可连锁';
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
    return STAGES[Math.floor((state.level - 1) / 20) % STAGES.length];
  }

  function fruitLook(type) {
    return { icon: FRUITS[type], name: FRUIT_NAMES[type] };
  }

  function obstacleFor(level) {
    if (level < 12 || level % 10 === 0) return null;
    const kinds = ['ice', 'vine', 'crate'];
    return kinds[Math.floor((level - 12) / 3) % kinds.length];
  }

  function missionFor(level) {
    const missions = [
      { id: 'lowRemain', text: '剩余不超过5个水果' },
      { id: 'noShuffle', text: '不使用水果重排' },
      { id: 'special', text: '制造至少1个特殊水果' },
      { id: 'combo', text: '完成5连击' }
    ];
    return missions[(level - 1) % missions.length];
  }

  function missionComplete(final = false) {
    const mission = missionFor(state.level);
    if (mission.id === 'lowRemain') return remainingCount() <= 5;
    if (mission.id === 'noShuffle') return final && state.shufflesUsed === 0;
    if (mission.id === 'special') return state.specialsCreated >= 1;
    return state.maxCombo >= 5;
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('fruit-pop-progress'));
      if (Number.isSafeInteger(saved?.level) && saved.level > 0) state.level = saved.level;
      if (Number.isFinite(saved?.score)) state.score = Math.max(0, saved.score);
      state.sound = saved?.sound !== false;
      state.music = saved?.music !== false;
      state.vibrate = saved?.vibrate !== false;
      state.confirmTap = saved?.uiVersion === 4 ? saved?.confirmTap === true : false;
      if (Number.isFinite(saved?.musicVolume)) state.musicVolume = Math.min(1, Math.max(0, saved.musicVolume));
      if (saved?.starsByLevel && typeof saved.starsByLevel === 'object') state.starsByLevel = saved.starsByLevel;
      state.totalStars = Object.values(state.starsByLevel).reduce((sum, value) => sum + Number(value || 0), 0);
      for (const key of ['streak', 'bestStreak', 'highestLevel', 'bestCombo', 'perfectClears', 'bestSingleClear']) {
        if (Number.isSafeInteger(saved?.[key]) && saved[key] >= 0) state[key] = saved[key];
      }
      if (['bomb', 'rainbow', 'shuffle'].includes(saved?.levelReward)) state.levelReward = saved.levelReward;
    } catch (error) {
      state.starsByLevel = {};
    }
    startLevel();
  }

  function save(savedScore = state.levelStartScore) {
    try { localStorage.setItem('fruit-pop-progress', JSON.stringify({
      level: state.level,
      score: savedScore,
      sound: state.sound,
      music: state.music,
      musicVolume: state.musicVolume,
      vibrate: state.vibrate,
      confirmTap: state.confirmTap,
      uiVersion: 4,
      starsByLevel: state.starsByLevel,
      levelReward: state.levelReward,
      streak: state.streak,
      bestStreak: state.bestStreak,
      highestLevel: state.highestLevel,
      bestCombo: state.bestCombo,
      perfectClears: state.perfectClears,
      bestSingleClear: state.bestSingleClear
    })); } catch (error) { el.tip.textContent = '浏览器暂时无法保存进度，本次游戏仍可继续。'; }
  }

  function setupBoss() {
    if (state.level % 10 !== 0) {
      state.boss = null;
      return;
    }
    const stageNumber = state.level / 10;
    const maxHp = Math.min(36, 8 + stageNumber);
    const fruit = state.pool[(stageNumber - 1) % state.pool.length];
    state.boss = { maxHp, hp: maxHp, fruit, name: `第${stageNumber}号水果巨兽` };
  }

  function makeBoard() {
    state.board = [];
    state.locks = [];
    for (let row = 0; row < state.rows; row++) {
      state.board[row] = [];
      state.locks[row] = Array(state.cols).fill(null);
      for (let col = 0; col < state.cols; col++) {
        if (col > 0 && Math.random() < .31) state.board[row][col] = state.board[row][col - 1];
        else if (row > 0 && Math.random() < .25) state.board[row][col] = state.board[row - 1][col];
        else state.board[row][col] = randomFruit();
      }
    }
    if (state.boss) {
      let targetCount = state.board.flat().filter(value => value === state.boss.fruit).length;
      for (let row = state.rows - 1; row >= 0 && targetCount < state.boss.maxHp; row--) {
        for (let col = 0; col < state.cols && targetCount < state.boss.maxHp; col++) {
          if (state.board[row][col] !== state.boss.fruit) {
            state.board[row][col] = state.boss.fruit;
            targetCount++;
          }
        }
      }
    }
    if (state.obstacle || state.goal.kind === 'rescue') {
      const count = state.goal.kind === 'rescue' ? state.goal.target : Math.min(8, 2 + Math.floor(state.level / 25));
      const candidates = [];
      for (let row = 2; row < state.rows - 1; row++) {
        for (let col = 0; col < state.cols; col++) candidates.push([row, col]);
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      for (const [row, col] of candidates.slice(0, count)) {
        if (state.obstacle === 'crate' || state.goal.kind === 'rescue') state.board[row][col] = CRATE;
        else state.locks[row][col] = state.obstacle;
      }
    }
    if (state.levelReward === 'bomb' || state.levelReward === 'rainbow') {
      state.board[0][Math.floor(state.cols / 2)] = state.levelReward === 'bomb' ? BOMB : RAINBOW;
      state.locks[0][Math.floor(state.cols / 2)] = null;
    }
    if (!hasMoves()) {
      state.board[state.rows - 1][0] = state.pool[0];
      state.board[state.rows - 1][1] = state.pool[0];
      state.locks[state.rows - 1][0] = state.locks[state.rows - 1][1] = null;
    }
  }

  function startLevel() {
    state.roundToken++;
    state.finished = false;
    state.moves = 0;
    state.collected = state.cratesOpened = state.cleared = 0;
    state.hammers = 2;
    state.hammerArmed = false;
    state.pool = fruitPool(state.level);
    state.goal = goalFor(state.level);
    state.roundScore = 0;
    state.levelStartScore = state.score;
    state.bonus = 0;
    state.remaining = 0;
    state.target = levelTarget(state.level);
    state.shuffles = shuffleAllowance(state.level) + (state.levelReward === 'shuffle' ? 2 : 0);
    state.shufflesUsed = 0;
    state.locked = false;
    state.combo = 0;
    state.maxCombo = 0;
    state.lastClearAt = 0;
    state.feverMoves = 0;
    state.specialsCreated = 0;
    state.obstacle = state.goal.kind === 'rescue' ? 'crate' : obstacleFor(state.level);
    el.modal.hidden = true;
    clearSelection();
    setupBoss();
    makeBoard();
    state.highestLevel = Math.max(state.highestLevel, state.level);
    render();
    save(state.levelStartScore);
    if (!musicPlayer.paused) syncMusicTrack(true);
    el.tip.textContent = gameplayTip();
  }

  function groupAt(row, col) {
    const type = state.board[row]?.[col];
    if (type == null || type >= BOMB || state.locks[row]?.[col]) return [];
    const found = [];
    const seen = new Set([`${row},${col}`]);
    const queue = [[row, col]];
    while (queue.length) {
      const [currentRow, currentCol] = queue.pop();
      found.push([currentRow, currentCol]);
      [[currentRow - 1, currentCol], [currentRow + 1, currentCol], [currentRow, currentCol - 1], [currentRow, currentCol + 1]].forEach(([nextRow, nextCol]) => {
        const key = `${nextRow},${nextCol}`;
        if (nextRow >= 0 && nextRow < state.rows && nextCol >= 0 && nextCol < state.cols && !seen.has(key) && state.board[nextRow][nextCol] === type && !state.locks[nextRow][nextCol]) {
          seen.add(key);
          queue.push([nextRow, nextCol]);
        }
      });
    }
    return found;
  }

  function adjacentSpecial(row, col, wanted) {
    for (const [nextRow, nextCol] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
      if (nextRow >= 0 && nextRow < state.rows && nextCol >= 0 && nextCol < state.cols && state.board[nextRow][nextCol] === wanted) return [nextRow, nextCol];
    }
    return null;
  }

  function cellsAround(centers, radius) {
    const keys = new Set();
    centers.forEach(([centerRow, centerCol]) => {
      for (let row = centerRow - radius; row <= centerRow + radius; row++) {
        for (let col = centerCol - radius; col <= centerCol + radius; col++) {
          if (row >= 0 && row < state.rows && col >= 0 && col < state.cols && state.board[row][col] != null) keys.add(`${row},${col}`);
        }
      }
    });
    return [...keys].map(key => key.split(',').map(Number));
  }

  function mostCommonFruit() {
    const counts = Array(FRUITS.length).fill(0);
    state.board.flat().forEach(value => { if (value != null && value >= 0 && value < FRUITS.length) counts[value]++; });
    return counts.indexOf(Math.max(...counts));
  }

  function fruitCells(type) {
    const cells = [];
    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) if (state.board[row][col] === type) cells.push([row, col]);
    }
    return cells;
  }

  function allCells() {
    const cells = [];
    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) if (state.board[row][col] != null) cells.push([row, col]);
    }
    return cells;
  }

  function actionAt(row, col) {
    const type = state.board[row]?.[col];
    if (type == null) return { cells: [], type, label: '空格' };
    if (type === ROCKET) {
      const cells = allCells().filter(([r, c]) => r === row || c === col);
      return { cells, type, label: '十字火箭：整行＋整列' };
    }
    if (type === RAINBOW) {
      const target = mostCommonFruit();
      return { cells: [[row, col], ...fruitCells(target)], type, label: `幸运彩虹清除${fruitLook(target).name}` };
    }
    if (type === CRATE || state.locks[row]?.[col]) return { cells: [], type, label: '先消除旁边的水果来解锁' };
    if (type === BOMB) {
      const superBomb = adjacentSpecial(row, col, SUPER_BOMB);
      if (superBomb) return { cells: cellsAround([[row, col], superBomb], 3), type, comboType: 'devil-super', label: '魔鬼＋超级：末日爆破' };
      const secondBomb = adjacentSpecial(row, col, BOMB);
      if (secondBomb) return { cells: cellsAround([[row, col], secondBomb], 2), type, comboType: 'devil-devil', label: '双魔鬼大爆破' };
      return { cells: cellsAround([[row, col]], 1), type, label: '魔鬼炸弹爆破' };
    }
    if (type === SUPER_BOMB) {
      const secondSuper = adjacentSpecial(row, col, SUPER_BOMB);
      if (secondSuper) return { cells: allCells(), type, comboType: 'super-super', label: '双超级魔鬼：全屏毁灭' };
      const bomb = adjacentSpecial(row, col, BOMB);
      if (bomb) return { cells: cellsAround([[row, col], bomb], 3), type, comboType: 'devil-super', label: '超级＋魔鬼：末日爆破' };
      return { cells: cellsAround([[row, col]], 2), type, label: '超级魔鬼爆破' };
    }
    const cells = groupAt(row, col);
    return { cells, type, label: `连消 ${cells.length} 个` };
  }

  function expandChain(action) {
    const keys = new Set(action.cells.map(([r, c]) => `${r},${c}`));
    const queue = [...action.cells];
    const activated = new Set();
    while (queue.length) {
      const [row, col] = queue.pop();
      const type = state.board[row]?.[col];
      const key = `${row},${col}`;
      if (![BOMB, SUPER_BOMB, RAINBOW, ROCKET].includes(type) || activated.has(key)) continue;
      activated.add(key);
      for (const [r, c] of actionAt(row, col).cells) {
        const next = `${r},${c}`;
        if (!keys.has(next)) { keys.add(next); queue.push([r, c]); }
      }
    }
    return { ...action, cells: [...keys].map(key => key.split(',').map(Number)), chainCount: activated.size };
  }

  function hasMoves() {
    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) {
        const type = state.board[row][col];
        if ([BOMB, SUPER_BOMB, RAINBOW, ROCKET].includes(type) || groupAt(row, col).length >= 2) return true;
      }
    }
    return false;
  }

  function remainingCount() {
    return state.board.flat().filter(value => value != null).length;
  }

  function missionProgressText() {
    const mission = missionFor(state.level);
    if (mission.id === 'lowRemain') return `${remainingCount()}个剩余`;
    if (mission.id === 'noShuffle') return state.shufflesUsed ? '已使用重排' : '保持中';
    if (mission.id === 'special') return `${state.specialsCreated}/1`;
    return `${Math.min(5, state.maxCombo)}/5`;
  }

  function render() {
    const selectedKeys = new Set((state.selected?.cells || []).map(([row, col]) => `${row},${col}`));
    const fragment = document.createDocumentFragment();
    el.board.style.setProperty('--cols', state.cols);
    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) {
        const button = document.createElement('button');
        const value = state.board[row][col];
        const isSpecial = value != null && value >= BOMB;
        const specialClass = value === BOMB ? ' special-devil' : value === SUPER_BOMB ? ' special-super-devil' : value === CRATE ? ' special-crate' : value === RAINBOW ? ' special-rainbow' : value === ROCKET ? ' special-rocket' : '';
        const lock = state.locks[row]?.[col];
        const tone = !isSpecial && value != null ? fruitTone(value) : -1;
        button.className = `cell${value == null ? ' empty' : isSpecial ? specialClass : ` type-${value} fruit-tile tone-${tone}`}${lock ? ` locked-${lock}` : ''}${selectedKeys.has(`${row},${col}`) ? ' selected' : ''}`;
        button.dataset.r = row;
        button.dataset.c = col;
        button.dataset.type = value == null ? '' : value;
        button.setAttribute('role', 'gridcell');
        const look = !isSpecial && value != null ? fruitLook(value) : null;
        const name = value == null ? '空格' : isSpecial ? SPECIALS[value].name : look.name;
        const icon = value == null ? '' : isSpecial ? SPECIALS[value].icon : look.icon;
        button.setAttribute('aria-label', lock ? `${lock === 'ice' ? '冰冻' : '藤蔓锁住'}的${name}` : name);
        button.innerHTML = icon ? `<span class="fruit">${icon}</span>` : '';
        fragment.appendChild(button);
      }
    }
    el.board.replaceChildren(fragment);
    const stage = currentStage();
    document.body.dataset.theme = stage.theme;
    document.body.classList.toggle('fever', state.feverMoves > 0);
    el.stageName.textContent = `${stage.name} · 第${Math.ceil(state.level / 10)}阶段`;
    el.level.textContent = `第 ${state.level} 关`;
    el.score.textContent = state.score.toLocaleString();
    el.target.textContent = `${goalTarget().toLocaleString()}${['classic','sprint'].includes(state.goal.kind) ? '分' : '个'}`;
    el.roundScore.textContent = state.roundScore.toLocaleString();
    el.gap.textContent = Math.max(0, goalTarget() - goalValue()).toLocaleString();
    el.remaining.textContent = remainingCount();
    el.stars.textContent = state.totalStars;
    el.streak.textContent = `🔥 连胜 ${state.streak} · 最高 ${state.bestStreak}`;
    el.obstacleHint.textContent = state.obstacle === 'ice' ? '🧊 冰冻水果：消除旁边一组来破冰'
      : state.obstacle === 'vine' ? '🌿 藤蔓锁：消除旁边一组来解锁'
      : state.obstacle === 'crate' ? '📦 水果箱：消除旁边一组或用炸弹打开' : '';
    el.obstacleHint.hidden = !state.obstacle;
    el.progress.style.width = `${Math.min(100, goalValue() / goalTarget() * 100)}%`;
    el.goalTitle.textContent = state.goal.kind === 'harvest' ? `🧺 收集 ${FRUITS[state.goal.fruit]}`
      : state.goal.kind === 'boss' ? `👾 消除 ${FRUITS[state.boss.fruit]} 攻击`
      : state.goal.kind === 'bloom' ? '🌱 消除水果' : state.goal.name;
    el.goalText.textContent = goalDescription();
    el.goalProgress.textContent = `${goalValue()} / ${goalTarget()} ${['classic','sprint'].includes(state.goal.kind) ? '分' : '个'}`;
    el.moves.textContent = state.goal.limit == null ? '不限步数' : `剩余 ${Math.max(0, state.goal.limit - state.moves)} 步`;
    el.hammerCount.textContent = `${state.hammers} 次`;
    el.hammer.disabled = state.hammers <= 0 || state.finished;
    el.hammer.setAttribute('aria-pressed', String(state.hammerArmed));
    el.settle.hidden = state.goal.kind !== 'classic' || hasMoves();
    el.settle.disabled = state.locked || hasMoves();
    el.shuffleCount.textContent = `${state.shuffles} 次`;
    el.shuffle.disabled = state.shuffles <= 0;
    el.sound.textContent = state.sound ? '🔊' : '🔇';
    el.music.textContent = state.music ? '🎵' : '🚫';
    musicPlayer.volume = state.musicVolume * .72;
    musicPlayer.playbackRate = state.feverMoves > 0 ? 1.08 : 1;

    const mission = missionFor(state.level);
    const missionDone = missionComplete(false);
    el.missionText.textContent = mission.text;
    el.missionStatus.textContent = missionDone ? '已完成' : missionProgressText();
    el.missionStrip.classList.toggle('done', missionDone);

    const feverEnergy = state.feverMoves > 0 ? 5 : Math.min(5, state.combo);
    el.feverPanel.hidden = state.feverMoves <= 0;
    el.feverBar.style.width = `${feverEnergy * 20}%`;
    el.feverLabel.textContent = state.feverMoves > 0 ? `🔥 狂热模式 · 剩余${state.feverMoves}次` : `🔥 狂热能量 ${feverEnergy} / 5`;

    el.bossPanel.hidden = !state.boss;
    if (state.boss) {
      el.bossName.textContent = state.boss.name;
      el.bossTarget.textContent = `消除 ${fruitLook(state.boss.fruit).icon} 攻击`;
      el.bossHp.textContent = `生命 ${state.boss.hp} / ${state.boss.maxHp}`;
      el.bossBar.style.width = `${state.boss.hp / state.boss.maxHp * 100}%`;
      el.bossIcon.textContent = state.boss.hp > 0 ? '👾' : '💥';
    }
  }

  function clearSelection() {
    state.selected = null;
    if (!el.previewBar) return;
    el.previewBar.classList.remove('ready');
    el.previewBar.hidden = true;
    el.previewText.textContent = state.confirmTap ? '先点选水果群，查看本次得分' : '点击同类水果，连续消除可进入狂热模式';
    el.previewScore.textContent = '';
  }

  function actionGain(action) {
    return scoreFor(action.scoreCount ?? action.cells.length);
  }

  function selectAction(action) {
    state.selected = action;
    el.previewBar.classList.add('ready');
    el.previewBar.hidden = false;
    el.previewText.textContent = `${action.label}，再次点击确认`;
    el.previewScore.textContent = `+${actionGain(action)}`;
    render();
    softTone(action.cells.length);
  }

  function sameSelection(row, col) {
    return state.selected?.cells.some(([selectedRow, selectedCol]) => selectedRow === row && selectedCol === col);
  }

  function tapCell(event) {
    startMusic();
    const button = event.target.closest('.cell');
    if (!button || state.locked) return;
    const row = Number(button.dataset.r);
    const col = Number(button.dataset.c);
    if (state.board[row]?.[col] == null) return;
    if (state.hammerArmed) {
      state.hammers--;
      state.hammerArmed = false;
      executeAction(expandChain({cells:[[row,col]],type:BOMB,label:'🔨 锤子破除', hammer:true}),row,col);
      return;
    }
    const action = expandChain(actionAt(row, col));
    if (action.cells.length < 2 && ![BOMB, SUPER_BOMB, RAINBOW, ROCKET].includes(action.type)) {
      clearSelection();
      render();
      buzz(80);
      el.tip.textContent = action.type === CRATE || state.locks[row]?.[col] ? '消除旁边的水果，或使用炸弹打开障碍' : '至少要有两个相邻的同类水果';
      return;
    }
    if (state.confirmTap && !sameSelection(row, col)) {
      selectAction(action);
      return;
    }
    executeAction(state.confirmTap && state.selected ? state.selected : action, row, col);
  }

  function updateCombo() {
    const now = Date.now();
    state.combo = now - state.lastClearAt < 4000 ? state.combo + 1 : 1;
    state.lastClearAt = now;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const wasFever = state.feverMoves > 0;
    if (wasFever) state.feverMoves--;
    else if (state.combo >= 5) {
      state.feverMoves = 5;
      feverTone();
    }
  }

  function damageBoss(removedValues) {
    if (!state.boss || state.boss.hp <= 0) return 0;
    const damage = removedValues.filter(value => value === state.boss.fruit).length;
    if (damage > 0) {
      state.boss.hp = Math.max(0, state.boss.hp - damage);
      if (state.boss.hp === 0) bossDefeatTone();
    }
    return damage;
  }

  function executeAction(action, originRow, originCol) {
    state.locked = true;
    if (!action.hammer) state.moves++;
    const token = state.roundToken;
    const originalCount = action.cells.filter(([row, col]) => state.board[row]?.[col] != null && state.board[row][col] < BOMB).length;
    const removedKeys = new Set(action.cells.map(([row, col]) => `${row},${col}`));
    if (action.type < BOMB) {
      for (const [row, col] of action.cells) {
        for (const [nr, nc] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
          if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols || removedKeys.has(`${nr},${nc}`)) continue;
          if (state.locks[nr][nc]) state.locks[nr][nc] = null;
          else if (state.board[nr][nc] === CRATE) {
            removedKeys.add(`${nr},${nc}`);
            action.cells.push([nr, nc]);
          }
        }
      }
      action.scoreCount = originalCount;
    }
    state.bestSingleClear = Math.max(state.bestSingleClear, originalCount);
    const gain = actionGain(action);
    const removedValues = action.cells.map(([row, col]) => state.board[row]?.[col]).filter(value => value != null);
    state.collected += removedValues.filter(value => value === state.goal.fruit).length;
    state.cratesOpened += removedValues.filter(value => value === CRATE).length;
    state.cleared += removedValues.filter(value => value < BOMB).length;
    updateCombo();
    state.roundScore += gain;
    state.score += gain;
    celebrateClear(originRow, originCol, action, gain);

    action.cells.forEach(([row, col]) => {
      const node = el.board.children[row * state.cols + col];
      node?.classList.add('popping');
      state.board[row][col] = null;
      state.locks[row][col] = null;
    });

    let createdSpecial = null;
    if (action.type < BOMB) {
      if (originalCount >= 30) createdSpecial = RAINBOW;
      else if (originalCount >= 20) createdSpecial = SUPER_BOMB;
      else if (originalCount >= 10) createdSpecial = BOMB;
      else if (originalCount >= 6) createdSpecial = ROCKET;
      if (createdSpecial != null) {
        state.board[originRow][originCol] = createdSpecial;
        state.locks[originRow][originCol] = null;
        state.specialsCreated++;
      }
    }

    const bossDamage = damageBoss(removedValues);
    state.bestCombo = Math.max(state.bestCombo, state.maxCombo);
    clearSelection();
    showCombo(action, gain, createdSpecial, bossDamage);
    tone(action.cells.length, action.type >= BOMB || Boolean(action.comboType));
    buzz(action.type >= BOMB ? [35, 35, 70] : 35);
    setTimeout(() => {
      if (token !== state.roundToken) return;
      collapse();
      if (state.goal.refill && !goalWon()) refillBoard();
      render();
      state.locked = false;
      el.settle.disabled = hasMoves();
      checkState();
    }, action.comboType ? 360 : 260);
  }

  function collapse() {
    for (let col = 0; col < state.cols; col++) {
      const values = [];
      for (let row = state.rows - 1; row >= 0; row--) if (state.board[row][col] != null) values.push([state.board[row][col], state.locks[row][col]]);
      for (let row = state.rows - 1, index = 0; row >= 0; row--, index++) {
        const pair = values[index];
        state.board[row][col] = pair?.[0] ?? null;
        state.locks[row][col] = pair?.[1] ?? null;
      }
    }
    let writeCol = 0;
    for (let col = 0; col < state.cols; col++) {
      const used = state.board.some(row => row[col] != null);
      if (!used) continue;
      if (writeCol !== col) {
        for (let row = 0; row < state.rows; row++) {
          state.board[row][writeCol] = state.board[row][col];
          state.board[row][col] = null;
          state.locks[row][writeCol] = state.locks[row][col];
          state.locks[row][col] = null;
        }
      }
      writeCol++;
    }
  }

  function showCombo(action, gain, createdSpecial, bossDamage) {
    let label = action.label;
    const count = action.cells.length;
    if (!action.comboType && action.type < BOMB) {
      if (count >= 30) label = '四倍奖励';
      else if (count >= 20) label = '三倍奖励';
      else if (count >= 10) label = '双倍奖励';
    }
    if (state.combo >= 3) label += ` · ${state.combo}连击`;
    if (state.feverMoves === 5) label += ' · 狂热启动';
    if (createdSpecial === BOMB) label += ' · 😈魔鬼炸弹';
    if (createdSpecial === SUPER_BOMB) label += ' · 👹超级魔鬼炸弹';
    if (createdSpecial === ROCKET) label += ' · 🚀十字火箭';
    if (createdSpecial === RAINBOW) label += ' · 🌈彩虹果';
    if (action.chainCount > 1) label += ` · ${action.chainCount}连爆`;
    if (bossDamage > 0) label += ` · Boss-${bossDamage}`;
    el.combo.textContent = `${label}  +${gain}`;
    el.combo.classList.remove('show');
    void el.combo.offsetWidth;
    el.combo.classList.add('show');
  }

  function celebrateClear(row, col, action, gain) {
    const origin = el.board.children[row * state.cols + col];
    if (!origin) return;
    const rect = origin.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const fruit = action.type < BOMB ? FRUITS[action.type] : SPECIALS[action.type]?.icon || '✨';
    const particleCount = action.type === SUPER_BOMB || action.comboType === 'super-super'
      ? 28
      : action.type === BOMB || action.comboType ? 20 : Math.min(16, Math.max(5, action.cells.length));
    for (let index = 0; index < particleCount; index++) {
      const particle = document.createElement('i');
      const angle = Math.PI * 2 * index / particleCount + Math.random() * .35;
      const distance = 48 + Math.random() * (action.type >= BOMB ? 130 : 78);
      particle.className = 'fruit-particle';
      particle.textContent = index % 3 === 0 ? '✨' : fruit;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 760);
    }
    const score = document.createElement('i');
    score.className = 'score-float';
    score.textContent = `+${gain}`;
    score.style.left = `${x}px`;
    score.style.top = `${y}px`;
    document.body.appendChild(score);
    setTimeout(() => score.remove(), 900);
    if (action.cells.length >= 10 || action.type >= BOMB || action.comboType) {
      el.board.classList.remove('impact');
      void el.board.offsetWidth;
      el.board.classList.add('impact');
      setTimeout(() => el.board.classList.remove('impact'), 380);
    }
    if (action.type >= BOMB || action.comboType) {
      const wave = document.createElement('i');
      wave.className = `blast-wave${action.type === SUPER_BOMB || action.comboType === 'super-super' ? ' super' : ''}`;
      wave.style.left = `${x}px`;
      wave.style.top = `${y}px`;
      document.body.appendChild(wave);
      setTimeout(() => wave.remove(), 720);
    }
  }

  function checkState() {
    if (state.finished) return;
    if (state.goal.kind !== 'classic' && goalWon()) return finishRound(true);
    if (state.goal.limit != null && state.moves >= state.goal.limit) return finishRound(false);
    if (!hasMoves()) {
      if (remainingCount() > 0 && (state.shuffles > 0 || state.hammers > 0)) {
        el.tip.textContent = '暂时无可消组合：用重排或锤子打开局面';
        return;
      }
      finishRound();
    }
  }

  function finishRound(forcedWin) {
    if (state.finished) return;
    state.finished = true;
    state.locked = true;
    state.hammerArmed = false;
    const token = state.roundToken;
    clearSelection();
    state.remaining = remainingCount();
    state.bonus = state.goal.kind === 'classic' ? clearBonus(state.remaining) : forcedWin ? Math.max(0, state.goal.limit - state.moves) * 25 : 0;
    state.score += state.bonus;
    render();
    if (state.bonus > 0) {
      el.combo.textContent = `剩余 ${state.remaining} 个 · 奖励 +${state.bonus}`;
      el.combo.classList.remove('show');
      void el.combo.offsetWidth;
      el.combo.classList.add('show');
    }
    const win = forcedWin ?? (state.goal.kind === 'classic' ? state.roundScore + state.bonus >= state.goal.target : goalWon());
    setTimeout(() => { if (token === state.roundToken) showResult(win); }, state.bonus > 0 ? 750 : 320);
  }

  function shuffle() {
    startMusic();
    if (state.locked || state.shuffles <= 0) return;
    clearSelection();
    const values = [];
    for (let row = 0; row < state.rows; row++) for (let col = 0; col < state.cols; col++) {
      if (state.board[row][col] != null) values.push([state.board[row][col], state.locks[row][col]]);
    }
    for (let index = values.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [values[index], values[target]] = [values[target], values[index]];
    }
    let index = 0;
    for (let row = state.rows - 1; row >= 0; row--) {
      for (let col = 0; col < state.cols; col++) {
        const pair = values[index++];
        state.board[row][col] = pair?.[0] ?? null;
        state.locks[row][col] = pair?.[1] ?? null;
      }
    }
    state.shuffles--;
    state.shufflesUsed++;
    if (!hasMoves() && values.length > 1) {
      const firstStandard = values.find(pair => pair[0] < BOMB)?.[0] ?? state.pool[0];
      state.board[state.rows - 1][0] = firstStandard;
      state.board[state.rows - 1][1] = firstStandard;
      state.locks[state.rows - 1][0] = null;
      state.locks[state.rows - 1][1] = null;
    }
    buzz(45);
    render();
    el.tip.textContent = '水果位置已重排';
    checkState();
  }

  function starRating(win) {
    if (!win) return 0;
    let stars = 1;
    if (missionComplete(true)) stars++;
    if (state.remaining === 0 || (state.goal.limit != null && state.moves <= state.goal.limit - 5)) stars++;
    return stars;
  }

  function showResult(win) {
    state.locked = true;
    if (win) {
      if (state.remaining === 0) state.perfectClears++;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      const streakBonus = Math.min(state.streak, 10) * 50;
      state.bonus += streakBonus;
      state.score += streakBonus;
      state.rewardChoice = state.level % 10 === 0
        ? ['bomb', 'rainbow', 'shuffle'][Math.floor(Math.random() * 3)] : null;
    } else {
      state.streak = 0;
      state.rewardChoice = null;
    }
    const stars = starRating(win);
    const challengeDone = missionComplete(true);
    el.modal.hidden = false;
    el.modalBaseScore.textContent = state.roundScore.toLocaleString();
    el.modalBonus.textContent = state.bonus.toLocaleString();
    el.modalMission.textContent = challengeDone ? '已完成 ⭐' : '未完成';
    el.modalScore.textContent = state.score.toLocaleString();
    el.resultStars.textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;

    if (win) {
      const previousStars = Number(state.starsByLevel[state.level] || 0);
      if (stars > previousStars) {
        state.starsByLevel[state.level] = stars;
        state.totalStars += stars - previousStars;
      }
      const milestone = state.level % 10 === 0;
      const century = state.level % 100 === 0;
      const pool = ENCOURAGEMENTS[stars];
      const cheer = pool[Math.floor(Math.random() * pool.length)];
      successTone(milestone);
      el.modalIcon.textContent = century ? '🏆' : milestone ? '🎁' : stars === 3 ? '👑' : '🎉';
      el.modalTitle.textContent = century ? `突破第${state.level}关！` : milestone ? 'Boss关胜利！' : cheer;
      el.modalText.textContent = century
        ? `无限挑战继续，共获得 ${state.totalStars} 颗星！`
        : `${milestone ? '水果巨兽已被击败！' : `本页剩余 ${state.remaining} 个水果。`} 本关获得 ${stars} 颗星。`;
      el.modalText.textContent += ` ${state.goal.name}完成！连胜${state.streak}关，奖励${Math.min(state.streak, 10) * 50}分。`;
      const nextUnlock = UNLOCK_LEVELS.indexOf(state.level + 1);
      if (nextUnlock >= 0) el.modalText.textContent += ` 下一关解锁 ${FRUITS[nextUnlock]} ${FRUIT_NAMES[nextUnlock]}！`;
      if (state.rewardChoice) {
        const prize = { bomb: '😈魔鬼炸弹', rainbow: '🌈幸运彩虹', shuffle: '🔀额外2次重排' }[state.rewardChoice];
        el.modalText.textContent += ` 幸运抽奖：下一关获得${prize}！`;
      }
      el.modalAction.textContent = '下一关';
      if (milestone || stars === 3) celebrate();
    } else {
      el.modalIcon.textContent = state.boss && state.boss.hp > 0 ? '👾' : '🍎';
      el.modalTitle.textContent = '差一点，再试一次！';
      if (state.boss && state.boss.hp > 0) {
        el.modalText.textContent = `Boss还剩 ${state.boss.hp} 点生命；重玩本关不会损失之前累计的积分。`;
      } else {
        el.modalText.textContent = `${state.goal.name}：${goalDescription()}。本次完成 ${goalValue()} / ${goalTarget()}；重试会重新生成棋盘。`;
      }
      el.modalAction.textContent = '重新挑战';
    }
    el.modalAction.dataset.win = win ? '1' : '0';
    save(state.levelStartScore);
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
      state.level++;
      state.levelReward = state.rewardChoice;
      state.rewardChoice = null;
      state.levelStartScore = state.score;
      save(state.score);
    } else state.score = state.levelStartScore;
    startLevel();
  }

  function restartLevel() {
    if (state.locked && !state.finished) return;
    state.score = state.levelStartScore;
    startLevel();
  }

  function showCollection() {
    const items = [
      ...FRUITS.map((icon, index) => ({ level: UNLOCK_LEVELS[index], icon, name: FRUIT_NAMES[index] })),
      ...STAGES.map((stage, index) => ({ level: index * 20 + 1, icon: ['🌳','🏝️','🌅','❄️','🌌'][index], name: stage.name }))
    ];
    el.collectionItems.replaceChildren(...items.map(item => {
      const card = document.createElement('div');
      const unlocked = state.highestLevel >= item.level;
      card.className = `collection-item${unlocked ? '' : ' locked'}`;
      card.textContent = unlocked ? `${item.icon} ${item.name}` : `🔒 第${item.level}关解锁`;
      return card;
    }));
    el.records.textContent = `最高第${state.highestLevel}关 · 最大${state.bestCombo}连击 · 完美清屏${state.perfectClears}次 · 单次最多消除${state.bestSingleClear}个 · 最长连胜${state.bestStreak}关`;
    el.collectionModal.hidden = false;
  }

  function openSettings() {
    el.musicToggle.checked = state.music;
    el.soundToggle.checked = state.sound;
    el.vibrateToggle.checked = state.vibrate;
    el.confirmToggle.checked = state.confirmTap;
    el.musicVolume.value = Math.round(state.musicVolume * 100);
    el.settingsModal.hidden = false;
  }

  function closeSettings() {
    state.music = el.musicToggle.checked;
    state.sound = el.soundToggle.checked;
    state.vibrate = el.vibrateToggle.checked;
    state.confirmTap = el.confirmToggle.checked;
    state.musicVolume = Number(el.musicVolume.value) / 100;
    el.settingsModal.hidden = true;
    clearSelection();
    save(state.levelStartScore);
    if (state.music) startMusic(); else stopMusic();
    render();
    el.tip.textContent = gameplayTip();
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
    gain.gain.setValueAtTime(Math.max(.001, volume), start);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function startMusic() {
    if (!state.music) return;
    syncMusicTrack();
    musicPlayer.play().catch(() => {});
  }

  function stopMusic() {
    musicPlayer.pause();
  }

  function syncMusicTrack(force = false) {
    const source = new URL(`assets/music/${currentStage().theme}.mp3`, window.location.href).href;
    if (force || musicPlayer.src !== source) {
      const wasPlaying = !musicPlayer.paused;
      musicPlayer.src = source;
      musicPlayer.currentTime = 0;
      if (wasPlaying && state.music) musicPlayer.play().catch(() => {});
    }
    musicPlayer.volume = state.musicVolume * .72;
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

  function feverTone() {
    if (!state.sound) return;
    try {
      ensureAudio();
      const now = audio.currentTime;
      [440, 554, 659, 880].forEach((frequency, index) => note(frequency, now + index * .07, .18, 'sawtooth', .04));
    } catch (error) {}
  }

  function bossDefeatTone() {
    if (!state.sound) return;
    try {
      ensureAudio();
      const now = audio.currentTime;
      [196, 262, 330, 392, 523].forEach((frequency, index) => note(frequency, now + index * .1, .28, 'triangle', .06));
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
  el.collection.addEventListener('click', showCollection);
  el.collectionClose.addEventListener('click', () => { el.collectionModal.hidden = true; });
  el.hammer.addEventListener('click', () => {
    if (state.locked || state.hammers <= 0) return;
    state.hammerArmed = !state.hammerArmed;
    clearSelection();
    render();
    el.tip.textContent = state.hammerArmed ? '🔨 点击任意一个水果或障碍；不消耗步数。再点锤子可取消' : gameplayTip();
  });
  el.help.addEventListener('click', () => { el.helpModal.hidden = false; });
  el.helpClose.addEventListener('click', () => { el.helpModal.hidden = true; });
  el.menu.addEventListener('click', () => { clearSelection(); el.menuModal.hidden = false; });
  el.menuClose.addEventListener('click', () => { el.menuModal.hidden = true; });
  for (const button of [el.settings, el.collection, el.help, el.restart]) {
    button.addEventListener('click', () => { el.menuModal.hidden = true; });
  }
  el.settle.addEventListener('click', () => { if (!state.locked && !hasMoves() && state.goal.kind === 'classic') finishRound(); });
  el.musicVolume.addEventListener('input', () => { state.musicVolume = Number(el.musicVolume.value) / 100; });
  el.music.addEventListener('click', () => {
    state.music = !state.music;
    el.musicToggle.checked = state.music;
    if (state.music) startMusic(); else stopMusic();
    save(state.levelStartScore);
    render();
  });
  el.sound.addEventListener('click', () => {
    state.sound = !state.sound;
    el.soundToggle.checked = state.sound;
    save(state.levelStartScore);
    render();
  });
  document.addEventListener('pointerdown', startMusic, { once: true });

  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js?v=17').catch(() => {}));
  load();
})();
