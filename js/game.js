/* ========================================
   game.js — ゲームループ・状態管理
   ターン・フェイズの進行制御
   ======================================== */

// --- ゲーム状態（グローバル） ---
var gameState = null;

// =============================================
// ゲーム初期化
// =============================================

/**
 * ゲーム全体を初期化
 */
function initGame() {
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
    currentBattle: null
  };

  // --- ゲーム開始処理 ---
  addLog(gameState, '★ 星典戦記 開幕 ★');

  // 1. 1ページ目の星霊を場に召喚（両方）
  setupInitialAstral(gameState.player, 'プレイヤー');
  setupInitialAstral(gameState.cpu, 'CPU');

  // 2. 初期詠み（1ページ）→ SP+2
  performInitialRead(gameState.player, 'プレイヤー');
  performInitialRead(gameState.cpu, 'CPU');

  // 3. ターン開始
  addLog(gameState, logTurnStart(gameState.turn, 'プレイヤー'));
  addLog(gameState, logPhaseChange('スタートフェイズ'));

  return gameState;
}

/**
 * 初期星霊の召喚（1ページ目）
 */
function setupInitialAstral(player, playerName) {
  var firstCard = player.chroniclePages[0];
  if (firstCard.type === 'astral') {
    // 1ページ目をフィールドに出す
    summonAstral(player, firstCard);
    player.chronicleIndex = 1; // 1ページ目は使用済み
    player.usedCardIndices.push(0);
    addLog(gameState, logSummon(playerName, firstCard));
  }
}

/**
 * 初期詠み（1ページ）
 */
function performInitialRead(player, playerName) {
  var card = readPage(player);
  if (card) {
    addLog(gameState, logRead(playerName, 1, SP_PER_PAGE));
  }
}

// =============================================
// ゲッター関数
// =============================================

function getActivePlayer() {
  return gameState.activePlayer === 'player' ? gameState.player : gameState.cpu;
}

function getInactivePlayer() {
  return gameState.activePlayer === 'player' ? gameState.cpu : gameState.player;
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
  resetTurnState(getActivePlayer());
}

/**
 * プレイヤーが星典を1ページ詠む（スタートフェイズ中）
 * @returns {boolean} 詠めたかどうか
 */
function playerReadPage(state) {
  if (state.phase !== 'start') return false;
  if (state.readCount >= MAX_READ_PER_TURN) return false;

  var player = getActivePlayer();
  if (!canRead(player)) return false;

  var card = readPage(player);
  if (card) {
    state.readCount++;
    var name = getPlayerName(state.activePlayer);
    addLog(state, logRead(name, 1, SP_PER_PAGE));
    renderGameState(state);
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
  renderGameState(state);
}

/**
 * カードをプレイ（天窓からカード使用）
 * @param {number} skyWindowIndex - 天窓内のインデックス
 */
function playerPlayCard(state, skyWindowIndex) {
  if (state.phase !== 'main') return false;

  var player = getActivePlayer();
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

  renderGameState(state);
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
  renderGameState(state);
}

/**
 * 星撃宣言（攻撃する星霊を選択）
 */
function playerStarStrike(state, astralIndex) {
  if (state.phase !== 'battle') return false;

  var attacker = getActivePlayer();
  var defender = getInactivePlayer();

  if (astralIndex < 0 || astralIndex >= attacker.field.length) return false;

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

  renderGameState(state);
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

  var totalCost = card.cost + (overcharge || 0);
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
  state.currentBattle.overcharge = overcharge || 0;

  var name = getPlayerName(state.activePlayer);
  addLog(state, logSpellUse(name, card.name, 'attack'));
  if (overcharge > 0) {
    addLog(state, logOvercharge(name, overcharge));
  }
  if (hasResonance(state.currentBattle.attackAstral, card)) {
    addLog(state, logResonance(state.currentBattle.attackAstral.name, card.name));
  }

  // 防御リアクションフェイズへ
  state.currentBattle.battlePhase = 'defendPhase';

  // CPUの場合は自動で防御判断
  if (state.currentBattle.defender.id === 'cpu') {
    cpuDefendAction(state);
  } else {
    renderGameState(state);
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

    var totalCost = card.cost + (overcharge || 0);
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
    state.currentBattle.defenseOvercharge = overcharge || 0;

    var name = getPlayerName(defender.id);
    addLog(state, logSpellUse(name, card.name, 'defense'));
    if (overcharge > 0) {
      addLog(state, logOvercharge(name, overcharge));
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

    if (battle.defender.id === 'cpu') {
      // CPUは自動判断
      cpuDamageChoice(state);
    } else {
      renderGameState(state);
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
    renderGameState(state);
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

  var player = getActivePlayer();
  var name = getPlayerName(state.activePlayer);

  // 1. 消星した星霊の除去（念のため）
  cleanupField(player);

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
  if (state.activePlayer === 'cpu') {
    renderGameState(state);
    setTimeout(function() {
      executeCpuTurn(state);
    }, 800);
  } else {
    renderGameState(state);
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
  renderGameState(state);
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
