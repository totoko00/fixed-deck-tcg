/* ========================================
   ui.js — UI描画・DOM操作
   ======================================== */

// =============================================
// メインレンダリング
// =============================================

/**
 * ゲーム画面全体を再描画
 */
function renderGameState(state) {
  if (!state) return;

  var container = document.getElementById('game-container');
  container.innerHTML = '';

  if (state.isGameOver) {
    container.innerHTML = renderGameOverHTML(state);
    return;
  }

  var html = '';

  // CPU情報エリア
  html += renderStatusHTML(state.cpu, false);

  // CPUフィールド
  html += '<div class="field-area cpu-field">';
  html += '<div class="field-label">── CPUフィールド ──</div>';
  html += renderFieldHTML(state.cpu.field, false);
  html += '</div>';

  // 星撃ゾーン（バトル中の表示）
  if (state.currentBattle) {
    html += renderBattleZoneHTML(state);
  }

  // プレイヤーフィールド
  html += '<div class="field-area player-field">';
  html += '<div class="field-label">── プレイヤーフィールド ──</div>';
  html += renderFieldHTML(state.player.field, true, state);
  html += '</div>';

  // プレイヤー情報エリア
  html += renderStatusHTML(state.player, true);

  // 天窓エリア（使用可能カード）
  html += renderSkyWindowHTML(state);

  // 操作パネル + ログ
  html += '<div class="bottom-area">';
  html += renderControlsHTML(state);
  html += renderLogHTML(state.log);
  html += '</div>';

  // 星典プレビュー
  html += renderChroniclePreviewHTML(state.player);

  container.innerHTML = html;
}

// =============================================
// ステータスバー
// =============================================

function renderStatusHTML(player, isSelf) {
  var name = isSelf ? 'プレイヤー' : 'CPU';
  var remaining = getRemainingPages(player);
  var total = player.chroniclePages.length;

  // 星典残りプログレスバー
  var filled = Math.round((remaining / total) * 10);
  var stars = '';
  for (var i = 0; i < 10; i++) {
    stars += i < filled ? '★' : '☆';
  }

  var cls = isSelf ? 'status-bar player-status' : 'status-bar cpu-status';

  return '<div class="' + cls + '">' +
    '<span class="status-name">' + name + '</span>' +
    '<span class="status-chronicle">星典 [' + stars + '] ' + remaining + '/' + total + '</span>' +
    '<span class="status-sp">SP: ' + player.sp + '</span>' +
    '</div>';
}

// =============================================
// フィールド描画
// =============================================

function renderFieldHTML(field, isPlayer, state) {
  if (field.length === 0) {
    return '<div class="field-empty">星霊なし</div>';
  }

  var html = '<div class="field-cards">';
  for (var i = 0; i < field.length; i++) {
    var astral = field[i];
    var stateClass = astral.state === 'radiant' ? 'radiant' : 'eclipse';
    var elementClass = 'element-' + astral.element;
    var bgClass = 'bg-' + astral.element;

    var clickable = '';
    // バトルフェイズで星撃宣言可能
    if (isPlayer && state && state.phase === 'battle' && !state.currentBattle) {
      clickable = ' clickable" onclick="playerStarStrike(gameState, ' + i + ')';
    }
    // ダメージ選択で星護可能
    if (isPlayer && state && state.currentBattle &&
        state.currentBattle.battlePhase === 'damageChoice' &&
        state.currentBattle.defender.id === 'player') {
      clickable = ' clickable" onclick="playerGuard(gameState, ' + i + ')';
    }

    html += '<div class="astral-card ' + stateClass + ' ' + bgClass + clickable + '">';
    html += '<div class="card-header">';
    html += '<span class="card-name ' + elementClass + '">' + astral.name + '</span>';
    html += '</div>';
    html += '<div class="card-stats">';
    html += '<span class="card-power">星力: ' + (astral.power + (astral.tempPowerBoost || 0)) + '</span>';
    html += '<span class="card-element">' + ELEMENT_NAMES[astral.element] + '</span>';
    html += '</div>';
    html += '<div class="card-state ' + stateClass + '">' + (astral.state === 'radiant' ? '✦ 輝態' : '✧ 蝕態') + '</div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// =============================================
// 天窓（使用可能カード）
// =============================================

function renderSkyWindowHTML(state) {
  var player = state.activePlayer === 'player' ? state.player : null;
  if (!player) return '';

  var cards = player.skyWindow;

  var html = '<div class="sky-window-area">';
  html += '<div class="sky-window-label">天窓（使用可能カード）</div>';

  if (cards.length === 0) {
    html += '<div class="sky-window-empty">使用可能なカードがありません</div>';
  } else {
    html += '<div class="sky-window-cards">';
    for (var i = 0; i < cards.length; i++) {
      html += renderCardHTML(cards[i], i, state);
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderCardHTML(card, index, state) {
  var elementClass = card.element ? 'element-' + card.element : '';
  var bgClass = card.element ? 'bg-' + card.element : '';
  var clickAction = '';

  // クリック可能判定
  if (state.phase === 'main' && (card.type === 'astral' || card.type === 'fate')) {
    clickAction = ' clickable" onclick="playerPlayCard(gameState, ' + index + ')';
  }
  if (state.currentBattle && state.currentBattle.battlePhase === 'selectSpell' &&
      card.type === 'spell' && card.timing === 'attack' &&
      state.currentBattle.attacker.id === 'player') {
    clickAction = ' clickable" onclick="showOverchargeDialog(gameState, ' + index + ')';
  }
  if (state.currentBattle && state.currentBattle.battlePhase === 'defendPhase' &&
      card.type === 'spell' && card.timing === 'defense' &&
      state.currentBattle.defender.id === 'player') {
    clickAction = ' clickable" onclick="showDefenseOverchargeDialog(gameState, ' + index + ')';
  }

  var html = '<div class="hand-card ' + bgClass + clickAction + '">';

  // カード種別アイコン
  var typeIcon = '';
  if (card.type === 'astral') typeIcon = '⭐';
  else if (card.type === 'spell' && card.timing === 'attack') typeIcon = '⚔️';
  else if (card.type === 'spell' && card.timing === 'defense') typeIcon = '🛡️';
  else if (card.type === 'fate') typeIcon = '🌟';

  html += '<div class="card-type-icon">' + typeIcon + '</div>';
  html += '<div class="card-name ' + elementClass + '">' + card.name + '</div>';
  html += '<div class="card-cost">SP:' + card.cost + '</div>';

  // カード別の詳細情報
  if (card.type === 'astral') {
    html += '<div class="card-detail">星力:' + card.power + '</div>';
  } else if (card.type === 'spell') {
    html += '<div class="card-detail">星力↑+' + card.powerBoost + '</div>';
    if (card.damage > 0) {
      html += '<div class="card-detail">DMG:' + card.damage + '</div>';
    }
  } else if (card.type === 'fate') {
    html += '<div class="card-detail card-effect">' + card.effectDescription + '</div>';
  }

  if (card.element) {
    html += '<div class="card-element-badge ' + elementClass + '">' + ELEMENT_NAMES[card.element] + '</div>';
  }

  html += '</div>';
  return html;
}

// =============================================
// バトルゾーン
// =============================================

function renderBattleZoneHTML(state) {
  var battle = state.currentBattle;
  if (!battle) return '';

  var html = '<div class="battle-zone">';
  html += '<div class="battle-title">⚔️ 星力衝突 ⚔️</div>';

  // 攻撃側の情報
  html += '<div class="battle-info">';
  html += '<div class="battle-side attack-side">';
  html += '<div class="side-label">攻撃側</div>';
  html += '<div class="side-astral">' + battle.attackAstral.name + '</div>';
  if (battle.attackSpell) {
    html += '<div class="side-spell">+ ' + battle.attackSpell.name + '</div>';
    if (battle.overcharge > 0) html += '<div class="side-oc">過詠+' + battle.overcharge + '</div>';
  }
  html += '</div>';

  html += '<div class="battle-vs">VS</div>';

  // 防御側の情報
  html += '<div class="battle-side defense-side">';
  html += '<div class="side-label">防御側</div>';
  if (battle.defenseAstral) {
    html += '<div class="side-astral">' + battle.defenseAstral.name + '</div>';
  }
  if (battle.defenseSpell) {
    html += '<div class="side-spell">+ ' + battle.defenseSpell.name + '</div>';
  } else if (battle.battlePhase === 'resolve' || battle.battlePhase === 'damageChoice') {
    html += '<div class="side-spell no-spell">守星術なし</div>';
  }
  html += '</div>';
  html += '</div>';

  // ダメージ選択UI
  if (battle.battlePhase === 'damageChoice' && battle.defender.id === 'player') {
    html += '<div class="damage-choice">';
    html += '<div class="damage-choice-title">💥 ダメージ:' + battle.clashResult.totalDamage + '  どう受ける？</div>';
    html += '<button class="btn btn-chronicle-dmg" onclick="playerTakeChronicleDamage(gameState)">📖 星典で受ける</button>';
    if (state.player.field.length > 0) {
      html += '<button class="btn btn-guard" onclick="">🛡️ 星霊で星護（上の星霊をクリック）</button>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// =============================================
// 操作パネル
// =============================================

function renderControlsHTML(state) {
  var html = '<div class="controls-panel">';
  html += '<div class="phase-indicator">フェイズ: ' + getPhaseDisplayName(state.phase) + '</div>';

  if (state.activePlayer !== 'player') {
    html += '<div class="cpu-thinking">🤔 CPU思考中...</div>';
    html += '</div>';
    return html;
  }

  switch (state.phase) {
    case 'start':
      html += '<div class="controls-group">';
      html += '<button class="btn btn-read" onclick="playerReadPage(gameState)">📖 星典を詠む（残り' + (MAX_READ_PER_TURN - state.readCount) + '回）</button>';
      html += '<button class="btn btn-next" onclick="playerEndStartPhase(gameState)">▶ メインフェイズへ</button>';
      html += '</div>';
      break;

    case 'main':
      html += '<div class="controls-hint">天窓のカードをクリックして使用</div>';
      html += '<div class="controls-group">';
      html += '<button class="btn btn-next" onclick="playerEndMainPhase(gameState)">▶ バトルフェイズへ</button>';
      html += '</div>';
      break;

    case 'battle':
      if (!state.currentBattle) {
        html += '<div class="controls-hint">フィールドの星霊をクリックして星撃宣言</div>';
        html += '<div class="controls-group">';
        html += '<button class="btn btn-skip" onclick="playerSkipBattle(gameState)">⏩ バトルスキップ</button>';
        html += '</div>';
      } else if (state.currentBattle.battlePhase === 'selectSpell') {
        html += '<div class="controls-hint">天窓の攻星術をクリックして選択</div>';
      } else if (state.currentBattle.battlePhase === 'defendPhase' && state.currentBattle.defender.id === 'player') {
        html += '<div class="controls-hint">守星術を選択、またはパス</div>';
        html += '<div class="controls-group">';
        html += '<button class="btn btn-pass" onclick="playerDefend(gameState, -1, 0)">🚫 パス（守星術なし）</button>';
        html += '</div>';
      }
      break;
  }

  html += '</div>';
  return html;
}

function getPhaseDisplayName(phase) {
  switch (phase) {
    case 'start': return 'スタートフェイズ';
    case 'main': return 'メインフェイズ';
    case 'battle': return 'バトルフェイズ';
    case 'end': return 'エンドフェイズ';
    default: return phase;
  }
}

// =============================================
// ログエリア
// =============================================

function renderLogHTML(logs) {
  var html = '<div class="log-area">';
  html += '<div class="log-title">ログ</div>';
  html += '<div class="log-content" id="log-content">';

  // 最新20件を表示
  var start = Math.max(0, logs.length - 20);
  for (var i = start; i < logs.length; i++) {
    html += '<div class="log-entry">' + logs[i] + '</div>';
  }

  html += '</div>';
  html += '</div>';
  return html;
}

// =============================================
// 星典プレビュー
// =============================================

function renderChroniclePreviewHTML(player) {
  var html = '<div class="chronicle-preview">';
  html += '<div class="preview-label">📜 星典プレビュー（クリックで展開）</div>';
  html += '<div class="preview-pages">';

  for (var i = 0; i < player.chroniclePages.length; i++) {
    var card = player.chroniclePages[i];
    var cls = 'preview-page';

    if (i < player.chronicleIndex) {
      cls += ' used';
    } else if (player.usedCardIndices.indexOf(i) >= 0) {
      cls += ' played';
    }

    var elementCls = card.element ? ' preview-' + card.element : '';
    var tip = (i + 1) + ': ' + card.name;

    html += '<span class="' + cls + elementCls + '" title="' + tip + '">';
    if (card.type === 'astral') html += '⭐';
    else if (card.type === 'spell' && card.timing === 'attack') html += '⚔️';
    else if (card.type === 'spell' && card.timing === 'defense') html += '🛡️';
    else if (card.type === 'fate') html += '🌟';
    html += '</span>';
  }

  html += '</div></div>';
  return html;
}

// =============================================
// ゲームオーバー画面
// =============================================

function renderGameOverHTML(state) {
  var winnerName = state.winner === 'player' ? 'プレイヤー' : 'CPU';
  var loser = state.winner === 'player' ? state.cpu : state.player;
  var reason = getRemainingPages(loser) <= 0 ? '星典消滅' : '星霊全滅';

  var html = '<div class="game-over">';
  html += '<h1 class="game-over-title">';
  if (state.winner === 'player') {
    html += '🏆 勝利！ 🏆';
  } else {
    html += '💀 敗北… 💀';
  }
  html += '</h1>';
  html += '<p class="game-over-detail">' + winnerName + 'の勝利（' + reason + '）</p>';
  html += '<p class="game-over-detail">ターン数: ' + state.turn + '</p>';
  html += '<button class="btn btn-restart" onclick="location.reload()">もう一度プレイ</button>';

  // 最終ログ
  html += renderLogHTML(state.log);

  html += '</div>';
  return html;
}

// =============================================
// 過詠ダイアログ
// =============================================

function showOverchargeDialog(state, skyWindowIndex) {
  var player = state.currentBattle.attacker;
  var spell = player.skyWindow[skyWindowIndex];
  if (!spell) return;

  var maxOC = getMaxOvercharge(spell.cost);
  var availableSP = player.sp - spell.cost;
  var maxAvailableOC = Math.min(maxOC, Math.max(0, availableSP));

  // シンプルにpromptで過詠量を入力
  var ocStr = prompt(
    '「' + spell.name + '」を使用\n' +
    '通常コスト: ' + spell.cost + ' SP\n' +
    '過詠可能量: 0〜' + maxAvailableOC + ' SP\n' +
    '（2SPごとにダメージ+1 & 星力+1）\n\n' +
    '追加SPを入力（0で過詠なし）:',
    '0'
  );

  if (ocStr === null) return; // キャンセル

  var oc = parseInt(ocStr) || 0;
  oc = Math.max(0, Math.min(maxAvailableOC, oc));

  playerSelectAttackSpell(state, skyWindowIndex, oc);
}

function showDefenseOverchargeDialog(state, skyWindowIndex) {
  var player = state.currentBattle.defender;
  var spell = player.skyWindow[skyWindowIndex];
  if (!spell) return;

  var maxOC = getMaxOvercharge(spell.cost);
  var availableSP = player.sp - spell.cost;
  var maxAvailableOC = Math.min(maxOC, Math.max(0, availableSP));

  var ocStr = prompt(
    '守星術「' + spell.name + '」で防御\n' +
    '通常コスト: ' + spell.cost + ' SP\n' +
    '過詠可能量: 0〜' + maxAvailableOC + ' SP\n' +
    '（2SPごとに星力上昇+1）\n\n' +
    '追加SPを入力（0で過詠なし）:',
    '0'
  );

  if (ocStr === null) return;

  var oc = parseInt(ocStr) || 0;
  oc = Math.max(0, Math.min(maxAvailableOC, oc));

  playerDefend(state, skyWindowIndex, oc);
}
