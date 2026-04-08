/* ========================================
   logger.js — ログ管理
   ======================================== */

/**
 * ゲームログにメッセージを追加
 */
function addLog(state, message) {
  if (!state.log) state.log = [];
  state.log.push(message);
  console.log('[LOG] ' + message);
}

/**
 * 詠みログ
 */
function logRead(playerName, pages, spGained) {
  return '📖 ' + playerName + ' が星典を' + pages + 'ページ詠んだ（SP+' + spGained + '）';
}

/**
 * 星力衝突ログ
 */
function logClash(attackerName, defenderName, clashResult) {
  var msg = '⚔️ 星力衝突！ ' + attackerName + '(星力:' + clashResult.attackPower + ')';
  if (clashResult.attackResonance) msg += '✨共鳴';
  if (clashResult.overcharge > 0) msg += '🔥過詠+' + clashResult.overcharge;
  msg += ' vs ' + defenderName + '(星力:' + clashResult.defensePower + ')';
  if (clashResult.defenseResonance) msg += '✨共鳴';
  if (clashResult.defenseOvercharge > 0) msg += '🔥過詠+' + clashResult.defenseOvercharge;
  msg += ' → ' + (clashResult.success ? '攻撃成功！' : '攻撃失敗…');
  return msg;
}

/**
 * ダメージログ
 */
function logDamage(playerName, damage, type) {
  if (type === 'chronicle') {
    return '💥 ' + playerName + ' の星典が' + damage + 'ページめくられた！';
  } else if (type === 'guard') {
    return '🛡️ ' + playerName + ' の星霊が星護した！';
  }
  return '';
}

/**
 * 共鳴発動ログ
 */
function logResonance(astralName, spellName) {
  return '✨ 共鳴発動！ ' + astralName + ' × ' + spellName + ' （星力+' + RESONANCE_BONUS + '）';
}

/**
 * 過詠ログ
 */
function logOvercharge(playerName, extraSP) {
  return '🔥 ' + playerName + ' が過詠！ 追加SP:' + extraSP;
}

/**
 * 星霊召喚ログ
 */
function logSummon(playerName, astral) {
  return '⭐ ' + playerName + ' が ' + astral.name + ' を召喚！（星力:' + astral.power + ' ' + ELEMENT_NAMES[astral.element] + '属性）';
}

/**
 * 星護ログ
 */
function logGuard(playerName, astralName, result) {
  if (result === 'eclipse') {
    return '🛡️ ' + astralName + ' が星護！ 輝態 → 蝕態';
  } else {
    return '💀 ' + astralName + ' が星護するも消星！';
  }
}

/**
 * 星命使用ログ
 */
function logFate(playerName, fateName, description) {
  return '🌟 ' + playerName + ' が ' + fateName + ' を発動！ ' + description;
}

/**
 * 星術使用ログ
 */
function logSpellUse(playerName, spellName, timing) {
  var icon = timing === 'attack' ? '⚔️' : '🛡️';
  var label = timing === 'attack' ? '攻星術' : '守星術';
  return icon + ' ' + playerName + ' が' + label + '「' + spellName + '」を使用！';
}

/**
 * フェイズ変更ログ
 */
function logPhaseChange(phaseName) {
  return '── ' + phaseName + ' ──';
}

/**
 * ターン開始ログ
 */
function logTurnStart(turn, activePlayerName) {
  return '═══ ターン' + turn + ': ' + activePlayerName + 'のターン ═══';
}

/**
 * 勝敗ログ
 */
function logWinner(winnerName, reason) {
  return '🏆 ' + winnerName + ' の勝利！（' + reason + '）';
}
