/* ========================================
   battle.js — 戦闘ロジック
   星力衝突・共鳴・過詠・星護
   ======================================== */

// =============================================
// 共鳴（レゾナンス）システム
// =============================================

// hasResonance と getResonanceBonus は card.js で定義済み

// =============================================
// 過詠（オーバーチャージ）システム
// =============================================

/**
 * 過詠の上限を計算
 * 上限 = 通常コストの2倍
 */
function getMaxOvercharge(spellCost) {
  return Math.max(0, spellCost);
}

function clampOvercharge(extraSP, spellCost, availableExtraSP) {
  var requested = Math.max(0, extraSP || 0);
  var maxAllowed = Math.min(getMaxOvercharge(spellCost), Math.max(0, availableExtraSP || 0));
  return Math.min(requested, maxAllowed);
}

/**
 * 過詠によるダメージボーナスを計算
 * 追加SP 2ごとにダメージ +1
 */
function calcOverchargeDamageBonus(extraSP) {
  return Math.floor(extraSP / 2);
}

/**
 * 過詠による星力上昇ボーナスを計算
 * 追加SP 2ごとに星力 +1
 */
function calcOverchargePowerBonus(extraSP) {
  return Math.floor(extraSP / 2);
}

// =============================================
// 星力衝突
// =============================================

/**
 * 攻撃側の合計星力を計算
 * = 星霊の星力値 + 攻星術の星力上昇値 + 共鳴ボーナス + 過詠ボーナス + 一時バフ
 */
function calcAttackPower(astral, spell, overcharge) {
  if (!astral || !spell) return 0;
  var base = astral.power + (astral.tempPowerBoost || 0);
  var spellPower = spell.powerBoost;
  var resonance = getResonanceBonus(astral, spell);
  return base + spellPower + resonance;
}

/**
 * 防御側の合計星力を計算
 * 守星術なしの場合は0
 */
function calcDefensePower(astral, spell, overcharge) {
  if (!astral) return 0;
  if (!spell) return 0;  // 守星術なし → 防御力0

  var base = astral.power + (astral.tempPowerBoost || 0);
  var spellPower = spell.powerBoost;
  var resonance = getResonanceBonus(astral, spell);
  var ocBonus = calcOverchargePowerBonus(overcharge || 0);
  return base + spellPower + resonance + ocBonus;
}

/**
 * 星力衝突の判定
 * 攻撃側 > 防御側 → 攻撃成功（true）
 * 攻撃側 ≤ 防御側 → 攻撃失敗（false）— 同値は防御有利
 */
function resolveClash(attackPower, defensePower) {
  return attackPower > defensePower;
}

// =============================================
// ダメージ計算
// =============================================

/**
 * 攻撃成功時の総ダメージを計算
 * = 攻星術のダメージ値 + 過詠ダメージボーナス
 */
function calcTotalDamage(spell, overcharge) {
  var baseDamage = spell.damage;
  var ocDamage = calcOverchargeDamageBonus(overcharge || 0);
  return baseDamage + ocDamage;
}

/**
 * 星典にダメージを適用（ページをめくらせる）
 * @returns {number} 実際にめくれたページ数
 */
function applyChronicleDamage(player, damage) {
  var actualDamage = Math.min(Math.max(0, damage), getRemainingPages(player));
  player.chronicleIndex += actualDamage;
  return actualDamage;
}

// =============================================
// 星護（かばう）システム
// =============================================

/**
 * 星霊で星護する
 * 輝態 → 蝕態（'eclipse'を返す）
 * 蝕態 → 消星（'vanish'を返す）
 */
function guardWithAstral(astral) {
  if (!astral) return null;

  if (astral.state === 'radiant') {
    astral.state = 'eclipse';
    return 'eclipse';
  } else {
    // 蝕態の星霊が星護 → 消星
    astral.state = 'vanish';
    return 'vanish';
  }
}

// =============================================
// ユーティリティ
// =============================================

/**
 * 天窓から使用可能な攻星術を取得
 */
function getAvailableAttackSpells(skyWindow, sp) {
  var spells = [];
  for (var i = 0; i < skyWindow.length; i++) {
    var card = skyWindow[i];
    if (card.type === 'spell' && card.timing === 'attack' && card.cost <= sp) {
      spells.push(card);
    }
  }
  return spells;
}

/**
 * 天窓から使用可能な守星術を取得
 */
function getAvailableDefenseSpells(skyWindow, sp) {
  var spells = [];
  for (var i = 0; i < skyWindow.length; i++) {
    var card = skyWindow[i];
    if (card.type === 'spell' && card.timing === 'defense' && card.cost <= sp) {
      spells.push(card);
    }
  }
  return spells;
}

/**
 * 天窓から使用可能な星霊カードを取得
 */
function getAvailableAstrals(skyWindow, sp) {
  var astrals = [];
  for (var i = 0; i < skyWindow.length; i++) {
    var card = skyWindow[i];
    if (card.type === 'astral' && card.cost <= sp) {
      astrals.push(card);
    }
  }
  return astrals;
}

/**
 * 天窓から使用可能な星命カードを取得
 */
function getAvailableFates(skyWindow, sp, usedFate) {
  if (usedFate) return [];
  var fates = [];
  for (var i = 0; i < skyWindow.length; i++) {
    var card = skyWindow[i];
    if (card.type === 'fate' && card.cost <= sp) {
      fates.push(card);
    }
  }
  return fates;
}

/**
 * 星力衝突の結果を詳細オブジェクトで返す
 */
function createClashResult(attackAstral, attackSpell, overcharge,
                           defenseAstral, defenseSpell, defOvercharge) {
  var atkPower = calcAttackPower(attackAstral, attackSpell, overcharge);
  var defPower = calcDefensePower(defenseAstral, defenseSpell, defOvercharge);
  var atkResonance = hasResonance(attackAstral, attackSpell);
  var defResonance = defenseSpell ? hasResonance(defenseAstral, defenseSpell) : false;

  var success = resolveClash(atkPower, defPower);
  var totalDamage = success ? calcTotalDamage(attackSpell, overcharge) : 0;

  return {
    attackPower: atkPower,
    defensePower: defPower,
    attackResonance: atkResonance,
    defenseResonance: defResonance,
    overcharge: overcharge || 0,
    defenseOvercharge: defOvercharge || 0,
    success: success,
    totalDamage: totalDamage
  };
}
