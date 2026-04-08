/* ========================================
   ui.js — UI描画・DOM操作
   ======================================== */

var uiState = null;
resetUiState();

function createUiState() {
  return {
    chroniclePreviewOpen: false,
    selectedChroniclePage: null,
    pendingOvercharge: null
  };
}

function resetUiState() {
  uiState = createUiState();

  if (typeof window !== 'undefined') {
    window.uiState = uiState;
  }
}

function ensureUiState() {
  if (!uiState) {
    resetUiState();
  }
}

function syncUiStateWithGame(state) {
  ensureUiState();

  if (!state || !state.currentBattle) {
    uiState.pendingOvercharge = null;
    return;
  }

  var pending = uiState.pendingOvercharge;
  if (!pending) return;

  var expectedPhase = pending.mode === 'attack' ? 'selectSpell' : 'defendPhase';
  if (state.currentBattle.battlePhase !== expectedPhase) {
    uiState.pendingOvercharge = null;
    return;
  }

  var owner = pending.mode === 'attack' ? state.currentBattle.attacker : state.currentBattle.defender;
  if (!owner || owner.id !== 'player') {
    uiState.pendingOvercharge = null;
    return;
  }

  var card = owner.skyWindow[pending.skyWindowIndex];
  if (!card || card.type !== 'spell' || card.timing !== pending.mode) {
    uiState.pendingOvercharge = null;
    return;
  }

  var bounds = getOverchargeBounds(owner, card);
  pending.value = Math.max(0, Math.min(bounds.maxAvailable, pending.value || 0));
}

function getOverchargeBounds(player, spell) {
  var availableSP = Math.max(0, player.sp - spell.cost);
  var maxAvailable = Math.min(getMaxOvercharge(spell.cost), availableSP);

  return {
    availableSP: availableSP,
    maxAvailable: maxAvailable
  };
}

function getBattlePhaseLabel(battlePhase) {
  switch (battlePhase) {
    case 'selectSpell': return '攻星術選択';
    case 'defendPhase': return '防御対応';
    case 'resolve': return '星力衝突';
    case 'damageChoice': return 'ダメージ選択';
    default: return battlePhase;
  }
}

function renderActionButton(label, className, onClick, disabled, dataAction) {
  var attrs = 'class="btn ' + className + '"';
  if (dataAction) {
    attrs += ' data-action="' + dataAction + '"';
  }

  if (disabled) {
    attrs += ' disabled';
  } else if (onClick) {
    attrs += ' onclick="' + onClick + '"';
  }

  return '<button ' + attrs + '>' + label + '</button>';
}

function getCardTypeIcon(card) {
  if (!card) return '·';
  if (card.type === 'astral') return '⭐';
  if (card.type === 'spell' && card.timing === 'attack') return '⚔️';
  if (card.type === 'spell' && card.timing === 'defense') return '🛡️';
  if (card.type === 'fate') return '🌟';
  return '·';
}

function getCardTypeLabel(card) {
  if (!card) return '不明';
  if (card.type === 'astral') return '星霊';
  if (card.type === 'spell' && card.timing === 'attack') return '攻星術';
  if (card.type === 'spell' && card.timing === 'defense') return '守星術';
  if (card.type === 'fate') return '星命';
  return card.type;
}

function getChroniclePageStatus(player, pageIndex) {
  if (player.skyWindow.some(function(skyCard) { return skyCard._pageIndex === pageIndex; })) {
    return { label: '天窓', className: 'in-window' };
  }

  if (player.usedCardIndices.indexOf(pageIndex) >= 0) {
    return { label: '使用済み', className: 'played' };
  }

  if (pageIndex < player.chronicleIndex) {
    return { label: '読了', className: 'used' };
  }

  return { label: '未来ページ', className: 'future' };
}

function getRecommendedChroniclePageIndex(player) {
  if (!player || !player.chroniclePages || player.chroniclePages.length === 0) {
    return -1;
  }

  if (player.skyWindow.length > 0 && player.skyWindow[0]._pageIndex !== undefined) {
    return player.skyWindow[0]._pageIndex;
  }

  if (player.chronicleIndex < player.chroniclePages.length) {
    return player.chronicleIndex;
  }

  return player.chroniclePages.length - 1;
}

function getSelectedChroniclePageIndex(player) {
  var recommended = getRecommendedChroniclePageIndex(player);
  if (recommended < 0) return -1;

  if (uiState && typeof uiState.selectedChroniclePage === 'number' &&
      uiState.selectedChroniclePage >= 0 &&
      uiState.selectedChroniclePage < player.chroniclePages.length) {
    return uiState.selectedChroniclePage;
  }

  return recommended;
}

function isPlayerResponseWindow(state) {
  return !!(state &&
    state.currentBattle &&
    state.currentBattle.defender.id === 'player' &&
    (state.currentBattle.battlePhase === 'defendPhase' ||
      state.currentBattle.battlePhase === 'damageChoice'));
}

function isPlayerInteractionWindow(state) {
  return !!(state && (state.activePlayer === 'player' || isPlayerResponseWindow(state)));
}

function getFieldActionMeta(isPlayer, state, index) {
  var meta = {
    clickable: false,
    onClick: '',
    actionLabel: '',
    actionClass: ''
  };

  if (!isPlayer || !state) {
    return meta;
  }

  if (state.phase === 'battle' && !state.currentBattle && state.activePlayer === 'player') {
    if (getAvailableAttackSpells(state.player.skyWindow, state.player.sp).length === 0) {
      meta.actionLabel = '攻星術なし';
      meta.actionClass = 'locked';
      return meta;
    }

    meta.clickable = true;
    meta.onClick = 'playerStarStrike(gameState, ' + index + ')';
    meta.actionLabel = '星撃宣言';
    meta.actionClass = 'attack';
    return meta;
  }

  if (state.currentBattle &&
      state.currentBattle.battlePhase === 'damageChoice' &&
      state.currentBattle.defender.id === 'player') {
    meta.clickable = true;
    meta.onClick = 'playerGuard(gameState, ' + index + ')';
    meta.actionLabel = '星護で受ける';
    meta.actionClass = 'guard';
  }

  return meta;
}

function getCardInteractionMeta(card, index, state) {
  var meta = {
    clickable: false,
    onClick: '',
    statusLabel: '',
    disabledReason: '',
    selected: false,
    resonant: false
  };

  if (!state || !isPlayerInteractionWindow(state)) {
    meta.disabledReason = 'CPUのターンです';
    return meta;
  }

  if (state.phase === 'main' && state.activePlayer === 'player') {
    if (card.type === 'astral') {
      if (state.player.field.length >= MAX_FIELD_ASTRALS) {
        meta.disabledReason = 'フィールド上限です';
      } else if (state.player.sp < card.cost) {
        meta.disabledReason = 'SPが足りません';
      } else {
        meta.clickable = true;
        meta.onClick = 'playerPlayCard(gameState, ' + index + ')';
        meta.statusLabel = '召喚可能';
      }
      return meta;
    }

    if (card.type === 'fate') {
      if (state.player.usedFate) {
        meta.disabledReason = '星命はこのターン使用済み';
      } else if (state.player.sp < card.cost) {
        meta.disabledReason = 'SPが足りません';
      } else {
        meta.clickable = true;
        meta.onClick = 'playerPlayCard(gameState, ' + index + ')';
        meta.statusLabel = '発動可能';
      }
      return meta;
    }

    meta.disabledReason = '星術はバトルフェイズで使います';
    return meta;
  }

  if (state.currentBattle &&
      state.currentBattle.battlePhase === 'selectSpell' &&
      state.currentBattle.attacker.id === 'player' &&
      card.type === 'spell' &&
      card.timing === 'attack') {
    if (state.currentBattle.attacker.sp < card.cost) {
      meta.disabledReason = 'SPが足りません';
    } else {
      meta.clickable = true;
      meta.onClick = 'showOverchargeDialog(gameState, ' + index + ')';
      meta.statusLabel = '攻撃術を選択';
    }
    meta.resonant = hasResonance(state.currentBattle.attackAstral, card);
    meta.selected = !!(uiState.pendingOvercharge &&
      uiState.pendingOvercharge.mode === 'attack' &&
      uiState.pendingOvercharge.skyWindowIndex === index);
    return meta;
  }

  if (state.currentBattle &&
      state.currentBattle.battlePhase === 'defendPhase' &&
      state.currentBattle.defender.id === 'player' &&
      card.type === 'spell' &&
      card.timing === 'defense') {
    if (state.currentBattle.defender.sp < card.cost) {
      meta.disabledReason = 'SPが足りません';
    } else {
      meta.clickable = true;
      meta.onClick = 'showDefenseOverchargeDialog(gameState, ' + index + ')';
      meta.statusLabel = '守星術を選択';
    }
    meta.resonant = !!state.currentBattle.defenseAstral &&
      hasResonance(state.currentBattle.defenseAstral, card);
    meta.selected = !!(uiState.pendingOvercharge &&
      uiState.pendingOvercharge.mode === 'defense' &&
      uiState.pendingOvercharge.skyWindowIndex === index);
    return meta;
  }

  if (card.type === 'spell') {
    meta.disabledReason = 'いまは選べません';
  } else if (card.type === 'astral') {
    meta.disabledReason = 'メインフェイズで召喚します';
  } else {
    meta.disabledReason = 'メインフェイズで発動します';
  }

  return meta;
}

function renderGameState(state) {
  if (!state) return;

  ensureUiState();
  syncUiStateWithGame(state);

  var container = document.getElementById('game-container');
  if (!container) return;

  container.innerHTML = '';

  if (state.isGameOver) {
    container.innerHTML = renderGameOverHTML(state);
    return;
  }

  var html = '';
  html += '<div class="game-shell">';
  html += renderTurnBannerHTML(state);
  html += renderStatusHTML(state.cpu, false, state);

  html += '<div class="field-area cpu-field">';
  html += '<div class="field-label">── CPUフィールド ──</div>';
  html += renderFieldHTML(state.cpu.field, false, state);
  html += '</div>';

  if (state.currentBattle) {
    html += renderBattleZoneHTML(state);
  }

  html += '<div class="field-area player-field">';
  html += '<div class="field-label">── プレイヤーフィールド ──</div>';
  html += renderFieldHTML(state.player.field, true, state);
  html += '</div>';

  html += renderStatusHTML(state.player, true, state);
  html += renderSkyWindowHTML(state);

  html += '<div class="bottom-area">';
  html += renderControlsHTML(state);
  html += renderLogHTML(state.log);
  html += '</div>';

  html += renderChroniclePreviewHTML(state.player);
  html += '</div>';

  container.innerHTML = html;
}

function renderTurnBannerHTML(state) {
  var activeName = state.activePlayer === 'player' ? 'プレイヤー行動中' : 'CPU行動中';

  if (isPlayerResponseWindow(state)) {
    activeName = 'プレイヤー応答中';
  }

  return '<div class="turn-banner">' +
    '<div class="turn-banner-title">星典戦記</div>' +
    '<div class="turn-banner-meta">' +
      '<span class="turn-chip">Turn ' + state.turn + '</span>' +
      '<span class="turn-chip turn-chip-' + state.activePlayer + '">' + activeName + '</span>' +
      '<span class="turn-chip">' + getPhaseDisplayName(state.phase) + '</span>' +
    '</div>' +
  '</div>';
}

function renderStatusHTML(player, isSelf, state) {
  var name = isSelf ? 'プレイヤー' : 'CPU';
  var remaining = getRemainingPages(player);
  var total = player.chroniclePages.length;
  var filled = Math.round((remaining / total) * 10);
  var stars = '';
  var cls = isSelf ? 'status-bar player-status' : 'status-bar cpu-status';

  if (player.id === state.activePlayer) {
    cls += ' is-active';
  }

  for (var i = 0; i < 10; i++) {
    stars += i < filled ? '★' : '☆';
  }

  return '<div class="' + cls + '">' +
    '<span class="status-name">' + name + '</span>' +
    '<span class="status-chronicle">星典 [' + stars + '] ' + remaining + '/' + total + '</span>' +
    '<span class="status-sp">SP: ' + player.sp + '</span>' +
  '</div>';
}

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
    var actionMeta = getFieldActionMeta(isPlayer, state, i);
    var classes = 'astral-card ' + stateClass + ' ' + bgClass;
    var attrs = 'class="' + classes + '"';

    if (actionMeta.clickable) {
      attrs = 'class="' + classes + ' clickable is-' + actionMeta.actionClass + '" ' +
        'onclick="' + actionMeta.onClick + '" data-action="' + actionMeta.actionClass + '"';
    }

    html += '<div ' + attrs + '>';
    html += '<div class="card-header">';
    html += '<span class="card-name ' + elementClass + '">' + astral.name + '</span>';
    html += '</div>';
    html += '<div class="card-stats">';
    html += '<span class="card-power">星力: ' + (astral.power + (astral.tempPowerBoost || 0)) + '</span>';
    html += '<span class="card-element">' + ELEMENT_NAMES[astral.element] + '</span>';
    html += '</div>';
    html += '<div class="card-state ' + stateClass + '">' +
      (astral.state === 'radiant' ? '✦ 輝態' : '✧ 蝕態') +
    '</div>';

    if (astral.tempPowerBoost > 0) {
      html += '<div class="astral-boost">鼓舞 +' + astral.tempPowerBoost + '</div>';
    }

    if (actionMeta.actionLabel) {
      html += '<div class="card-action-hint is-' + actionMeta.actionClass + '">' +
        actionMeta.actionLabel +
      '</div>';
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderSkyWindowHTML(state) {
  if (!isPlayerInteractionWindow(state)) {
    return '<div class="sky-window-area is-sleeping">' +
      '<div class="sky-window-label">天窓（使用可能カード）</div>' +
      '<div class="sky-window-empty">CPUの行動中は星の流れを見守ります</div>' +
    '</div>';
  }

  var cards = state.player.skyWindow;
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
  var meta = getCardInteractionMeta(card, index, state);
  var elementClass = card.element ? 'element-' + card.element : '';
  var bgClass = card.element ? 'bg-' + card.element : '';
  var classes = 'hand-card ' + bgClass;
  var attrs = '';

  if (meta.clickable) {
    classes += ' clickable';
    attrs += ' onclick="' + meta.onClick + '"';
  } else {
    classes += ' is-disabled';
  }

  if (meta.selected) {
    classes += ' is-selected';
  }

  if (meta.resonant) {
    classes += ' is-resonant';
  }

  attrs += ' class="' + classes + '"';
  attrs += ' data-card-index="' + index + '"';

  if (meta.statusLabel) {
    attrs += ' data-card-status="' + meta.statusLabel + '"';
  }

  if (meta.disabledReason) {
    attrs += ' title="' + meta.disabledReason + '"';
  }

  var typeIcon = '';
  if (card.type === 'astral') typeIcon = '⭐';
  else if (card.type === 'spell' && card.timing === 'attack') typeIcon = '⚔️';
  else if (card.type === 'spell' && card.timing === 'defense') typeIcon = '🛡️';
  else if (card.type === 'fate') typeIcon = '🌟';

  var html = '<div ' + attrs + '>';
  html += '<div class="card-type-icon">' + typeIcon + '</div>';
  html += '<div class="card-name ' + elementClass + '">' + card.name + '</div>';
  html += '<div class="card-cost">SP:' + card.cost + '</div>';

  if (meta.resonant) {
    html += '<div class="card-resonance-badge">共鳴 +1</div>';
  }

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

  html += '<div class="card-footnote">';
  if (meta.statusLabel) {
    html += '<span class="card-availability">' + meta.statusLabel + '</span>';
  } else if (meta.disabledReason) {
    html += '<span class="card-availability is-muted">' + meta.disabledReason + '</span>';
  } else {
    html += '<span class="card-availability is-muted">待機中</span>';
  }
  html += '</div>';
  html += '</div>';

  return html;
}

function renderBattleZoneHTML(state) {
  var battle = state.currentBattle;
  if (!battle) return '';

  var attackPower = battle.attackSpell ?
    calcAttackPower(battle.attackAstral, battle.attackSpell, battle.overcharge) :
    battle.attackAstral.power + (battle.attackAstral.tempPowerBoost || 0);
  var defensePower = battle.defenseSpell ?
    calcDefensePower(battle.defenseAstral, battle.defenseSpell, battle.defenseOvercharge) :
    (battle.defenseAstral ? battle.defenseAstral.power + (battle.defenseAstral.tempPowerBoost || 0) : 0);

  var html = '<div class="battle-zone">';
  html += '<div class="battle-topline">';
  html += '<div class="battle-title">⚔️ 星力衝突</div>';
  html += '<div class="battle-step">' + getBattlePhaseLabel(battle.battlePhase) + '</div>';
  html += '</div>';

  html += '<div class="battle-info">';
  html += '<div class="battle-side attack-side">';
  html += '<div class="side-label">攻撃側</div>';
  html += '<div class="side-astral">' + battle.attackAstral.name + '</div>';
  html += '<div class="side-power">合計星力 ' + attackPower + '</div>';
  if (battle.attackSpell) {
    html += '<div class="side-spell">+ ' + battle.attackSpell.name + '</div>';
    if (hasResonance(battle.attackAstral, battle.attackSpell)) {
      html += '<div class="side-bonus resonance">共鳴 +1</div>';
    }
    if (battle.overcharge > 0) {
      html += '<div class="side-bonus overcharge">過詠 +' + battle.overcharge + '</div>';
    }
  } else {
    html += '<div class="side-spell no-spell">攻星術を選択してください</div>';
  }
  html += '</div>';

  html += '<div class="battle-vs">VS</div>';

  html += '<div class="battle-side defense-side">';
  html += '<div class="side-label">防御側</div>';
  if (battle.defenseAstral) {
    html += '<div class="side-astral">' + battle.defenseAstral.name + '</div>';
  } else {
    html += '<div class="side-astral">星霊なし</div>';
  }
  html += '<div class="side-power">合計星力 ' + defensePower + '</div>';
  if (battle.defenseSpell) {
    html += '<div class="side-spell">+ ' + battle.defenseSpell.name + '</div>';
    if (battle.defenseAstral && hasResonance(battle.defenseAstral, battle.defenseSpell)) {
      html += '<div class="side-bonus resonance">共鳴 +1</div>';
    }
    if (battle.defenseOvercharge > 0) {
      html += '<div class="side-bonus overcharge">過詠 +' + battle.defenseOvercharge + '</div>';
    }
  } else if (battle.battlePhase === 'resolve' || battle.battlePhase === 'damageChoice') {
    html += '<div class="side-spell no-spell">守星術なし</div>';
  } else {
    html += '<div class="side-spell no-spell">防御対応待ち</div>';
  }
  html += '</div>';
  html += '</div>';

  html += renderBattleGuidanceHTML(state);

  if (battle.clashResult) {
    html += renderClashResultHTML(battle.clashResult);
  }

  if (uiState.pendingOvercharge) {
    html += renderOverchargeUI(state);
  }

  if (battle.battlePhase === 'damageChoice' && battle.defender.id === 'player') {
    html += renderDamageChoiceHTML(state);
  }

  html += '</div>';
  return html;
}

function renderBattleGuidanceHTML(state) {
  var battle = state.currentBattle;
  var html = '<div class="battle-guidance">';

  if (battle.battlePhase === 'selectSpell' && battle.attacker.id === 'player') {
    if (getAvailableAttackSpells(battle.attacker.skyWindow, battle.attacker.sp).length === 0) {
      html += '使える攻星術がないため、この星撃宣言はいったん取り消して立て直す。';
    } else {
      html += '攻星術を選び、必要なら過詠で押し込む。';
    }
  } else if (battle.battlePhase === 'defendPhase' && battle.defender.id === 'player') {
    html += '守星術で受けるか、パスして星典か星護で受けるかを見極める。';
  } else if (battle.battlePhase === 'damageChoice' && battle.defender.id === 'player') {
    html += '星典で受けるか、星霊で星護するかを選択。';
  } else {
    html += '星の衝突結果を待機中。';
  }

  html += '</div>';
  return html;
}

function renderClashResultHTML(clashResult) {
  return '<div class="clash-result ' + (clashResult.success ? 'is-win' : 'is-loss') + '">' +
    '<div class="clash-result-title">' +
      (clashResult.success ? '攻撃成功' : '攻撃失敗') +
    '</div>' +
    '<div class="clash-result-detail">攻撃 ' + clashResult.attackPower +
      ' / 防御 ' + clashResult.defensePower +
      (clashResult.success ? ' / ダメージ ' + clashResult.totalDamage : '') +
    '</div>' +
  '</div>';
}

function renderDamageChoiceHTML(state) {
  var battle = state.currentBattle;
  var defender = battle.defender;
  var html = '<div class="damage-choice">';
  html += '<div class="damage-choice-title">💥 ダメージ ' + battle.clashResult.totalDamage + ' をどう受ける？</div>';
  html += '<div class="damage-choice-actions">';
  html += renderActionButton('📖 星典で受ける', 'btn-chronicle-dmg',
    'playerTakeChronicleDamage(gameState)', false, 'take-chronicle-damage');

  for (var i = 0; i < defender.field.length; i++) {
    var astral = defender.field[i];
    var nextState = astral.state === 'radiant' ? '輝態→蝕態' : '蝕態→消星';
    html += renderActionButton('🛡 ' + astral.name + ' で星護（' + nextState + '）',
      'btn-guard-choice', 'playerGuard(gameState, ' + i + ')', false, 'guard-' + i);
  }

  html += '</div>';
  html += '</div>';
  return html;
}

function renderControlsHTML(state) {
  var html = '<div class="controls-panel">';
  html += '<div class="phase-indicator">フェイズ: ' + getPhaseDisplayName(state.phase) + '</div>';

  if (!isPlayerInteractionWindow(state)) {
    html += '<div class="cpu-thinking">🜂 CPU思考中...</div>';
    html += '<div class="controls-subhint">ログとバトルゾーンで進行を確認できます。</div>';
    html += '</div>';
    return html;
  }

  if (uiState.pendingOvercharge) {
    html += '<div class="controls-hint">過詠パネルで追加SPを調整して確定してください</div>';
    html += '</div>';
    return html;
  }

  switch (state.phase) {
    case 'start':
      html += '<div class="controls-subhint">詠みは最大' + MAX_READ_PER_TURN + '回。SPは増えるが星典も削れます。</div>';
      html += '<div class="controls-group">';
      html += renderActionButton('📖 星典を詠む（残り' + (MAX_READ_PER_TURN - state.readCount) + '回）',
        'btn-read', 'playerReadPage(gameState)',
        state.readCount >= MAX_READ_PER_TURN || !canRead(state.player), 'read-page');
      html += renderActionButton('▶ メインフェイズへ', 'btn-next',
        'playerEndStartPhase(gameState)', false, 'to-main-phase');
      html += '</div>';
      break;

    case 'main':
      html += '<div class="controls-hint">天窓の星霊や星命をクリックして展開</div>';
      html += '<div class="controls-subhint">フィールド ' + state.player.field.length + '/' + MAX_FIELD_ASTRALS +
        ' 体 / 星命 ' + (state.player.usedFate ? '使用済み' : '未使用') + '</div>';
      html += '<div class="controls-group">';
      html += renderActionButton('▶ バトルフェイズへ', 'btn-next',
        'playerEndMainPhase(gameState)', false, 'to-battle-phase');
      html += renderActionButton('⏭ ターン終了', 'btn-pass',
        'playerEndTurn(gameState)', false, 'end-turn-from-main');
      html += '</div>';
      break;

    case 'battle':
      if (!state.currentBattle) {
        if (getAvailableAttackSpells(state.player.skyWindow, state.player.sp).length === 0) {
          html += '<div class="controls-hint">使える攻星術がないため、このターンは攻撃できません</div>';
          html += '<div class="controls-subhint">バトルをスキップしてエンドフェイズへ進めます。</div>';
        } else {
          html += '<div class="controls-hint">フィールドの星霊をクリックして星撃宣言</div>';
          html += '<div class="controls-subhint">攻撃しないならバトルをスキップしてターンを畳めます。</div>';
        }
        html += '<div class="controls-group">';
        html += renderActionButton('⏩ バトルスキップ', 'btn-skip',
          'playerSkipBattle(gameState)', false, 'skip-battle');
        html += '</div>';
      } else if (state.currentBattle.battlePhase === 'selectSpell') {
        if (getAvailableAttackSpells(state.currentBattle.attacker.skyWindow, state.currentBattle.attacker.sp).length === 0) {
          html += '<div class="controls-hint">使える攻星術がないため、星撃宣言を取り消してください</div>';
        } else {
          html += '<div class="controls-hint">攻星術カードをクリックして、画面内で過詠を調整</div>';
        }
        html += '<div class="controls-group">';
        html += renderActionButton('↩ 星撃宣言を取り消す', 'btn-pass',
          'playerCancelStarStrike(gameState)', false, 'cancel-star-strike');
        html += '</div>';
      } else if (state.currentBattle.battlePhase === 'defendPhase' &&
          state.currentBattle.defender.id === 'player') {
        html += '<div class="controls-hint">守星術を選択、またはパス</div>';
        html += '<div class="controls-group">';
        html += renderActionButton('🚫 パス（守星術なし）', 'btn-pass',
          'playerDefend(gameState, -1, 0)', false, 'pass-defense');
        html += '</div>';
      } else if (state.currentBattle.battlePhase === 'damageChoice' &&
          state.currentBattle.defender.id === 'player') {
        html += '<div class="controls-hint">バトルゾーンの受け方ボタンから選択</div>';
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

function renderLogHTML(logs) {
  var html = '<div class="log-area">';
  html += '<div class="log-title">ログ</div>';
  html += '<div class="log-content" id="log-content">';

  var start = Math.max(0, logs.length - 20);
  for (var i = start; i < logs.length; i++) {
    html += '<div class="log-entry">' + logs[i] + '</div>';
  }

  html += '</div>';
  html += '</div>';
  return html;
}

function renderChroniclePreviewHTML(player) {
  var remaining = getRemainingPages(player);
  var nextPageIndex = player.chronicleIndex < player.chroniclePages.length ? player.chronicleIndex : -1;
  var nextCard = nextPageIndex >= 0 ? player.chroniclePages[nextPageIndex] : null;
  var html = '<div class="chronicle-preview ' + (uiState.chroniclePreviewOpen ? 'is-open' : 'is-collapsed') + '">';
  html += '<button class="preview-toggle" onclick="toggleChroniclePreview()" data-action="toggle-preview">';
  html += '<span>📜 星典プレビュー</span>';
  html += '<span>' + remaining + 'ページ残り / ' + (uiState.chroniclePreviewOpen ? '閉じる' : '展開') + '</span>';
  html += '</button>';

  if (uiState.chroniclePreviewOpen) {
    var selectedPageIndex = getSelectedChroniclePageIndex(player);
    var selectedCard = selectedPageIndex >= 0 ? player.chroniclePages[selectedPageIndex] : null;
    var selectedStatus = selectedPageIndex >= 0 ? getChroniclePageStatus(player, selectedPageIndex) : null;

    html += '<div class="preview-legend">';
    html += '<span class="legend-item">淡色: 読了</span>';
    html += '<span class="legend-item">縁取り: 使用済み</span>';
    html += '<span class="legend-item">濃色: 未来ページ</span>';
    html += '<span class="legend-item">クリック: 下に詳細表示</span>';
    html += '</div>';
    html += '<div class="preview-pages">';

    for (var i = 0; i < player.chroniclePages.length; i++) {
      var card = player.chroniclePages[i];
      var status = getChroniclePageStatus(player, i);
      var cls = 'preview-page ' + status.className;
      var elementCls = card.element ? ' preview-' + card.element : '';
      var isSelected = i === selectedPageIndex;

      html += '<button class="' + cls + elementCls + (isSelected ? ' is-selected' : '') + '"' +
        ' onclick="selectChroniclePage(' + i + ')" data-action="preview-page-' + i + '">' +
        '<span class="preview-page-index">' + (i + 1) + '</span>' +
        '<span class="preview-page-icon">' + getCardTypeIcon(card) + '</span>' +
      '</button>';
    }

    html += '</div>';

    if (selectedCard) {
      var detailBgClass = selectedCard.element ? ' bg-' + selectedCard.element : ' bg-neutral';
      var detailElementClass = selectedCard.element ? ' element-' + selectedCard.element : '';
      html += '<div class="preview-focus-card ' + detailBgClass + '">';
      html += '<div class="preview-focus-header">';
      html += '<div>';
      html += '<div class="preview-focus-page">Page ' + (selectedPageIndex + 1) + '</div>';
      html += '<div class="preview-focus-title ' + detailElementClass + '">' +
        getCardTypeIcon(selectedCard) + ' ' + selectedCard.name +
      '</div>';
      html += '</div>';
      html += '<div class="preview-focus-meta">';
      html += '<span class="preview-focus-status is-' + selectedStatus.className + '">' + selectedStatus.label + '</span>';
      html += '<span class="preview-focus-status">' + getCardTypeLabel(selectedCard) + '</span>';
      if (selectedCard.element) {
        html += '<span class="preview-focus-status is-element">' + ELEMENT_NAMES[selectedCard.element] + '</span>';
      }
      html += '</div>';
      html += '</div>';

      html += '<div class="preview-focus-grid">';
      html += '<div class="preview-focus-detail">コスト: ' + selectedCard.cost + ' SP</div>';
      if (selectedCard.type === 'astral') {
        html += '<div class="preview-focus-detail">星力: ' + selectedCard.power + '</div>';
      } else if (selectedCard.type === 'spell') {
        html += '<div class="preview-focus-detail">星力上昇: +' + selectedCard.powerBoost + '</div>';
        html += '<div class="preview-focus-detail">ダメージ: ' + (selectedCard.damage || 0) + '</div>';
      } else if (selectedCard.type === 'fate') {
        html += '<div class="preview-focus-detail">効果種別: ' + selectedCard.effectType + '</div>';
      }
      html += '</div>';

      if (selectedCard.type === 'fate') {
        html += '<div class="preview-focus-effect">' + selectedCard.effectDescription + '</div>';
      } else if (selectedCard.type === 'spell') {
        html += '<div class="preview-focus-effect">' +
          (selectedCard.timing === 'attack' ? '自分のバトルで使用する攻星術。' : '相手のバトルに応じる守星術。') +
        '</div>';
      } else {
        html += '<div class="preview-focus-effect">場に出して戦う星霊カード。</div>';
      }

      html += '</div>';
    }
  } else {
    html += '<div class="preview-summary">';
    html += '<span class="preview-summary-chip">読了 ' + player.chronicleIndex + '</span>';
    html += '<span class="preview-summary-chip">場の星霊 ' + player.field.length + '</span>';
    html += '<span class="preview-summary-chip">天窓 ' + player.skyWindow.length + '</span>';
    if (nextCard) {
      html += '<span class="preview-summary-chip">次ページ ' + (nextPageIndex + 1) + ': ' + nextCard.name + '</span>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderGameOverHTML(state) {
  var winnerName = state.winner === 'player' ? 'プレイヤー' : 'CPU';
  var loser = state.winner === 'player' ? state.cpu : state.player;
  var reason = getRemainingPages(loser) <= 0 ? '星典消滅' : '星霊全滅';

  var html = '<div class="game-over">';
  html += '<h1 class="game-over-title">';
  html += state.winner === 'player' ? '🏆 勝利！ 🏆' : '💀 敗北… 💀';
  html += '</h1>';
  html += '<p class="game-over-detail">' + winnerName + 'の勝利（' + reason + '）</p>';
  html += '<p class="game-over-detail">ターン数: ' + state.turn + '</p>';
  html += renderActionButton('もう一度プレイ', 'btn-restart', 'location.reload()', false, 'restart');
  html += renderLogHTML(state.log);
  html += '</div>';
  return html;
}

function showOverchargeDialog(state, skyWindowIndex) {
  openOverchargePanel(state, 'attack', skyWindowIndex);
}

function showDefenseOverchargeDialog(state, skyWindowIndex) {
  openOverchargePanel(state, 'defense', skyWindowIndex);
}

function openOverchargePanel(state, mode, skyWindowIndex) {
  ensureUiState();

  if (!state || !state.currentBattle) return;

  var owner = mode === 'attack' ? state.currentBattle.attacker : state.currentBattle.defender;
  var card = owner.skyWindow[skyWindowIndex];
  if (!card || card.type !== 'spell' || card.timing !== mode) return;

  var bounds = getOverchargeBounds(owner, card);
  uiState.pendingOvercharge = {
    mode: mode,
    skyWindowIndex: skyWindowIndex,
    value: 0,
    maxAvailable: bounds.maxAvailable
  };

  syncGameState(state);
}

function cancelOverchargeSelection() {
  ensureUiState();
  uiState.pendingOvercharge = null;
  syncGameState(gameState);
}

function setPendingOverchargeValue(nextValue) {
  ensureUiState();
  if (!uiState.pendingOvercharge || !gameState || !gameState.currentBattle) return;

  var pending = uiState.pendingOvercharge;
  var owner = pending.mode === 'attack' ? gameState.currentBattle.attacker : gameState.currentBattle.defender;
  var card = owner.skyWindow[pending.skyWindowIndex];
  if (!card) return;

  var bounds = getOverchargeBounds(owner, card);
  pending.maxAvailable = bounds.maxAvailable;
  pending.value = Math.max(0, Math.min(bounds.maxAvailable, parseInt(nextValue, 10) || 0));

  syncGameState(gameState);
}

function adjustPendingOvercharge(delta) {
  if (!uiState || !uiState.pendingOvercharge) return;
  setPendingOverchargeValue((uiState.pendingOvercharge.value || 0) + delta);
}

function confirmOverchargeSelection() {
  ensureUiState();
  if (!uiState.pendingOvercharge || !gameState) return;

  var pending = uiState.pendingOvercharge;
  var overcharge = pending.value || 0;
  var skyWindowIndex = pending.skyWindowIndex;
  var mode = pending.mode;

  uiState.pendingOvercharge = null;

  if (mode === 'attack') {
    playerSelectAttackSpell(gameState, skyWindowIndex, overcharge);
  } else {
    playerDefend(gameState, skyWindowIndex, overcharge);
  }
}

function renderOverchargeUI(state) {
  var pending = uiState.pendingOvercharge;
  if (!pending || !state.currentBattle) return '';

  var owner = pending.mode === 'attack' ? state.currentBattle.attacker : state.currentBattle.defender;
  var spell = owner.skyWindow[pending.skyWindowIndex];
  if (!spell) return '';

  var bounds = getOverchargeBounds(owner, spell);
  var value = Math.max(0, Math.min(bounds.maxAvailable, pending.value || 0));
  var totalCost = spell.cost + value;
  var bonus = pending.mode === 'attack' ?
    'ダメージ +' + calcOverchargeDamageBonus(value) :
    '防御星力 +' + calcOverchargePowerBonus(value);

  return '<div class="overcharge-panel">' +
    '<div class="overcharge-header">' +
      '<div class="overcharge-title">🔥 過詠調整</div>' +
      '<div class="overcharge-spell">' + spell.name + '</div>' +
    '</div>' +
    '<div class="overcharge-summary">' +
      '<span>通常 ' + spell.cost + ' SP</span>' +
      '<span>追加 ' + value + ' SP</span>' +
      '<span>合計 ' + totalCost + ' SP</span>' +
      '<span>' + bonus + '</span>' +
    '</div>' +
    '<div class="overcharge-slider-row">' +
      renderActionButton('−', 'btn-step', 'adjustPendingOvercharge(-1)', value <= 0, 'overcharge-minus') +
      '<input class="overcharge-slider" type="range" min="0" max="' + bounds.maxAvailable + '" step="1" value="' + value + '"' +
        ' oninput="setPendingOverchargeValue(this.value)" data-action="overcharge-slider">' +
      renderActionButton('+', 'btn-step', 'adjustPendingOvercharge(1)', value >= bounds.maxAvailable, 'overcharge-plus') +
    '</div>' +
    '<div class="overcharge-footnote">' +
      '上限 ' + bounds.maxAvailable + ' SP。奇数値は効果計算時に端数切り捨て。' +
    '</div>' +
    '<div class="overcharge-actions">' +
      renderActionButton('確定', 'btn-next', 'confirmOverchargeSelection()', false, 'confirm-overcharge') +
      renderActionButton('取り消し', 'btn-pass', 'cancelOverchargeSelection()', false, 'cancel-overcharge') +
    '</div>' +
  '</div>';
}

function toggleChroniclePreview() {
  ensureUiState();
  uiState.chroniclePreviewOpen = !uiState.chroniclePreviewOpen;

  if (uiState.chroniclePreviewOpen && gameState && gameState.player) {
    uiState.selectedChroniclePage = getSelectedChroniclePageIndex(gameState.player);
  }

  syncGameState(gameState);
}

function selectChroniclePage(pageIndex) {
  ensureUiState();
  if (!gameState || !gameState.player) return;
  if (pageIndex < 0 || pageIndex >= gameState.player.chroniclePages.length) return;

  uiState.chroniclePreviewOpen = true;
  uiState.selectedChroniclePage = pageIndex;
  syncGameState(gameState);
}
