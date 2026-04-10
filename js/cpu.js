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

  cpuStartPhase(state);

  scheduleStateTask(state, function() {
    if (state.isGameOver) return;

    goToMainPhase(state);
    cpuMainPhase(state);

    scheduleStateTask(state, function() {
      if (state.isGameOver) return;

      goToBattlePhase(state);

      if (!cpuBattlePhase(state)) {
        addLog(state, '🜂 CPU は攻め時ではないと判断した');
        scheduleStateTask(state, function() {
          goToEndPhase(state);
        }, 500);
      }
    }, 600);
  }, 600);
}

// =============================================
// CPU共通ヘルパー
// =============================================

function getCpuOverchargeValues(spellCost, availableExtraSP) {
  var values = [0];
  var maxOvercharge = clampOvercharge(availableExtraSP, spellCost, availableExtraSP);

  for (var extra = 2; extra <= maxOvercharge; extra += 2) {
    values.push(extra);
  }

  return values;
}

function calcCpuProjectedAttackPower(astral, spell, bonusPower) {
  var base = astral.power + (astral.tempPowerBoost || 0) + (bonusPower || 0);
  return base + spell.powerBoost + getResonanceBonus(astral, spell);
}

function getCpuAttackBonusForAstral(cpu, astral, options) {
  if (!options) return 0;
  if (typeof options.buffTargetIndex === 'number' &&
      options.buffTargetIndex >= 0 &&
      options.buffTargetIndex < cpu.field.length &&
      astral === cpu.field[options.buffTargetIndex]) {
    return options.buffAmount || options.firstAstralBonus || 0;
  }
  if (!options.firstAstralBonus) return 0;
  if (cpu.field.length === 0) return 0;
  return astral === cpu.field[0] ? options.firstAstralBonus : 0;
}

function countCpuResonantSpells(cpu, element, timing) {
  var count = 0;

  for (var i = 0; i < cpu.skyWindow.length; i++) {
    var card = cpu.skyWindow[i];
    if (card.type !== 'spell') continue;
    if (timing && card.timing !== timing) continue;
    if (card.element === element) count++;
  }

  return count;
}

function getCpuAiHint(card, key) {
  if (!card || !card.aiHints) return 0;
  return card.aiHints[key] || 0;
}

function scoreCpuAstralCard(cpu, astral) {
  var attackMatches = countCpuResonantSpells(cpu, astral.element, 'attack');
  var defenseMatches = countCpuResonantSpells(cpu, astral.element, 'defense');

  return astral.power * 3 +
    attackMatches * 4 +
    defenseMatches * 3 -
    astral.cost * 2 +
    getCpuAiHint(astral, 'aggression') +
    getCpuAiHint(astral, 'defense') * 2 +
    getCpuAiHint(astral, 'curve');
}

function selectBestCpuAstral(cpu, maxCost) {
  var bestCard = null;
  var bestScore = -Infinity;

  for (var i = 0; i < cpu.skyWindow.length; i++) {
    var card = cpu.skyWindow[i];
    if (card.type !== 'astral') continue;
    if (card.cost > cpu.sp) continue;
    if (typeof maxCost === 'number' && card.cost > maxCost) continue;

    var score = scoreCpuAstralCard(cpu, card);
    if (cpu.field.length === 0) {
      score += 8;
    } else if (cpu.field.length === 1) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  return bestCard;
}

function getCpuDefenseReserve(state, cpu) {
  if (!state || !state.player || state.player.field.length === 0) return 0;

  var reserve = 0;

  for (var i = 0; i < cpu.skyWindow.length; i++) {
    var card = cpu.skyWindow[i];
    if (card.type !== 'spell' || card.timing !== 'defense') continue;

    if (reserve === 0 || card.cost < reserve) {
      reserve = card.cost;
    }
  }

  return reserve;
}

function buildCpuDefensePreview(defender, attackPower) {
  var preview = {
    canBlock: false,
    spell: null,
    overcharge: 0,
    defensePower: 0,
    totalCost: 0
  };

  if (!defender || defender.field.length === 0) {
    return preview;
  }

  var defenseAstral = defender.field[0];
  var spells = getAvailableDefenseSpells(defender.skyWindow, defender.sp);

  for (var i = 0; i < spells.length; i++) {
    var spell = spells[i];
    var availableExtra = Math.max(0, defender.sp - spell.cost);
    var overchargeValues = getCpuOverchargeValues(spell.cost, availableExtra);

    for (var j = 0; j < overchargeValues.length; j++) {
      var overcharge = overchargeValues[j];
      var defensePower = calcDefensePower(defenseAstral, spell, overcharge);
      var totalCost = spell.cost + overcharge;
      var canBlock = defensePower >= attackPower;

      if (canBlock) {
        if (!preview.canBlock ||
            totalCost < preview.totalCost ||
            (totalCost === preview.totalCost && defensePower < preview.defensePower)) {
          preview.canBlock = true;
          preview.spell = spell;
          preview.overcharge = overcharge;
          preview.defensePower = defensePower;
          preview.totalCost = totalCost;
        }
      } else if (!preview.canBlock && defensePower > preview.defensePower) {
        preview.spell = spell;
        preview.overcharge = overcharge;
        preview.defensePower = defensePower;
        preview.totalCost = totalCost;
      }
    }
  }

  return preview;
}

function selectBestAttackCombo(cpu, spells, opponent, options) {
  var bestCombo = null;
  var bestScore = -Infinity;
  var spAvailable = options && typeof options.spAvailable === 'number' ? options.spAvailable : cpu.sp;

  for (var i = 0; i < cpu.field.length; i++) {
    var astral = cpu.field[i];
    var attackBonus = getCpuAttackBonusForAstral(cpu, astral, options);

    for (var j = 0; j < spells.length; j++) {
      var spell = spells[j];
      if (spell.cost > spAvailable) continue;

      var overchargeValues = getCpuOverchargeValues(spell.cost, spAvailable - spell.cost);

      for (var k = 0; k < overchargeValues.length; k++) {
        var overcharge = overchargeValues[k];
        var attackPower = calcCpuProjectedAttackPower(astral, spell, attackBonus);
        var totalDamage = calcTotalDamage(spell, overcharge);
        var defensePreview = buildCpuDefensePreview(opponent, attackPower);
        var successLikely = !defensePreview.canBlock;
        var score;

        if (successLikely) {
          score = totalDamage * 8 + attackPower * 2 - overcharge;

          if (hasResonance(astral, spell)) score += 4;
          if (totalDamage >= getRemainingPages(opponent)) score += 18;
          if (opponent.field.length === 0) score += 6;
          score += getCpuAiHint(spell, 'aggression');
          score += getCpuAiHint(spell, 'burst');
          score += getCpuAiHint(spell, 'finisher') * 2;
        } else {
          score = attackPower - defensePreview.defensePower - defensePreview.totalCost - 12;
          score += getCpuAiHint(spell, 'stability');
        }

        if (score > bestScore) {
          bestScore = score;
          bestCombo = {
            astral: astral,
            spell: spell,
            overcharge: overcharge,
            attackPower: attackPower,
            totalDamage: totalDamage,
            defensePreview: defensePreview,
            successLikely: successLikely,
            score: score
          };
        }
      }
    }
  }

  return bestCombo;
}

function selectCpuFate(state) {
  return selectBestFateForPlayer(state.cpu, state.player);
}

function selectCpuGuardAstralIndex(player) {
  var bestRadiant = -1;
  var bestRadiantPower = Infinity;
  var bestEclipse = -1;
  var bestEclipsePower = Infinity;

  for (var i = 0; i < player.field.length; i++) {
    var astral = player.field[i];

    if (astral.state === 'radiant' && astral.power < bestRadiantPower) {
      bestRadiantPower = astral.power;
      bestRadiant = i;
    }

    if (astral.state === 'eclipse' && astral.power < bestEclipsePower) {
      bestEclipsePower = astral.power;
      bestEclipse = i;
    }
  }

  return bestRadiant >= 0 ? bestRadiant : bestEclipse;
}

// =============================================
// スタートフェイズ
// =============================================

/**
 * CPUの詠み枚数を決定して実行
 * @returns {number} 実際に詠んだ枚数
 */
function cpuStartPhase(state) {
  var cpu = state.cpu;
  var remaining = getRemainingPages(cpu);
  var readCount = 0;

  if (cpu.field.length === 0 && getAvailableAstrals(cpu.skyWindow, cpu.sp).length === 0 && remaining > 0) {
    readCount = 1;
  }

  if (cpu.sp < 3 && remaining > 8) {
    readCount = Math.max(readCount, 2);
  } else if (cpu.sp < 2 && remaining > 4) {
    readCount = Math.max(readCount, 1);
  } else if (cpu.sp >= 6) {
    readCount = Math.max(readCount, 0);
  } else if (remaining > 10 && cpu.sp < 5) {
    readCount = Math.max(readCount, 1);
  }

  if (remaining <= 6 && cpu.sp >= 4) {
    readCount = Math.min(readCount, 1);
  }

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
  syncGameState(state);
  return readCount;
}

// =============================================
// メインフェイズ
// =============================================

/**
 * CPUのメインフェイズ行動
 * @returns {string[]} 行動ログ用ラベル
 */
function cpuMainPhase(state) {
  var cpu = state.cpu;
  var actions = [];
  var name = 'CPU';

  function useBestAstral(maxCost) {
    var astral = selectBestCpuAstral(cpu, maxCost);

    if (!astral) return false;
    if (!spendSP(cpu, astral.cost)) return false;
    if (!summonAstral(cpu, astral, astral._pageIndex)) return false;

    addLog(state, logSummon(name, astral));
    actions.push('summon:' + astral.id);
    return true;
  }

  function useFateIfSelected() {
    var fate = selectCpuFate(state);

    if (!fate) return false;
    if (!applyFateEffect(cpu, fate, fate._pageIndex)) return false;

    addLog(state, logFate(name, fate.name, fate.effectDescription));
    actions.push('fate:' + fate.id);
    return true;
  }

  if (cpu.field.length === 0 && getAvailableAstrals(cpu.skyWindow, cpu.sp).length === 0) {
    useFateIfSelected();
  }

  if (cpu.field.length === 0) {
    useBestAstral();
  }

  useFateIfSelected();

  while (cpu.field.length < MAX_FIELD_ASTRALS) {
    var reserve = getCpuDefenseReserve(state, cpu);
    var budget = Math.max(0, cpu.sp - reserve);
    var canSpendReserve = cpu.field.length < 2;

    if (!useBestAstral(canSpendReserve ? undefined : budget)) {
      break;
    }
  }

  if (actions.length === 0) {
    addLog(state, '🜂 CPU は布陣を維持した');
  }

  syncGameState(state);
  return actions;
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

  if (cpu.field.length === 0) return false;

  var attackSpells = getAvailableAttackSpells(cpu.skyWindow, cpu.sp);
  if (attackSpells.length === 0) return false;

  var bestCombo = selectBestAttackCombo(cpu, attackSpells, player);
  var shouldAttack = typeof shouldAutoAttackWithCombo === 'function' ?
    shouldAutoAttackWithCombo(cpu, bestCombo) :
    !!(bestCombo && bestCombo.successLikely);

  if (!bestCombo || !shouldAttack) return false;

  var astralIndex = cpu.field.indexOf(bestCombo.astral);
  var spellIndex = cpu.skyWindow.indexOf(bestCombo.spell);

  if (astralIndex < 0 || spellIndex < 0) return false;

  playerStarStrike(state, astralIndex);
  return playerSelectAttackSpell(state, spellIndex, bestCombo.overcharge);
}

// =============================================
// 防御リアクション
// =============================================

/**
 * CPUの防御リアクションを決定
 * @returns {{type:string, spellIndex:number, overcharge:number}|{type:string}}
 */
function cpuDefenseReaction(state, attackPower) {
  var battle = state.currentBattle;
  if (!battle || !battle.defenseAstral) {
    return { type: 'pass' };
  }

  var preview = buildCpuDefensePreview(battle.defender, attackPower);

  if (!preview.canBlock || !preview.spell) {
    return { type: 'pass' };
  }

  return {
    type: 'defend',
    spellIndex: battle.defender.skyWindow.indexOf(preview.spell),
    overcharge: preview.overcharge
  };
}

/**
 * CPUの防御リアクション（プレイヤーの攻撃に対して）
 */
function cpuDefendAction(state) {
  var battle = state.currentBattle;
  if (!battle) return;

  scheduleStateTask(state, function() {
    var attackPower = calcAttackPower(battle.attackAstral, battle.attackSpell, battle.overcharge);
    var decision = cpuDefenseReaction(state, attackPower);

    if (decision.type === 'defend' && decision.spellIndex >= 0) {
      playerDefend(state, decision.spellIndex, decision.overcharge);
      return;
    }

    playerDefend(state, -1, 0);
  }, 600);
}

// =============================================
// ダメージ選択
// =============================================

/**
 * CPUの星護判断を決定
 * @returns {{type:string, astralIndex:number}|{type:string}}
 */
function cpuGuardDecision(state, damage) {
  var battle = state.currentBattle;
  if (!battle) {
    return { type: 'chronicle' };
  }

  var cpu = battle.defender;
  var remaining = getRemainingPages(cpu);
  var guardIndex = selectCpuGuardAstralIndex(cpu);

  if (guardIndex < 0) {
    return { type: 'chronicle' };
  }

  var guardAstral = cpu.field[guardIndex];
  var lethalChronicle = remaining <= damage;
  var shouldPreserveField = guardAstral.state === 'eclipse' &&
    cpu.field.length === 1 &&
    !hasRemainingAstralSource(cpu);

  if (lethalChronicle) {
    return { type: 'guard', astralIndex: guardIndex };
  }

  if (remaining <= damage + 2 && guardAstral.state === 'radiant') {
    return { type: 'guard', astralIndex: guardIndex };
  }

  if (remaining <= 4 && guardAstral.state === 'radiant') {
    return { type: 'guard', astralIndex: guardIndex };
  }

  if (guardAstral.state === 'eclipse' && shouldPreserveField) {
    return { type: 'chronicle' };
  }

  return { type: 'chronicle' };
}

/**
 * CPUのダメージ選択（星典 or 星護）
 */
function cpuDamageChoice(state) {
  var battle = state.currentBattle;
  if (!battle || !battle.clashResult) return;

  scheduleStateTask(state, function() {
    var decision = cpuGuardDecision(state, battle.clashResult.totalDamage);

    if (decision.type === 'guard' && decision.astralIndex >= 0) {
      playerGuard(state, decision.astralIndex);
      return;
    }

    playerTakeChronicleDamage(state);
  }, 600);
}
