/* ========================================
   card.js — カード定義・データ
   星霊・星術・星命カードの全データと星典（デッキ）生成
   ======================================== */

// --- 属性定義 ---
var ELEMENTS = {
  FIRE: 'fire',
  WATER: 'water',
  WIND: 'wind',
  EARTH: 'earth'
};

// --- 属性の日本語表示名 ---
var ELEMENT_NAMES = {
  fire: '火',
  water: '水',
  wind: '風',
  earth: '地'
};

// --- 共鳴ボーナス値 ---
var RESONANCE_BONUS = 1;

// --- 既定の星典プリセット ---
var DEFAULT_PLAYER_CHRONICLE_PRESET_ID = 'balance_standard';
var DEFAULT_CPU_CHRONICLE_PRESET_ID = 'tide_bulwark';

function cloneValue(value) {
  var i;
  var clone;

  if (Array.isArray(value)) {
    clone = [];
    for (i = 0; i < value.length; i++) {
      clone.push(cloneValue(value[i]));
    }
    return clone;
  }

  if (value && typeof value === 'object') {
    clone = {};
    for (i in value) {
      if (value.hasOwnProperty(i)) {
        clone[i] = cloneValue(value[i]);
      }
    }
    return clone;
  }

  return value;
}

function createAstralCard(id, name, cost, power, element, aiHints) {
  return {
    id: id,
    name: name,
    type: 'astral',
    cost: cost,
    power: power,
    element: element,
    aiHints: aiHints || {}
  };
}

function createSpellCard(id, name, timing, cost, powerBoost, damage, element, aiHints) {
  return {
    id: id,
    name: name,
    type: 'spell',
    timing: timing,
    cost: cost,
    powerBoost: powerBoost,
    damage: damage,
    element: element,
    aiHints: aiHints || {}
  };
}

function createFateCard(id, name, cost, effectType, effectPayload, effectDescription, aiHints) {
  return {
    id: id,
    name: name,
    type: 'fate',
    cost: cost,
    effectType: effectType,
    effectPayload: cloneValue(effectPayload || {}),
    effectDescription: effectDescription,
    aiHints: aiHints || {}
  };
}

// =============================================
// 星霊カード定義（9種）
// =============================================
var ASTRAL_CARDS = {
  astral_001: createAstralCard('astral_001', '火狐（カコ）', 1, 2, 'fire', {
    aggression: 2,
    curve: 3
  }),
  astral_002: createAstralCard('astral_002', '蒼騎士（アズナイト）', 2, 4, 'water', {
    defense: 2,
    stability: 2
  }),
  astral_003: createAstralCard('astral_003', '風読み（カゼヨミ）', 3, 5, 'wind', {
    aggression: 2,
    combo: 3
  }),
  astral_004: createAstralCard('astral_004', '岩守（ガンシュ）', 2, 3, 'earth', {
    defense: 4,
    guard: 3
  }),
  astral_005: createAstralCard('astral_005', '煌竜（コウリュウ）', 4, 7, 'fire', {
    finisher: 4,
    aggression: 3
  }),
  astral_006: createAstralCard('astral_006', '潮司（シオツカサ）', 1, 2, 'water', {
    stability: 3,
    defense: 1
  }),
  astral_007: createAstralCard('astral_007', '迅梟（ジンキョウ）', 2, 3, 'wind', {
    aggression: 3,
    curve: 2
  }),
  astral_008: createAstralCard('astral_008', '玄甲獣（ゲンコウジュウ）', 3, 5, 'earth', {
    defense: 5,
    guard: 2
  }),
  astral_009: createAstralCard('astral_009', '焔鴉（エンア）', 2, 4, 'fire', {
    aggression: 4,
    finisher: 1
  })
};

// =============================================
// 攻星術カード定義（10種）
// =============================================
var ATTACK_SPELL_CARDS = {
  spell_atk_001: createSpellCard('spell_atk_001', '火炎星（かえんせい）', 'attack', 2, 2, 2, 'fire', {
    aggression: 2
  }),
  spell_atk_002: createSpellCard('spell_atk_002', '氷瀑星（ひょうばくせい）', 'attack', 3, 3, 3, 'water', {
    stability: 2,
    finisher: 1
  }),
  spell_atk_003: createSpellCard('spell_atk_003', '烈風星（れっぷうせい）', 'attack', 3, 3, 2, 'wind', {
    combo: 3
  }),
  spell_atk_004: createSpellCard('spell_atk_004', '震撃星（しんげきせい）', 'attack', 2, 2, 2, 'earth', {
    stability: 2
  }),
  spell_atk_005: createSpellCard('spell_atk_005', '流星撃（りゅうせいげき）', 'attack', 4, 4, 4, 'fire', {
    finisher: 4
  }),
  spell_atk_006: createSpellCard('spell_atk_006', '水穿星（すいせんせい）', 'attack', 2, 1, 3, 'water', {
    burst: 3,
    aggression: 1
  }),
  spell_atk_007: createSpellCard('spell_atk_007', '疾空刃（しっくうじん）', 'attack', 1, 1, 1, 'wind', {
    curve: 3
  }),
  spell_atk_008: createSpellCard('spell_atk_008', '地砕衝（ちさいしょう）', 'attack', 3, 4, 2, 'earth', {
    stability: 3
  }),
  spell_atk_009: createSpellCard('spell_atk_009', '紅蓮尾（ぐれんび）', 'attack', 3, 2, 4, 'fire', {
    burst: 4,
    finisher: 2
  }),
  spell_atk_010: createSpellCard('spell_atk_010', '蒼流環（そうりゅうかん）', 'attack', 4, 5, 3, 'water', {
    finisher: 3,
    stability: 2
  })
};

// =============================================
// 守星術カード定義（6種）
// =============================================
var DEFENSE_SPELL_CARDS = {
  spell_def_001: createSpellCard('spell_def_001', '水鏡盾（すいきょうじゅん）', 'defense', 1, 2, 0, 'water', {
    defense: 2,
    curve: 2
  }),
  spell_def_002: createSpellCard('spell_def_002', '風障壁（ふうしょうへき）', 'defense', 2, 4, 0, 'wind', {
    defense: 4
  }),
  spell_def_003: createSpellCard('spell_def_003', '岩盤陣（がんばんじん）', 'defense', 3, 6, 0, 'earth', {
    defense: 6
  }),
  spell_def_004: createSpellCard('spell_def_004', '炎輪壁（えんりんへき）', 'defense', 1, 1, 0, 'fire', {
    defense: 1,
    curve: 3
  }),
  spell_def_005: createSpellCard('spell_def_005', '潮門陣（ちょうもんじん）', 'defense', 2, 4, 0, 'water', {
    defense: 3,
    stability: 2
  }),
  spell_def_006: createSpellCard('spell_def_006', '翠嵐幕（すいらんまく）', 'defense', 3, 5, 0, 'wind', {
    defense: 5,
    stability: 1
  })
};

// =============================================
// 星命カード定義（6種）
// =============================================
var FATE_CARDS = {
  fate_001: createFateCard(
    'fate_001',
    '星辰回帰',
    2,
    'chronicle_restore',
    { pages: 2 },
    '星典2ページ回復（詠み位置を2戻す）',
    { recovery: 4, lateGame: 4 }
  ),
  fate_002: createFateCard(
    'fate_002',
    '星霊鼓舞',
    1,
    'power_buff',
    { amount: 2, targetMode: 'strongest' },
    '味方星霊1体の星力+2（ターン終了まで）',
    { aggression: 3 }
  ),
  fate_003: createFateCard(
    'fate_003',
    '星力充填',
    1,
    'sp_charge',
    { amount: 3 },
    'SP+3',
    { tempo: 4 }
  ),
  fate_004: createFateCard(
    'fate_004',
    '星糸縫合',
    1,
    'chronicle_restore',
    { pages: 1 },
    '星典1ページ回復（詠み位置を1戻す）',
    { recovery: 2, lateGame: 2 }
  ),
  fate_005: createFateCard(
    'fate_005',
    '天命昂揚',
    2,
    'power_buff',
    { amount: 3, targetMode: 'strongest' },
    '味方星霊1体の星力+3（ターン終了まで）',
    { aggression: 5, finisher: 2 }
  ),
  fate_006: createFateCard(
    'fate_006',
    '宵星備蓄',
    2,
    'sp_charge',
    { amount: 4 },
    'SP+4',
    { tempo: 5 }
  )
};

// =============================================
// カードプール（全カード統合）
// =============================================
var CARD_POOL = {};
(function() {
  var pools = [ASTRAL_CARDS, ATTACK_SPELL_CARDS, DEFENSE_SPELL_CARDS, FATE_CARDS];
  var i;
  var key;
  var pool;

  for (i = 0; i < pools.length; i++) {
    pool = pools[i];
    for (key in pool) {
      if (pool.hasOwnProperty(key)) {
        CARD_POOL[key] = pool[key];
      }
    }
  }
})();

// =============================================
// 固定順星典プリセット
// =============================================
var CHRONICLE_PRESETS = {
  balance_standard: {
    id: 'balance_standard',
    name: '均衡の星典',
    archetype: '攻防バランス',
    description: '現行ルールを素直に体験できる標準型。星力充填と回復で中盤以降も粘る。',
    pages: [
      'astral_001',
      'spell_atk_001',
      'spell_def_001',
      'astral_002',
      'fate_003',
      'spell_atk_004',
      'spell_def_002',
      'astral_007',
      'spell_atk_003',
      'fate_002',
      'spell_def_005',
      'spell_atk_002',
      'astral_004',
      'fate_001',
      'spell_def_003',
      'astral_005',
      'spell_atk_005',
      'fate_004',
      'spell_atk_006',
      'fate_006'
    ]
  },
  blaze_rush: {
    id: 'blaze_rush',
    name: '焔風の星典',
    archetype: '火風速攻',
    description: '軽量攻星術と高打点フィニッシュで押し切る速攻型。防御は薄いが爆発力が高い。',
    pages: [
      'astral_009',
      'spell_atk_007',
      'spell_atk_001',
      'astral_007',
      'fate_003',
      'spell_atk_003',
      'spell_def_004',
      'astral_001',
      'spell_atk_009',
      'fate_002',
      'spell_def_002',
      'astral_003',
      'spell_atk_001',
      'fate_005',
      'spell_atk_005',
      'astral_005',
      'spell_atk_003',
      'spell_def_006',
      'fate_006',
      'spell_atk_009'
    ]
  },
  tide_bulwark: {
    id: 'tide_bulwark',
    name: '潮土の星典',
    archetype: '水地守勢',
    description: '守星術と回復で星典を守りながら、重い術で終盤に差し返す継戦型。',
    pages: [
      'astral_004',
      'spell_def_003',
      'spell_atk_004',
      'astral_006',
      'spell_def_005',
      'fate_004',
      'spell_atk_006',
      'astral_002',
      'fate_001',
      'spell_def_001',
      'spell_atk_002',
      'astral_008',
      'spell_def_003',
      'fate_003',
      'spell_atk_010',
      'astral_004',
      'spell_def_005',
      'fate_006',
      'spell_atk_008',
      'spell_def_001'
    ]
  }
};

function getCardById(cardId) {
  return CARD_POOL[cardId] || null;
}

function getChroniclePreset(presetId) {
  return CHRONICLE_PRESETS[presetId] || null;
}

function listChroniclePresets() {
  var presetIds = Object.keys(CHRONICLE_PRESETS);
  var presets = [];
  var i;
  var preset;

  for (i = 0; i < presetIds.length; i++) {
    preset = CHRONICLE_PRESETS[presetIds[i]];
    presets.push({
      id: preset.id,
      name: preset.name,
      archetype: preset.archetype,
      description: preset.description
    });
  }

  return presets;
}

function createChronicleFromPreset(presetId) {
  var preset = getChroniclePreset(presetId);
  var pages = [];
  var i;
  var card;

  if (!preset) return pages;

  for (i = 0; i < preset.pages.length; i++) {
    card = getCardById(preset.pages[i]);
    if (!card) continue;
    pages.push(cloneCard(card));
  }

  return pages;
}

function summarizeChroniclePreset(presetId) {
  var preset = getChroniclePreset(presetId);
  var summary;
  var i;
  var card;
  var typeKey;
  var elementKey;

  if (!preset) return null;

  summary = {
    id: preset.id,
    name: preset.name,
    archetype: preset.archetype,
    description: preset.description,
    totalPages: preset.pages.length,
    totalCost: 0,
    averageCost: 0,
    typeCounts: {
      astral: 0,
      attack: 0,
      defense: 0,
      fate: 0
    },
    elementCounts: {
      fire: 0,
      water: 0,
      wind: 0,
      earth: 0
    }
  };

  for (i = 0; i < preset.pages.length; i++) {
    card = getCardById(preset.pages[i]);
    if (!card) continue;

    summary.totalCost += card.cost || 0;

    if (card.type === 'astral') typeKey = 'astral';
    else if (card.type === 'spell' && card.timing === 'attack') typeKey = 'attack';
    else if (card.type === 'spell' && card.timing === 'defense') typeKey = 'defense';
    else typeKey = 'fate';
    summary.typeCounts[typeKey]++;

    if (card.element && summary.elementCounts[card.element] !== undefined) {
      summary.elementCounts[card.element]++;
    }
  }

  summary.averageCost = summary.totalPages > 0 ?
    Math.round((summary.totalCost / summary.totalPages) * 100) / 100 :
    0;

  return summary;
}

function validateChroniclePreset(presetId) {
  var preset = typeof presetId === 'string' ? getChroniclePreset(presetId) : presetId;
  var errors = [];
  var earlyCost = 0;
  var earlyLowCostCount = 0;
  var earlyAttackCount = 0;
  var summary;
  var i;
  var card;
  var earlyCount;

  if (!preset) {
    return {
      valid: false,
      errors: ['プリセットが存在しない']
    };
  }

  if (preset.pages.length !== 20) {
    errors.push('ページ数が20ではない');
  }

  for (i = 0; i < preset.pages.length; i++) {
    card = getCardById(preset.pages[i]);
    if (!card) {
      errors.push((i + 1) + 'ページ目のカードIDが無効');
      continue;
    }

    if (i < 6) {
      earlyCost += card.cost || 0;
      if ((card.cost || 0) <= 2) {
        earlyLowCostCount++;
      }
      if (card.type === 'spell' && card.timing === 'attack') {
        earlyAttackCount++;
      }
    }
  }

  card = getCardById(preset.pages[0]);
  if (!card || card.type !== 'astral') {
    errors.push('1ページ目が星霊ではない');
  }

  summary = summarizeChroniclePreset(preset.id);
  if (summary.typeCounts.astral < 4) {
    errors.push('星霊枚数が不足している');
  }

  earlyCount = Math.min(6, preset.pages.length);
  if (earlyCount > 0 && earlyCost / earlyCount > 2.6) {
    errors.push('序盤コストが重すぎる');
  }

  if (earlyLowCostCount < 3) {
    errors.push('序盤の低コスト枚数が不足している');
  }

  if (earlyAttackCount === 0) {
    errors.push('序盤の攻撃札が存在しない');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    summary: summary
  };
}

function validateAllChroniclePresets() {
  var presetIds = Object.keys(CHRONICLE_PRESETS);
  var results = {};
  var i;

  for (i = 0; i < presetIds.length; i++) {
    results[presetIds[i]] = validateChroniclePreset(presetIds[i]);
  }

  return results;
}

// =============================================
// カードの複製（フィールドに配置する際に使用）
// =============================================
function cloneCard(card) {
  var clone = cloneValue(card);

  if (clone.type === 'astral') {
    clone.state = 'radiant';
    clone.tempPowerBoost = 0;
  }

  return clone;
}

// =============================================
// 共鳴（レゾナンス）判定
// =============================================
function hasResonance(astral, spell) {
  if (!astral || !spell) return false;
  if (!astral.element || !spell.element) return false;
  return astral.element === spell.element;
}

function getResonanceBonus(astral, spell) {
  return hasResonance(astral, spell) ? RESONANCE_BONUS : 0;
}

// =============================================
// プリセット星典（互換ラッパー）
// =============================================
function getPlayerChronicle() {
  return createChronicleFromPreset(DEFAULT_PLAYER_CHRONICLE_PRESET_ID);
}

function getCpuChronicle() {
  return createChronicleFromPreset(DEFAULT_CPU_CHRONICLE_PRESET_ID);
}

// =============================================
// デバッグ用: カードデータ出力
// =============================================
function debugCardData() {
  var key;
  var c;
  var presetIds;
  var i;
  var pageIndex;
  var preset;
  var card;
  var validation;

  console.log('=== 星典戦記 カードデータ ===');
  console.log('');

  console.log('【星霊カード】');
  for (key in ASTRAL_CARDS) {
    c = ASTRAL_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | 星力:' + c.power + ' | 属性:' + ELEMENT_NAMES[c.element]);
  }

  console.log('');
  console.log('【攻星術カード】');
  for (key in ATTACK_SPELL_CARDS) {
    c = ATTACK_SPELL_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | 星力↑:+' + c.powerBoost + ' | ダメージ:' + c.damage + ' | 属性:' + ELEMENT_NAMES[c.element]);
  }

  console.log('');
  console.log('【守星術カード】');
  for (key in DEFENSE_SPELL_CARDS) {
    c = DEFENSE_SPELL_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | 星力↑:+' + c.powerBoost + ' | 属性:' + ELEMENT_NAMES[c.element]);
  }

  console.log('');
  console.log('【星命カード】');
  for (key in FATE_CARDS) {
    c = FATE_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | ' + c.effectDescription);
  }

  console.log('');
  console.log('【共鳴テスト】');
  console.log('  ' + ASTRAL_CARDS.astral_001.name + ' × ' + ATTACK_SPELL_CARDS.spell_atk_001.name + ' → 共鳴: ' +
    hasResonance(ASTRAL_CARDS.astral_001, ATTACK_SPELL_CARDS.spell_atk_001) + ' (期待: true)');
  console.log('  ' + ASTRAL_CARDS.astral_001.name + ' × ' + ATTACK_SPELL_CARDS.spell_atk_002.name + ' → 共鳴: ' +
    hasResonance(ASTRAL_CARDS.astral_001, ATTACK_SPELL_CARDS.spell_atk_002) + ' (期待: false)');

  console.log('');
  console.log('【固定順星典プリセット】');
  presetIds = Object.keys(CHRONICLE_PRESETS);

  for (i = 0; i < presetIds.length; i++) {
    preset = CHRONICLE_PRESETS[presetIds[i]];
    validation = validateChroniclePreset(preset.id);

    console.log('  - ' + preset.name + ' [' + preset.archetype + '] valid=' + validation.valid);
    for (pageIndex = 0; pageIndex < preset.pages.length; pageIndex++) {
      card = getCardById(preset.pages[pageIndex]);
      console.log('    ' + (pageIndex + 1) + 'P: ' + card.name + ' [' + card.type + ']');
    }
  }

  console.log('');
  console.log('=== カードプール合計: ' + Object.keys(CARD_POOL).length + '種 ===');
}
