/* ========================================
   game.js — ゲームループ・状態管理
   ターン・フェイズの進行制御
   ======================================== */

// --- ゲーム状態（グローバル） ---
var gameState = null;

function createGameOptions(options) {
  return {
    sync: !!(options && options.sync),
    autoRender: !options || options.autoRender !== false,
    autoCpu: !options || options.autoCpu !== false
  };
}

function shouldAutoRender(state) {
  return !state || !state.options || state.options.autoRender !== false;
}

function shouldAutoCpu(state) {
  return !state || !state.options || state.options.autoCpu !== false;
}

function scheduleStateTask(state, callback, delay) {
  if (state && state.options && state.options.sync) {
    callback();
    return null;
  }

  return setTimeout(callback, delay || 0);
}

function syncGameState(state) {
  if (!shouldAutoRender(state)) return;
  if (typeof document === 'undefined') return;
  if (typeof renderGameState !== 'function') return;
  if (!document.getElementById('game-container')) return;

  renderGameState(state);
}

// =============================================
// ゲーム初期化
// =============================================

/**
 * ゲーム全体を初期化
 */
function initGame(options) {
  var playerChronicle = getPlayerChronicle();
  var cpuChronicle = getCpuChronicle();

  gameState = {
    turn: 1,
    activePlayer: 'player', // プレイヤー先攻
    phase: 'start',
    readCount: 0,           // 今ターンのスタートフェイズで詠んだ枚数
    player: createPlayer('player', playerChronicle),
    cpu: createPlayer('cpu', cpuChronicle),
    isGameOver: false,
    winner: null,
    log: [],
    currentBattle: null,
    options: createGameOptions(options)
  };

  // --- ゲーム開始処理 ---
  addLog(gameState, '★ 星典戦記 開幕 ★');

  // 1. 1ページ目の星霊を場に召喚（両方）
  setupInitialAstral(gameState, gameState.player, 'プレイヤー');
  setupInitialAstral(gameState, gameState.cpu, 'CPU');

  // 2. 初期詠み（1ページ）→ SP+2
  performInitialRead(gameState, gameState.player, 'プレイヤー');
  performInitialRead(gameState, gameState.cpu, 'CPU');

  // 3. ターン開始
  addLog(gameState, logTurnStart(gameState.turn, 'プレイヤー'));
  addLog(gameState, logPhaseChange('スタートフェイズ'));

  return gameState;
}

/**
 * 初期星霊の召喚（1ページ目）
 */
function setupInitialAstral(state, player, playerName) {
  var firstCard = player.chroniclePages[0];
  if (firstCard.type === 'astral') {
    // 1ページ目をフィールドに出す
    summonAstral(player, firstCard, 0);
    player.chronicleIndex = 1; // 1ページ目は使用済み
    addLog(state, logSummon(playerName, firstCard));
  }
}

/**
 * 初期詠み（1ページ）
 */
function performInitialRead(state, player, playerName) {
  var card = readPage(player);
  if (card) {
    addLog(state, logRead(playerName, 1, SP_PER_PAGE));
  }
}

// =============================================
// ゲッター関数
// =============================================

function getActivePlayer(state) {
  var currentState = state || gameState;
  return currentState.activePlayer === 'player' ? currentState.player : currentState.cpu;
}

function getInactivePlayer(state) {
  var currentState = state || gameState;
  return currentState.activePlayer === 'player' ? currentState.cpu : currentState.player;
}

function getPlayerName(playerId) {
  return playerId === 'player' ? 'プレイヤー' : 'CPU';
}

// =============================================
// スタートフェイズ
// =============================================

/**
 * スタートフェイズを開始
 */
function startPhase(state) {
  state.phase = 'start';
  state.readCount = 0;
  resetTurnState(getActivePlayer(state));
  syncGameState(state);
}

/**
 * プレイヤーが星典を1ページ詠む（スタートフェイズ中）
 * @returns {boolean} 詠めたかどうか
 */
function playerReadPage(state) {
  if (state.phase !== 'start') return false;
  if (state.readCount >= MAX_READ_PER_TURN) return false;

  var player = getActivePlayer(state);
  if (!canRead(player)) return false;

  var card = readPage(player);
  if (card) {
    state.readCount++;
    var name = getPlayerName(state.activePlayer);
    addLog(state, logRead(name, 1, SP_PER_PAGE));
    syncGameState(state);
    return true;
  }
  return false;
}

// =============================================
// メインフェイズ
// =============================================

/**
 * メインフェイズに移行
 */
function goToMainPhase(state) {
  state.phase = 'main';
  addLog(state, logPhaseChange('メインフェイズ'));
  syncGameState(state);
}

/**
 * カードをプレイ（天窓からカード使用）
 * @param {number} skyWindowIndex - 天窓内のインデックス
 */
function playerPlayCard(state, skyWindowIndex) {
  if (state.phase !== 'main') return false;

  var player = getActivePlayer(state);
  var card = player.skyWindow[skyWindowIndex];
  if (!card) return false;

  var name = getPlayerName(state.activePlayer);
  var pageIndex = card._pageIndex;

  switch (card.type) {
    case 'astral':
      // 星霊召喚
      if (player.field.length >= MAX_FIELD_ASTRALS) {
        addLog(state, '⚠️ フィールドが満員です（上限' + MAX_FIELD_ASTRALS + '体）');
        return false;
      }
      if (!spendSP(player, card.cost)) {
        addLog(state, '⚠️ SPが不足しています（必要:' + card.cost + '  現在:' + player.sp + '）');
        return false;
      }
      summonAstral(player, card, pageIndex);
      addLog(state, logSummon(name, card));
      break;

    case 'fate':
      // 星命使用
      if (player.usedFate) {
        addLog(state, '⚠️ 星命は1ターンに1枚までです');
        return false;
      }
      if (!applyFateEffect(player, card, pageIndex)) {
        addLog(state, '⚠️ SPが不足しています');
        return false;
      }
      addLog(state, logFate(name, card.name, card.effectDescription));
      break;

    default:
      // 星術はバトルフェイズで使用
      addLog(state, '⚠️ 星術はバトルフェイズで使用してください');
      return false;
  }

  syncGameState(state);
  return true;
}

// =============================================
// バトルフェイズ
// =============================================

/**
 * バトルフェイズに移行
 */
function goToBattlePhase(state) {
  state.phase = 'battle';
  state.currentBattle = null;
  addLog(state, logPhaseChange('バトルフェイズ'));
  syncGameState(state);
}

/**
 * 星撃宣言（攻撃する星霊を選択）
 */
function playerStarStrike(state, astralIndex) {
  if (state.phase !== 'battle') return false;
  if (state.currentBattle) return false;

  var attacker = getActivePlayer(state);
  var defender = getInactivePlayer(state);
  var availableAttackSpells = getAvailableAttackSpells(attacker.skyWindow, attacker.sp);

  if (astralIndex < 0 || astralIndex >= attacker.field.length) return false;
  if (availableAttackSpells.length === 0) {
    addLog(state, '⚠️ 使用可能な攻星術がないため星撃宣言できない');
    syncGameState(state);
    return false;
  }

  var attackAstral = attacker.field[astralIndex];
  var name = getPlayerName(state.activePlayer);

  addLog(state, '⚔️ ' + name + ' が ' + attackAstral.name + ' で星撃宣言！');

  // バトルステートを生成
  state.currentBattle = {
    attacker: attacker,
    defender: defender,
    attackAstral: attackAstral,
    attackSpell: null,
    overcharge: 0,
    defenseAstral: defender.field.length > 0 ? defender.field[0] : null,
    defenseSpell: null,
    defenseOvercharge: 0,
    battlePhase: 'selectSpell'  // 攻星術選択待ち
  };

  syncGameState(state);
  return true;
}

/**
 * 星撃宣言を取り消してバトル選択へ戻る
 */
function playerCancelStarStrike(state) {
  if (!state.currentBattle || state.currentBattle.battlePhase !== 'selectSpell') return false;
  if (state.currentBattle.attacker.id !== 'player') return false;

  addLog(state, '↩️ プレイヤー は星撃宣言を取り消した');
  state.currentBattle = null;
  syncGameState(state);
  return true;
}

/**
 * 攻星術＋過詠を選択
 */
function playerSelectAttackSpell(state, skyWindowIndex, overcharge) {
  if (!state.currentBattle || state.currentBattle.battlePhase !== 'selectSpell') return false;

  var attacker = state.currentBattle.attacker;
  var card = attacker.skyWindow[skyWindowIndex];
  if (!card || card.type !== 'spell' || card.timing !== 'attack') return false;

  var actualOvercharge = clampOvercharge(overcharge, card.cost, attacker.sp - card.cost);
  var totalCost = card.cost + actualOvercharge;
  if (!spendSP(attacker, totalCost)) {
    addLog(state, '⚠️ SPが不足しています（必要:' + totalCost + '  現在:' + attacker.sp + '）');
    return false;
  }

  // 使用済みに追加
  if (card._pageIndex !== undefined) {
    attacker.usedCardIndices.push(card._pageIndex);
    updateSkyWindow(attacker);
  }

  state.currentBattle.attackSpell = card;
  state.currentBattle.overcharge = actualOvercharge;

  var name = getPlayerName(state.activePlayer);
  addLog(state, logSpellUse(name, card.name, 'attack'));
  if (actualOvercharge > 0) {
    addLog(state, logOvercharge(name, actualOvercharge));
  }
  if (hasResonance(state.currentBattle.attackAstral, card)) {
    addLog(state, logResonance(state.currentBattle.attackAstral.name, card.name));
  }

  // 防御リアクションフェイズへ
  state.currentBattle.battlePhase = 'defendPhase';

  // CPUの場合は自動で防御判断
  if (state.currentBattle.defender.id === 'cpu' && shouldAutoCpu(state)) {
    cpuDefendAction(state);
  } else {
    syncGameState(state);
  }

  return true;
}

/**
 * 防御リアクション（守星術選択 or パス）
 */
function playerDefend(state, skyWindowIndex, overcharge) {
  if (!state.currentBattle || state.currentBattle.battlePhase !== 'defendPhase') return false;

  var defender = state.currentBattle.defender;

  if (skyWindowIndex >= 0) {
    // 守星術を使用
    var card = defender.skyWindow[skyWindowIndex];
    if (!card || card.type !== 'spell' || card.timing !== 'defense') return false;

    var actualOvercharge = clampOvercharge(overcharge, card.cost, defender.sp - card.cost);
    var totalCost = card.cost + actualOvercharge;
    if (!spendSP(defender, totalCost)) {
      addLog(state, '⚠️ SPが不足しています');
      return false;
    }

    // 使用済みに追加
    if (card._pageIndex !== undefined) {
      defender.usedCardIndices.push(card._pageIndex);
      updateSkyWindow(defender);
    }

    state.currentBattle.defenseSpell = card;
    state.currentBattle.defenseOvercharge = actualOvercharge;

    var name = getPlayerName(defender.id);
    addLog(state, logSpellUse(name, card.name, 'defense'));
    if (actualOvercharge > 0) {
      addLog(state, logOvercharge(name, actualOvercharge));
    }
    if (hasResonance(state.currentBattle.defenseAstral, card)) {
      addLog(state, logResonance(state.currentBattle.defenseAstral.name, card.name));
    }
  } else {
    // パス（守星術なし）
    var name = getPlayerName(defender.id);
    addLog(state, '🚫 ' + name + ' は守星術を使用しなかった');
  }

  // 星力衝突解決へ
  resolveCurrentBattle(state);
  return true;
}

/**
 * 星力衝突を解決
 */
function resolveCurrentBattle(state) {
  var battle = state.currentBattle;
  if (!battle) return;

  battle.battlePhase = 'resolve';

  var clashResult = createClashResult(
    battle.attackAstral, battle.attackSpell, battle.overcharge,
    battle.defenseAstral, battle.defenseSpell, battle.defenseOvercharge
  );

  var atkName = getPlayerName(battle.attacker.id);
  var defName = getPlayerName(battle.defender.id);

  addLog(state, logClash(atkName, defName, clashResult));

  if (clashResult.success) {
    // 攻撃成功 → ダメージ選択フェイズへ
    battle.clashResult = clashResult;
    battle.battlePhase = 'damageChoice';

    addLog(state, '💥 ダメージ:' + clashResult.totalDamage + ' — 星典で受けるか、星霊で星護するか？');

    if (battle.defender.id === 'cpu' && shouldAutoCpu(state)) {
      // CPUは自動判断
      cpuDamageChoice(state);
    } else {
      syncGameState(state);
    }
  } else {
    // 攻撃失敗 → バトル終了
    addLog(state, '✋ 攻撃は防がれた！');
    endBattle(state);
  }
}

/**
 * プレイヤーが星護を選択
 */
function playerGuard(state, astralIndex) {
  if (!state.currentBattle || state.currentBattle.battlePhase !== 'damageChoice') return false;

  var defender = state.currentBattle.defender;
  var defName = getPlayerName(defender.id);

  if (astralIndex >= 0 && astralIndex < defender.field.length) {
    // 星霊で星護
    var astral = defender.field[astralIndex];
    var result = guardWithAstral(astral);

    addLog(state, logGuard(defName, astral.name, result));

    if (result === 'vanish') {
      // 消星 → 場から除去
      removeAstral(defender, astralIndex);
      addLog(state, '💀 ' + astral.name + ' が消星した…');
    }
  }

  endBattle(state);
  return true;
}

/**
 * プレイヤーが星典ダメージを受ける
 */
function playerTakeChronicleDamage(state) {
  if (!state.currentBattle || state.currentBattle.battlePhase !== 'damageChoice') return false;

  var defender = state.currentBattle.defender;
  var damage = state.currentBattle.clashResult.totalDamage;
  var defName = getPlayerName(defender.id);

  var actual = applyChronicleDamage(defender, damage);
  addLog(state, logDamage(defName, actual, 'chronicle'));

  endBattle(state);
  return true;
}

/**
 * バトル終了
 */
function endBattle(state) {
  state.currentBattle = null;

  // 勝敗チェック
  var winner = checkWinCondition(state);
  if (winner) {
    endGame(state, winner);
  } else {
    goToEndPhase(state);
  }
}

// =============================================
// エンドフェイズ
// =============================================

/**
 * エンドフェイズへ移行（ターンエンド）
 */
function goToEndPhase(state) {
  state.phase = 'end';
  addLog(state, logPhaseChange('エンドフェイズ'));

  var player = getActivePlayer(state);
  var name = getPlayerName(state.activePlayer);

  // 1. 消星した星霊の除去（念のため）
  cleanupField(state.player);
  cleanupField(state.cpu);

  // 2. 自動1ページ詠み
  if (canRead(player)) {
    readPage(player);
    addLog(state, logRead(name, 1, SP_PER_PAGE) + '（自動）');
  }

  // 3. 勝敗判定
  var winner = checkWinCondition(state);
  if (winner) {
    endGame(state, winner);
    return;
  }

  // ターン交代
  endTurn(state);
}

/**
 * フィールドの整理（消星した星霊を除去）
 */
function cleanupField(player) {
  for (var i = player.field.length - 1; i >= 0; i--) {
    if (player.field[i].state === 'vanish') {
      player.field.splice(i, 1);
    }
  }
}

/**
 * ターン交代
 */
function endTurn(state) {
  // ターン交代
  if (state.activePlayer === 'player') {
    state.activePlayer = 'cpu';
  } else {
    state.activePlayer = 'player';
    state.turn++;
  }

  var name = getPlayerName(state.activePlayer);
  addLog(state, logTurnStart(state.turn, name));

  // 新ターンのスタートフェイズ開始
  startPhase(state);
  addLog(state, logPhaseChange('スタートフェイズ'));

  // CPUのターンなら自動進行
  if (state.activePlayer === 'cpu' && shouldAutoCpu(state)) {
    syncGameState(state);
    scheduleStateTask(state, function() {
      executeCpuTurn(state);
    }, 800);
  } else {
    syncGameState(state);
  }
}

// =============================================
// 勝敗判定
// =============================================

/**
 * 勝利条件をチェック
 * @returns {string|null} 勝者のID、または null
 */
function checkWinCondition(state) {
  // 星典消滅チェック
  if (isDefeated(state.player)) return 'cpu';
  if (isDefeated(state.cpu)) return 'player';
  return null;
}

/**
 * ゲーム終了
 */
function endGame(state, winnerId) {
  state.isGameOver = true;
  state.winner = winnerId;

  var winnerName = getPlayerName(winnerId);
  var loserId = winnerId === 'player' ? 'cpu' : 'player';
  var loser = winnerId === 'player' ? state.cpu : state.player;

  var reason = '';
  if (getRemainingPages(loser) <= 0) {
    reason = '星典消滅';
  } else {
    reason = '星霊全滅';
  }

  addLog(state, logWinner(winnerName, reason));
  syncGameState(state);
}

// =============================================
// プレイヤーの手動アクション（UI用）
// =============================================

/**
 * スタートフェイズ → メインフェイズへ進む
 */
function playerEndStartPhase(state) {
  if (state.phase !== 'start') return;
  goToMainPhase(state);
}

/**
 * メインフェイズ → バトルフェイズへ進む
 */
function playerEndMainPhase(state) {
  if (state.phase !== 'main') return;
  goToBattlePhase(state);
}

/**
 * バトルフェイズをスキップ → エンドフェイズへ
 */
function playerSkipBattle(state) {
  if (state.phase !== 'battle') return;
  goToEndPhase(state);
}

/**
 * ターン終了（現在のフェイズからエンドフェイズへ）
 */
function playerEndTurn(state) {
  goToEndPhase(state);
}

function mainPhase(state) {
  goToMainPhase(state);
}

function battlePhase(state) {
  goToBattlePhase(state);
}

function endPhase(state) {
  goToEndPhase(state);
}

function createCardSnapshot(card) {
  if (!card) return null;

  return {
    id: card.id,
    name: card.name,
    type: card.type,
    timing: card.timing || null,
    element: card.element || null,
    cost: card.cost,
    power: card.power || null,
    powerBoost: card.powerBoost || 0,
    damage: card.damage || 0,
    pageIndex: card._pageIndex
  };
}

function createPlayerSnapshot(player) {
  return {
    id: player.id,
    sp: player.sp,
    chronicleIndex: player.chronicleIndex,
    remainingPages: getRemainingPages(player),
    usedFate: player.usedFate,
    skyWindow: player.skyWindow.map(createCardSnapshot),
    field: player.field.map(function(astral) {
      return {
        id: astral.id,
        name: astral.name,
        element: astral.element,
        power: astral.power,
        tempPowerBoost: astral.tempPowerBoost || 0,
        state: astral.state
      };
    }),
    usedCardIndices: player.usedCardIndices.slice(),
    readPageIndices: player.readPageIndices.slice()
  };
}

function createBattleSnapshot(battle) {
  if (!battle) return null;

  return {
    battlePhase: battle.battlePhase,
    attacker: battle.attacker.id,
    defender: battle.defender.id,
    attackAstral: battle.attackAstral ? battle.attackAstral.name : null,
    attackSpell: battle.attackSpell ? battle.attackSpell.name : null,
    overcharge: battle.overcharge || 0,
    defenseAstral: battle.defenseAstral ? battle.defenseAstral.name : null,
    defenseSpell: battle.defenseSpell ? battle.defenseSpell.name : null,
    defenseOvercharge: battle.defenseOvercharge || 0,
    clashResult: battle.clashResult ? {
      attackPower: battle.clashResult.attackPower,
      defensePower: battle.clashResult.defensePower,
      attackResonance: battle.clashResult.attackResonance,
      defenseResonance: battle.clashResult.defenseResonance,
      success: battle.clashResult.success,
      totalDamage: battle.clashResult.totalDamage
    } : null
  };
}

function createGameSnapshot(state) {
  var currentState = state || gameState;
  if (!currentState) return null;

  return {
    turn: currentState.turn,
    activePlayer: currentState.activePlayer,
    phase: currentState.phase,
    readCount: currentState.readCount,
    isGameOver: currentState.isGameOver,
    winner: currentState.winner,
    player: createPlayerSnapshot(currentState.player),
    cpu: createPlayerSnapshot(currentState.cpu),
    currentBattle: createBattleSnapshot(currentState.currentBattle),
    logTail: currentState.log.slice(-10)
  };
}

function renderGameToText(state) {
  return JSON.stringify(createGameSnapshot(state), null, 2);
}

function pushSimulationCheck(report, condition, message) {
  report.checks.push({
    pass: !!condition,
    message: message
  });

  if (!condition) {
    report.passed = false;
  }
}

function findSkyWindowIndex(player, predicate) {
  for (var i = 0; i < player.skyWindow.length; i++) {
    if (predicate(player.skyWindow[i])) {
      return i;
    }
  }

  return -1;
}

function createIndexedCard(card, pageIndex) {
  var indexedCard = cloneCard(card);
  indexedCard._pageIndex = pageIndex;
  return indexedCard;
}

function runPhase2Simulation() {
  var state = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  var report = {
    passed: true,
    checks: [],
    snapshots: []
  };

  report.snapshots.push({
    label: 'init',
    state: createGameSnapshot(state)
  });

  pushSimulationCheck(report, state.player.field.length === 1, '初期配置でプレイヤー星霊が1体召喚される');
  pushSimulationCheck(report, state.player.sp === 2, '初期詠みでプレイヤーSPが2になる');
  pushSimulationCheck(report, state.cpu.sp === 2, '初期詠みでCPU SPが2になる');

  pushSimulationCheck(report, playerReadPage(state) === true, 'スタートフェイズで追加の詠みができる');
  pushSimulationCheck(report, state.player.sp === 4, '追加の詠みでSPが加算される');
  pushSimulationCheck(report, state.player.skyWindow.length === 2, '天窓が直近2ページで構成される');

  report.snapshots.push({
    label: 'after-read',
    state: createGameSnapshot(state)
  });

  playerEndStartPhase(state);
  pushSimulationCheck(report, state.phase === 'main', 'スタートフェイズからメインフェイズへ移行できる');

  playerEndMainPhase(state);
  pushSimulationCheck(report, state.phase === 'battle', 'メインフェイズからバトルフェイズへ移行できる');

  var attackSpellIndex = findSkyWindowIndex(state.player, function(card) {
    return card.type === 'spell' && card.timing === 'attack';
  });

  pushSimulationCheck(report, attackSpellIndex >= 0, '天窓から攻星術を選べる');
  pushSimulationCheck(report, playerStarStrike(state, 0) === true, '星撃宣言が開始できる');
  pushSimulationCheck(report, playerSelectAttackSpell(state, attackSpellIndex, 2) === true, '攻星術と過詠を選択できる');
  pushSimulationCheck(report, playerDefend(state, -1, 0) === true, '防御側が守星術を使わずにパスできる');
  pushSimulationCheck(report, state.currentBattle.clashResult.attackPower === 5, '攻星術の過詠が攻撃星力を不正に増やさない');
  pushSimulationCheck(report, state.currentBattle.clashResult.totalDamage === 3, '攻星術の過詠がダメージに反映される');
  pushSimulationCheck(report, state.currentBattle.battlePhase === 'damageChoice', '攻撃成功後にダメージ選択へ移行する');

  pushSimulationCheck(report, playerTakeChronicleDamage(state) === true, '星典ダメージを適用できる');

  report.snapshots.push({
    label: 'after-battle',
    state: createGameSnapshot(state)
  });

  pushSimulationCheck(report, state.cpu.skyWindow.length === 1 && state.cpu.skyWindow[0].id === 'spell_def_003', 'ダメージでめくれたページが天窓に混入しない');
  pushSimulationCheck(report, getRemainingPages(state.cpu) === 15, '星典ダメージでCPUの残りページが正しく減る');
  pushSimulationCheck(report, state.activePlayer === 'cpu', 'バトル終了後にターンが交代する');
  pushSimulationCheck(report, state.phase === 'start', 'ターン交代後はスタートフェイズに戻る');

  var guardTestAstral = cloneCard(ASTRAL_CARDS.astral_001);
  pushSimulationCheck(report, guardWithAstral(guardTestAstral) === 'eclipse', '星護1回目で輝態から蝕態になる');
  pushSimulationCheck(report, guardWithAstral(guardTestAstral) === 'vanish', '星護2回目で消星になる');
  pushSimulationCheck(report, guardTestAstral.state === 'vanish', '消星時に星霊状態が vanish になる');
  pushSimulationCheck(report, getMaxOvercharge(2) === 2, '過詠上限が通常コスト分に制限される');

  var emptyChroniclePlayer = createPlayer('edge-empty-chronicle', getPlayerChronicle());
  emptyChroniclePlayer.chronicleIndex = emptyChroniclePlayer.chroniclePages.length;
  pushSimulationCheck(report, isDefeated(emptyChroniclePlayer) === true, '星典が0ページなら敗北判定になる');

  var noAstralPlayer = createPlayer('edge-no-astral', getPlayerChronicle());
  noAstralPlayer.chronicleIndex = noAstralPlayer.chroniclePages.length - 1;
  updateSkyWindow(noAstralPlayer);
  pushSimulationCheck(report, isDefeated(noAstralPlayer) === true, '場に星霊がなく再召喚手段もなければ敗北判定になる');

  var noAttackSpellState = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  noAttackSpellState.phase = 'battle';
  noAttackSpellState.currentBattle = null;
  noAttackSpellState.player.sp = 0;
  noAttackSpellState.player.skyWindow = [
    createIndexedCard(ASTRAL_CARDS.astral_002, 4),
    createIndexedCard(DEFENSE_SPELL_CARDS.spell_def_001, 5)
  ];
  pushSimulationCheck(report, playerStarStrike(noAttackSpellState, 0) === false, '攻星術が使えないと星撃宣言できない');
  pushSimulationCheck(report, noAttackSpellState.currentBattle === null, '攻撃不可時にバトル選択状態へ入らない');

  var cancelStrikeState = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  cancelStrikeState.phase = 'battle';
  cancelStrikeState.currentBattle = null;
  cancelStrikeState.player.sp = 4;
  cancelStrikeState.player.skyWindow = [
    createIndexedCard(ATTACK_SPELL_CARDS.spell_atk_001, 6)
  ];
  pushSimulationCheck(report, playerStarStrike(cancelStrikeState, 0) === true, '攻星術があれば星撃宣言できる');
  pushSimulationCheck(report, playerCancelStarStrike(cancelStrikeState) === true, '攻星術選択中に星撃宣言を取り消せる');
  pushSimulationCheck(report, cancelStrikeState.currentBattle === null, '星撃宣言取り消し後にバトル選択へ戻る');

  var fullFieldPlayer = createPlayer('edge-full-field', getPlayerChronicle());
  fullFieldPlayer.field.push(cloneCard(ASTRAL_CARDS.astral_001));
  fullFieldPlayer.field.push(cloneCard(ASTRAL_CARDS.astral_002));
  fullFieldPlayer.field.push(cloneCard(ASTRAL_CARDS.astral_003));
  pushSimulationCheck(report, summonAstral(fullFieldPlayer, cloneCard(ASTRAL_CARDS.astral_004)) === false, 'フィールド上限3体を超えて召喚できない');

  console.group('Phase 2 Simulation');
  console.log('passed:', report.passed);
  console.table(report.checks);
  console.log('snapshots:', report.snapshots);
  console.groupEnd();

  return {
    state: state,
    report: report
  };
}

function runPhase4Simulation() {
  var report = {
    passed: true,
    checks: [],
    snapshots: []
  };

  var startState = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  startState.activePlayer = 'cpu';
  startPhase(startState);

  var startReadCount = cpuStartPhase(startState);
  pushSimulationCheck(report, startReadCount === 2, 'CPUが低SP時に2ページ詠みを選ぶ');
  pushSimulationCheck(report, startState.cpu.sp === 6, 'CPUの詠みでSPが増加する');

  report.snapshots.push({
    label: 'cpu-start-phase',
    state: createGameSnapshot(startState)
  });

  var mainState = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  mainState.activePlayer = 'cpu';
  goToMainPhase(mainState);
  mainState.cpu.field = [];
  mainState.cpu.sp = 4;
  mainState.cpu.skyWindow = [
    createIndexedCard(ASTRAL_CARDS.astral_002, 4),
    createIndexedCard(FATE_CARDS.fate_003, 5)
  ];

  var mainActions = cpuMainPhase(mainState);
  pushSimulationCheck(report, mainState.cpu.field.length === 1, 'CPUが星霊不在時に最優先で召喚する');
  pushSimulationCheck(report, mainState.cpu.field[0].id === 'astral_002', 'CPUが使用可能な星霊を召喚する');
  pushSimulationCheck(report, mainActions.indexOf('summon:astral_002') !== -1, 'CPUメインフェイズの行動が記録される');

  var battleState = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  battleState.activePlayer = 'cpu';
  battleState.phase = 'battle';
  battleState.currentBattle = null;
  battleState.cpu.sp = 4;
  battleState.cpu.field = [
    cloneCard(ASTRAL_CARDS.astral_004),
    cloneCard(ASTRAL_CARDS.astral_001)
  ];
  battleState.cpu.skyWindow = [
    createIndexedCard(ATTACK_SPELL_CARDS.spell_atk_001, 8),
    createIndexedCard(ATTACK_SPELL_CARDS.spell_atk_004, 9)
  ];
  battleState.player.field = [cloneCard(ASTRAL_CARDS.astral_001)];
  battleState.player.skyWindow = [];
  battleState.player.sp = 0;

  pushSimulationCheck(report, cpuBattlePhase(battleState) === true, 'CPUが攻撃可能な場面で星撃宣言する');
  pushSimulationCheck(report, battleState.currentBattle.attackAstral.id === 'astral_004', 'CPUが共鳴する星霊を優先して攻撃する');
  pushSimulationCheck(report, battleState.currentBattle.attackSpell.id === 'spell_atk_004', 'CPUが共鳴する攻星術を優先して選ぶ');

  var defendState = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  defendState.activePlayer = 'player';
  defendState.phase = 'battle';
  defendState.cpu.sp = 5;
  defendState.cpu.field = [cloneCard(ASTRAL_CARDS.astral_004)];
  defendState.cpu.skyWindow = [
    createIndexedCard(DEFENSE_SPELL_CARDS.spell_def_003, 2)
  ];

  var attackAstral = cloneCard(ASTRAL_CARDS.astral_005);
  attackAstral.tempPowerBoost = 1;
  var attackSpell = cloneCard(ATTACK_SPELL_CARDS.spell_atk_002);

  defendState.currentBattle = {
    attacker: defendState.player,
    defender: defendState.cpu,
    attackAstral: attackAstral,
    attackSpell: attackSpell,
    overcharge: 0,
    defenseAstral: defendState.cpu.field[0],
    defenseSpell: null,
    defenseOvercharge: 0,
    clashResult: null,
    battlePhase: 'defendPhase'
  };

  var defenseDecision = cpuDefenseReaction(defendState, calcAttackPower(attackAstral, attackSpell, 0));
  pushSimulationCheck(report, defenseDecision.type === 'defend', 'CPUが防御可能なら守星術を選ぶ');
  pushSimulationCheck(report, defenseDecision.overcharge === 2, 'CPUが必要な過詠量を防御に使う');

  cpuDefendAction(defendState);
  pushSimulationCheck(report, defendState.currentBattle === null, 'CPU防御後にバトルが解決される');
  pushSimulationCheck(report, defendState.activePlayer === 'cpu', 'CPU防御後にターン進行が継続する');

  var guardState = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  guardState.activePlayer = 'player';
  guardState.phase = 'battle';
  guardState.cpu.field = [cloneCard(ASTRAL_CARDS.astral_001)];
  guardState.cpu.chronicleIndex = guardState.cpu.chroniclePages.length - 1;

  guardState.currentBattle = {
    attacker: guardState.player,
    defender: guardState.cpu,
    attackAstral: cloneCard(ASTRAL_CARDS.astral_005),
    attackSpell: cloneCard(ATTACK_SPELL_CARDS.spell_atk_005),
    overcharge: 0,
    defenseAstral: guardState.cpu.field[0],
    defenseSpell: null,
    defenseOvercharge: 0,
    clashResult: {
      attackPower: 12,
      defensePower: 0,
      attackResonance: true,
      defenseResonance: false,
      success: true,
      totalDamage: 2
    },
    battlePhase: 'damageChoice'
  };

  var guardDecision = cpuGuardDecision(guardState, 2);
  pushSimulationCheck(report, guardDecision.type === 'guard', 'CPUが星典消滅を避けるために星護を選ぶ');

  cpuDamageChoice(guardState);
  pushSimulationCheck(report, guardState.cpu.field[0].state === 'eclipse', 'CPUの星護で星霊が蝕態になる');
  pushSimulationCheck(report, getRemainingPages(guardState.cpu) === 1, 'CPUが星護を選んだ場合は星典残量が維持される');

  report.snapshots.push({
    label: 'cpu-guard-choice',
    state: createGameSnapshot(guardState)
  });

  console.group('Phase 4 Simulation');
  console.log('passed:', report.passed);
  console.table(report.checks);
  console.log('snapshots:', report.snapshots);
  console.groupEnd();

  return {
    report: report
  };
}

function countLogOccurrences(logs, keyword) {
  var count = 0;

  for (var i = 0; i < logs.length; i++) {
    if (logs[i].indexOf(keyword) !== -1) {
      count++;
    }
  }

  return count;
}

function getAutoReadCount(player, opponent) {
  var remaining = getRemainingPages(player);
  var readCount = 0;

  if (player.field.length === 0 && getAvailableAstrals(player.skyWindow, player.sp).length === 0 && remaining > 0) {
    readCount = 1;
  }

  if (player.sp < 3 && remaining > 8) {
    readCount = Math.max(readCount, 2);
  } else if (player.sp < 2 && remaining > 4) {
    readCount = Math.max(readCount, 1);
  } else if (player.sp >= 6) {
    readCount = Math.max(readCount, 0);
  } else if (remaining > 10 && player.sp < 5) {
    readCount = Math.max(readCount, 1);
  }

  if (remaining <= 6 && player.sp >= 4) {
    readCount = Math.min(readCount, 1);
  }

  if (opponent && opponent.field.length > player.field.length && remaining > 0 && player.sp < 4) {
    readCount = Math.max(readCount, 1);
  }

  return Math.min(readCount, remaining, MAX_READ_PER_TURN);
}

function getAutoDefenseReserve(player, opponent) {
  if (!opponent || opponent.field.length === 0) return 0;

  var reserve = 0;

  for (var i = 0; i < player.skyWindow.length; i++) {
    var card = player.skyWindow[i];
    if (card.type !== 'spell' || card.timing !== 'defense') continue;

    if (reserve === 0 || card.cost < reserve) {
      reserve = card.cost;
    }
  }

  return reserve;
}

function selectAutoFate(player, opponent) {
  var fates = getAvailableFates(player.skyWindow, player.sp, player.usedFate);

  if (fates.length === 0) return null;

  var attackSpells = getAvailableAttackSpells(player.skyWindow, player.sp);
  var basePlan = selectBestAttackCombo(player, attackSpells, opponent);
  var bestFate = null;
  var bestScore = 0;

  for (var i = 0; i < fates.length; i++) {
    var fate = fates[i];
    var score = 0;

    switch (fate.effectType) {
      case 'chronicle_restore':
        if (getRemainingPages(player) <= 3) score = 20;
        else if (getRemainingPages(player) <= 6) score = 14;
        else if (getRemainingPages(player) <= 8) score = 8;
        break;

      case 'sp_charge':
        if (player.sp <= 2) score += 10;
        else if (player.sp <= 4) score += 6;

        if (player.field.length === 0 &&
            getAvailableAstrals(player.skyWindow, player.sp).length === 0 &&
            getAvailableAstrals(player.skyWindow, player.sp - fate.cost + fate.value).length > 0) {
          score += 8;
        }

        var chargedSp = player.sp - fate.cost + fate.value;
        var chargePlan = selectBestAttackCombo(
          player,
          getAvailableAttackSpells(player.skyWindow, chargedSp),
          opponent,
          { spAvailable: chargedSp }
        );

        if (chargePlan && (!basePlan || chargePlan.score > basePlan.score + 4)) {
          score += 6;
        }
        break;

      case 'power_buff':
        if (player.field.length > 0) {
          var buffPlan = selectBestAttackCombo(
            player,
            getAvailableAttackSpells(player.skyWindow, player.sp - fate.cost),
            opponent,
            { spAvailable: player.sp - fate.cost, firstAstralBonus: fate.value }
          );

          if (buffPlan && buffPlan.successLikely) score += 8;
          if (buffPlan && (!basePlan || buffPlan.score > basePlan.score + 2)) score += 5;
        }
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      bestFate = fate;
    }
  }

  return bestFate;
}

function executeAutoStartPhase(state) {
  var player = getActivePlayer(state);
  var opponent = getInactivePlayer(state);
  var name = getPlayerName(player.id);
  var readCount = getAutoReadCount(player, opponent);

  for (var i = 0; i < readCount; i++) {
    readPage(player);
  }

  if (readCount > 0) {
    addLog(state, logRead(name, readCount, readCount * SP_PER_PAGE));
  } else {
    addLog(state, '📖 ' + name + ' は星典を詠まなかった（SP温存）');
  }

  state.readCount = readCount;
  syncGameState(state);
  return readCount;
}

function executeAutoMainPhase(state) {
  var player = getActivePlayer(state);
  var opponent = getInactivePlayer(state);
  var actions = [];
  var name = getPlayerName(player.id);

  function useBestAstral(maxCost) {
    var astral = selectBestCpuAstral(player, maxCost);

    if (!astral) return false;
    if (!spendSP(player, astral.cost)) return false;
    if (!summonAstral(player, astral, astral._pageIndex)) return false;

    addLog(state, logSummon(name, astral));
    actions.push('summon:' + astral.id);
    return true;
  }

  function useFateIfSelected() {
    var fate = selectAutoFate(player, opponent);

    if (!fate) return false;
    if (!applyFateEffect(player, fate, fate._pageIndex)) return false;

    addLog(state, logFate(name, fate.name, fate.effectDescription));
    actions.push('fate:' + fate.id);
    return true;
  }

  if (player.field.length === 0 && getAvailableAstrals(player.skyWindow, player.sp).length === 0) {
    useFateIfSelected();
  }

  if (player.field.length === 0) {
    useBestAstral();
  }

  useFateIfSelected();

  while (player.field.length < MAX_FIELD_ASTRALS) {
    var reserve = getAutoDefenseReserve(player, opponent);
    var budget = Math.max(0, player.sp - reserve);
    var canSpendReserve = player.field.length < 2;

    if (!useBestAstral(canSpendReserve ? undefined : budget)) {
      break;
    }
  }

  if (actions.length === 0) {
    addLog(state, '🜂 ' + name + ' は布陣を維持した');
  }

  syncGameState(state);
  return actions;
}

function shouldAutoAttackWithCombo(player, combo) {
  if (!combo) return false;
  if (combo.successLikely) return true;
  if (getRemainingPages(player) <= 4) return true;
  return combo.score >= -2;
}

function executeAutoDefenseResponse(state) {
  if (!state.currentBattle || state.currentBattle.battlePhase !== 'defendPhase') {
    return false;
  }

  var attackPower = calcAttackPower(
    state.currentBattle.attackAstral,
    state.currentBattle.attackSpell,
    state.currentBattle.overcharge
  );
  var defenseDecision = cpuDefenseReaction(state, attackPower);

  if (defenseDecision.type === 'defend' && defenseDecision.spellIndex >= 0) {
    return playerDefend(state, defenseDecision.spellIndex, defenseDecision.overcharge);
  }

  return playerDefend(state, -1, 0);
}

function executeAutoDamageChoice(state) {
  if (!state.currentBattle || state.currentBattle.battlePhase !== 'damageChoice') {
    return false;
  }

  var damageDecision = cpuGuardDecision(state, state.currentBattle.clashResult.totalDamage);

  if (damageDecision.type === 'guard' && damageDecision.astralIndex >= 0) {
    return playerGuard(state, damageDecision.astralIndex);
  }

  return playerTakeChronicleDamage(state);
}

function executeAutoBattlePhase(state) {
  var player = getActivePlayer(state);
  var opponent = getInactivePlayer(state);
  var attackSpells = getAvailableAttackSpells(player.skyWindow, player.sp);

  if (player.field.length === 0 || attackSpells.length === 0) {
    return false;
  }

  var combo = selectBestAttackCombo(player, attackSpells, opponent);
  if (!shouldAutoAttackWithCombo(player, combo)) {
    return false;
  }

  var astralIndex = player.field.indexOf(combo.astral);
  var spellIndex = player.skyWindow.indexOf(combo.spell);

  if (astralIndex < 0 || spellIndex < 0) {
    return false;
  }

  if (!playerStarStrike(state, astralIndex)) {
    return false;
  }

  if (!playerSelectAttackSpell(state, spellIndex, combo.overcharge)) {
    return false;
  }

  if (state.currentBattle && state.currentBattle.battlePhase === 'defendPhase') {
    executeAutoDefenseResponse(state);
  }

  if (state.currentBattle && state.currentBattle.battlePhase === 'damageChoice') {
    executeAutoDamageChoice(state);
  }

  return true;
}

function executeAutoTurnForActivePlayer(state) {
  if (!state || state.isGameOver) return false;

  if (state.phase !== 'start') {
    startPhase(state);
  }

  executeAutoStartPhase(state);
  goToMainPhase(state);
  executeAutoMainPhase(state);
  goToBattlePhase(state);

  var attacked = executeAutoBattlePhase(state);

  if (!attacked && state.phase === 'battle' && !state.currentBattle) {
    goToEndPhase(state);
  }

  return attacked;
}

function runPhase5Simulation(options) {
  var maxHalfTurns = options && options.maxHalfTurns ? options.maxHalfTurns : 80;
  var state = initGame({
    sync: true,
    autoRender: false,
    autoCpu: false
  });
  var report = {
    passed: true,
    checks: [],
    snapshots: [],
    summary: {}
  };
  var halfTurns = 0;
  var stalled = false;

  report.snapshots.push({
    label: 'init',
    state: createGameSnapshot(state)
  });

  while (!state.isGameOver && halfTurns < maxHalfTurns) {
    var beforeKey = [
      state.turn,
      state.activePlayer,
      state.phase,
      state.currentBattle ? state.currentBattle.battlePhase : 'none',
      state.log.length
    ].join(':');

    executeAutoTurnForActivePlayer(state);
    halfTurns++;

    var afterKey = [
      state.turn,
      state.activePlayer,
      state.phase,
      state.currentBattle ? state.currentBattle.battlePhase : 'none',
      state.log.length
    ].join(':');

    if (beforeKey === afterKey) {
      stalled = true;
      break;
    }

    if (halfTurns <= 6 || state.isGameOver || halfTurns % 6 === 0) {
      report.snapshots.push({
        label: 'half-turn-' + halfTurns,
        state: createGameSnapshot(state)
      });
    }
  }

  report.summary = {
    halfTurns: halfTurns,
    stalled: stalled,
    winner: state.winner,
    gameOver: state.isGameOver,
    finalTurn: state.turn,
    remainingPages: {
      player: getRemainingPages(state.player),
      cpu: getRemainingPages(state.cpu)
    },
    clashCount: countLogOccurrences(state.log, '星力衝突！'),
    guardCount: countLogOccurrences(state.log, '星護'),
    fateCount: countLogOccurrences(state.log, '🌟'),
    overchargeCount: countLogOccurrences(state.log, '過詠'),
    autoReadCount: countLogOccurrences(state.log, '（自動）')
  };

  pushSimulationCheck(report, state.player.field.length >= 1 || isDefeated(state.player), '試合中にプレイヤー星霊の状態管理が破綻しない');
  pushSimulationCheck(report, state.cpu.field.length >= 1 || isDefeated(state.cpu), '試合中にCPU星霊の状態管理が破綻しない');
  pushSimulationCheck(report, report.summary.clashCount > 0, '通しプレイで星力衝突が発生する');
  pushSimulationCheck(report, report.summary.autoReadCount > 0, 'エンドフェイズの自動詠みが発生する');
  pushSimulationCheck(report, !stalled, '試合が途中で停止しない');
  pushSimulationCheck(report, state.isGameOver === true, '1試合が最後まで完走する');
  pushSimulationCheck(report, !!state.winner, '勝者が正しく決定される');
  pushSimulationCheck(report, report.summary.guardCount > 0, '通しプレイで星護が発生する');
  pushSimulationCheck(report, report.summary.overchargeCount > 0, '通しプレイで過詠が発生する');
  pushSimulationCheck(report, report.summary.finalTurn <= Math.ceil(maxHalfTurns / 2) + 1, '規定ターン内に決着する');

  report.snapshots.push({
    label: 'final',
    state: createGameSnapshot(state)
  });

  console.group('Phase 5 Simulation');
  console.log('passed:', report.passed);
  console.table(report.checks);
  console.log('summary:', report.summary);
  console.log('snapshots:', report.snapshots);
  console.groupEnd();

  return {
    state: state,
    report: report
  };
}
