/* ========================================
   cpu.js — CPU行動ロジック
   ======================================== */

// =============================================
// CPUターン全体の実行
// =============================================

/**
 * CPUのターンを自動進行
 */
function executeCpuTurn(state) {
  if (state.isGameOver) return;

  // 1. スタートフェイズ: 詠み判断
  cpuStartPhase(state);

  setTimeout(function() {
    if (state.isGameOver) return;

    // 2. メインフェイズ: カード使用
    goToMainPhase(state);
    cpuMainPhase(state);

    setTimeout(function() {
      if (state.isGameOver) return;

      // 3. バトルフェイズ: 攻撃判断
      goToBattlePhase(state);
      var attacked = cpuBattlePhase(state);

      if (!attacked) {
        // 攻撃しない場合 → エンドフェイズ
        setTimeout(function() {
          goToEndPhase(state);
        }, 500);
      }
      // 攻撃した場合は resolveCurrentBattle → cpuDamageChoice → endBattle → endTurn の流れ
    }, 600);
  }, 600);
}

// =============================================
// スタートフェイズ
// =============================================

/**
 * CPUの詠み枚数を決定して実行
 */
function cpuStartPhase(state) {
  var cpu = state.cpu;
  var remaining = getRemainingPages(cpu);
  var readCount = 0;

  // 判断ロジック
  if (cpu.sp < 3 && remaining > 8) {
    readCount = 2;
  } else if (cpu.sp < 2 && remaining > 4) {
    readCount = 1;
  } else if (cpu.sp >= 6) {
    readCount = 0; // SPが十分ならめくらない
  } else if (remaining > 10) {
    readCount = 1; // 余裕ある
  } else {
    readCount = 0; // 温存
  }

  // 残りページ数で制限
  readCount = Math.min(readCount, remaining, MAX_READ_PER_TURN);

  for (var i = 0; i < readCount; i++) {
    readPage(cpu);
  }

  if (readCount > 0) {
    addLog(state, logRead('CPU', readCount, readCount * SP_PER_PAGE));
  } else {
    addLog(state, '📖 CPU は星典を詠まなかった（SP温存）');
  }

  state.readCount = readCount;
  renderGameState(state);
}

// =============================================
// メインフェイズ
// =============================================

/**
 * CPUのメインフェイズ行動
 */
function cpuMainPhase(state) {
  var cpu = state.cpu;
  var name = 'CPU';

  // 1. 星霊が場にいなければ最優先で召喚
  if (cpu.field.length === 0) {
    var astrals = getAvailableAstrals(cpu.skyWindow, cpu.sp);
    if (astrals.length > 0) {
      var card = astrals[0];
      spendSP(cpu, card.cost);
      summonAstral(cpu, card, card._pageIndex);
      addLog(state, logSummon(name, card));
    }
  }

  // 2. フィールドに余裕があれば追加召喚
  if (cpu.field.length < MAX_FIELD_ASTRALS) {
    var astrals = getAvailableAstrals(cpu.skyWindow, cpu.sp);
    for (var i = 0; i < astrals.length; i++) {
      if (cpu.field.length < MAX_FIELD_ASTRALS) {
        var card = astrals[i];
        if (spendSP(cpu, card.cost)) {
          summonAstral(cpu, card, card._pageIndex);
          addLog(state, logSummon(name, card));
        }
      }
    }
  }

  // 3. 星命カードの使用
  var fates = getAvailableFates(cpu.skyWindow, cpu.sp, cpu.usedFate);
  if (fates.length > 0) {
    var fate = fates[0];
    if (applyFateEffect(cpu, fate, fate._pageIndex)) {
      addLog(state, logFate(name, fate.name, fate.effectDescription));
    }
  }

  renderGameState(state);
}

// =============================================
// バトルフェイズ
// =============================================

/**
 * CPUのバトルフェイズ（攻撃判断）
 * @returns {boolean} 攻撃を行ったかどうか
 */
function cpuBattlePhase(state) {
  var cpu = state.cpu;
  var player = state.player;

  // 場に星霊がいなければ攻撃不可
  if (cpu.field.length === 0) return false;

  // 使用可能な攻星術を確認
  var attackSpells = getAvailableAttackSpells(cpu.skyWindow, cpu.sp);
  if (attackSpells.length === 0) return false;

  // 最適な星霊×攻星術の組み合わせを選択
  var bestCombo = selectBestAttackCombo(cpu, attackSpells, player);
  if (!bestCombo) return false;

  // 星撃宣言
  var astralIdx = cpu.field.indexOf(bestCombo.astral);
  playerStarStrike(state, astralIdx);

  // 攻星術選択 + 過詠
  var spellIdx = cpu.skyWindow.indexOf(bestCombo.spell);
  if (spellIdx >= 0) {
    playerSelectAttackSpell(state, spellIdx, bestCombo.overcharge);
    return true;
  }

  return false;
}

/**
 * 最適な攻撃コンボを選択
 */
function selectBestAttackCombo(cpu, spells, opponent) {
  var bestScore = -1;
  var bestCombo = null;

  for (var i = 0; i < cpu.field.length; i++) {
    var astral = cpu.field[i];

    for (var j = 0; j < spells.length; j++) {
      var spell = spells[j];

      // 過詠量の決定
      var maxOC = getMaxOvercharge(spell.cost);
      var availableOC = cpu.sp - spell.cost; // 使えるSPの余剰
      var overcharge = Math.min(maxOC, Math.max(0, availableOC));
      // SPが余裕ない場合は過詠しない
      if (cpu.sp - spell.cost - overcharge < 0) overcharge = 0;

      var atkPower = calcAttackPower(astral, spell, overcharge);

      // スコア計算
      var score = atkPower;
      // 共鳴ボーナスがあればスコアUP
      if (hasResonance(astral, spell)) score += 2;

      // 相手の防御を予測（最小防御力）
      var minDefPower = 0;
      if (opponent.field.length > 0) {
        minDefPower = opponent.field[0].power;
      }

      // 勝てる見込みがある場合のみ
      if (atkPower > minDefPower && score > bestScore) {
        bestScore = score;
        bestCombo = {
          astral: astral,
          spell: spell,
          overcharge: overcharge
        };
      }
    }
  }

  return bestCombo;
}

// =============================================
// 防御リアクション
// =============================================

/**
 * CPUの防御リアクション（プレイヤーの攻撃に対して）
 */
function cpuDefendAction(state) {
  var battle = state.currentBattle;
  var cpu = battle.defender;

  setTimeout(function() {
    // 使用可能な守星術を確認
    var defSpells = getAvailableDefenseSpells(cpu.skyWindow, cpu.sp);

    if (defSpells.length > 0 && battle.defenseAstral) {
      // 最も効果的な守星術を選択
      var bestSpell = null;
      var bestDefPower = 0;

      for (var i = 0; i < defSpells.length; i++) {
        var spell = defSpells[i];
        var defPower = calcDefensePower(battle.defenseAstral, spell, 0);

        // 攻撃を防げるか判断
        var atkPower = calcAttackPower(battle.attackAstral, battle.attackSpell, battle.overcharge);

        if (defPower >= atkPower && defPower > bestDefPower) {
          bestDefPower = defPower;
          bestSpell = spell;
        }
      }

      if (bestSpell) {
        // 守星術を使用
        var spellIdx = cpu.skyWindow.indexOf(bestSpell);
        playerDefend(state, spellIdx, 0);
        return;
      }
    }

    // 防御不可 → パス
    playerDefend(state, -1, 0);
  }, 600);
}

// =============================================
// ダメージ選択
// =============================================

/**
 * CPUのダメージ選択（星典 or 星護）
 */
function cpuDamageChoice(state) {
  var battle = state.currentBattle;
  var cpu = battle.defender;
  var damage = battle.clashResult.totalDamage;

  setTimeout(function() {
    var remaining = getRemainingPages(cpu);

    // 判断: 残りページが少なければ星護、多ければ星典で受ける
    if (remaining <= damage + 3 && cpu.field.length > 0) {
      // 星護を選択
      // 輝態の星霊を優先（蝕態だと消星するので）
      var guardIdx = -1;
      for (var i = 0; i < cpu.field.length; i++) {
        if (cpu.field[i].state === 'radiant') {
          guardIdx = i;
          break;
        }
      }
      // 輝態がなければ蝕態でも星護
      if (guardIdx === -1 && cpu.field.length > 0) {
        guardIdx = 0;
      }

      if (guardIdx >= 0) {
        playerGuard(state, guardIdx);
        return;
      }
    }

    // 星典で受ける
    playerTakeChronicleDamage(state);
  }, 600);
}
