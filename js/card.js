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

// =============================================
// 星霊カード定義（5種）
// =============================================
var ASTRAL_CARDS = {
  astral_001: {
    id: 'astral_001',
    name: '火狐（カコ）',
    type: 'astral',
    cost: 1,
    power: 2,
    element: 'fire'
  },
  astral_002: {
    id: 'astral_002',
    name: '蒼騎士（アズナイト）',
    type: 'astral',
    cost: 2,
    power: 4,
    element: 'water'
  },
  astral_003: {
    id: 'astral_003',
    name: '風読み（カゼヨミ）',
    type: 'astral',
    cost: 3,
    power: 5,
    element: 'wind'
  },
  astral_004: {
    id: 'astral_004',
    name: '岩守（ガンシュ）',
    type: 'astral',
    cost: 2,
    power: 3,
    element: 'earth'
  },
  astral_005: {
    id: 'astral_005',
    name: '煌竜（コウリュウ）',
    type: 'astral',
    cost: 4,
    power: 7,
    element: 'fire'
  }
};

// =============================================
// 攻星術カード定義（5種）
// =============================================
var ATTACK_SPELL_CARDS = {
  spell_atk_001: {
    id: 'spell_atk_001',
    name: '火炎星（かえんせい）',
    type: 'spell',
    timing: 'attack',
    cost: 2,
    powerBoost: 2,
    damage: 2,
    element: 'fire'
  },
  spell_atk_002: {
    id: 'spell_atk_002',
    name: '氷瀑星（ひょうばくせい）',
    type: 'spell',
    timing: 'attack',
    cost: 3,
    powerBoost: 3,
    damage: 3,
    element: 'water'
  },
  spell_atk_003: {
    id: 'spell_atk_003',
    name: '烈風星（れっぷうせい）',
    type: 'spell',
    timing: 'attack',
    cost: 3,
    powerBoost: 3,
    damage: 2,
    element: 'wind'
  },
  spell_atk_004: {
    id: 'spell_atk_004',
    name: '震撃星（しんげきせい）',
    type: 'spell',
    timing: 'attack',
    cost: 2,
    powerBoost: 2,
    damage: 2,
    element: 'earth'
  },
  spell_atk_005: {
    id: 'spell_atk_005',
    name: '流星撃（りゅうせいげき）',
    type: 'spell',
    timing: 'attack',
    cost: 4,
    powerBoost: 4,
    damage: 4,
    element: 'fire'
  }
};

// =============================================
// 守星術カード定義（3種）
// =============================================
var DEFENSE_SPELL_CARDS = {
  spell_def_001: {
    id: 'spell_def_001',
    name: '水鏡盾（すいきょうじゅん）',
    type: 'spell',
    timing: 'defense',
    cost: 1,
    powerBoost: 2,
    damage: 0,
    element: 'water'
  },
  spell_def_002: {
    id: 'spell_def_002',
    name: '風障壁（ふうしょうへき）',
    type: 'spell',
    timing: 'defense',
    cost: 2,
    powerBoost: 4,
    damage: 0,
    element: 'wind'
  },
  spell_def_003: {
    id: 'spell_def_003',
    name: '岩盤陣（がんばんじん）',
    type: 'spell',
    timing: 'defense',
    cost: 3,
    powerBoost: 6,
    damage: 0,
    element: 'earth'
  }
};

// =============================================
// 星命カード定義（3種）
// =============================================
var FATE_CARDS = {
  fate_001: {
    id: 'fate_001',
    name: '星辰回帰',
    type: 'fate',
    cost: 2,
    effectType: 'chronicle_restore',
    value: 2,
    effectDescription: '星典2ページ回復（詠み位置を2戻す）'
  },
  fate_002: {
    id: 'fate_002',
    name: '星霊鼓舞',
    type: 'fate',
    cost: 1,
    effectType: 'power_buff',
    value: 2,
    effectDescription: '味方星霊1体の星力+2（ターン終了まで）'
  },
  fate_003: {
    id: 'fate_003',
    name: '星力充填',
    type: 'fate',
    cost: 1,
    effectType: 'sp_charge',
    value: 3,
    effectDescription: 'SP+3'
  }
};

// =============================================
// カードプール（全カード統合）
// =============================================
var CARD_POOL = {};
(function() {
  var pools = [ASTRAL_CARDS, ATTACK_SPELL_CARDS, DEFENSE_SPELL_CARDS, FATE_CARDS];
  for (var i = 0; i < pools.length; i++) {
    var pool = pools[i];
    for (var key in pool) {
      if (pool.hasOwnProperty(key)) {
        CARD_POOL[key] = pool[key];
      }
    }
  }
})();

// =============================================
// カードの複製（フィールドに配置する際に使用）
// =============================================
function cloneCard(card) {
  var clone = {};
  for (var key in card) {
    if (card.hasOwnProperty(key)) {
      clone[key] = card[key];
    }
  }
  // 星霊は状態を初期化
  if (clone.type === 'astral') {
    clone.state = 'radiant';  // 輝態
    clone.tempPowerBoost = 0; // 一時的な星力バフ
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
// プリセット星典（デッキ）定義
// =============================================

/**
 * プレイヤー用20ページ星典
 * 構成: 星霊4 + 攻星術7 + 守星術5 + 星命4 = 20枚
 * 1ページ目は必ず星霊カード
 */
function getPlayerChronicle() {
  return [
    // 1ページ目: 星霊（必須ルール）
    cloneCard(ASTRAL_CARDS.astral_001),  // 火狐（コスト1）
    // 2-3: 序盤の低コスト術
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_001),  // 火炎星（火・コスト2）
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_001),  // 水鏡盾（水・コスト1）
    // 4-5: 2体目の星霊＋サポート
    cloneCard(ASTRAL_CARDS.astral_002),  // 蒼騎士（水・コスト2）
    cloneCard(FATE_CARDS.fate_003),      // 星力充填（SP+3）
    // 6-7: 中盤の攻防
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_004),  // 震撃星（地・コスト2）
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_002),  // 風障壁（風・コスト2）
    // 8-9: 3体目の星霊＋攻撃
    cloneCard(ASTRAL_CARDS.astral_003),  // 風読み（風・コスト3）
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_003),  // 烈風星（風・コスト3）★共鳴
    // 10-11: 中盤の補助＋防御
    cloneCard(FATE_CARDS.fate_002),      // 星霊鼓舞（星力+2）
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_001),  // 水鏡盾（水・コスト1）
    // 12-13: 強カード
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_002),  // 氷瀑星（水・コスト3）★蒼騎士と共鳴
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_003),  // 岩盤陣（地・コスト3）
    // 14-15: 回復＋攻撃
    cloneCard(FATE_CARDS.fate_001),      // 星辰回帰（2ページ回復）
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_001),  // 火炎星（火・コスト2）
    // 16-17: 最強星霊＋必殺術
    cloneCard(ASTRAL_CARDS.astral_005),  // 煌竜（火・コスト4）
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_005),  // 流星撃（火・コスト4）★共鳴
    // 18-19: 最後の攻防
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_002),  // 風障壁
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_004),  // 震撃星
    // 20: 最終手段
    cloneCard(FATE_CARDS.fate_003),      // 星力充填
  ];
}

/**
 * CPU用20ページ星典
 * 構成: 星霊4 + 攻星術7 + 守星術5 + 星命4 = 20枚
 * 地・水属性寄りの防御型デッキ
 */
function getCpuChronicle() {
  return [
    // 1ページ目: 星霊（必須）
    cloneCard(ASTRAL_CARDS.astral_004),  // 岩守（地・コスト2）
    // 2-3: 序盤
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_003),  // 岩盤陣（地・コスト3）★共鳴
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_004),  // 震撃星（地・コスト2）★共鳴
    // 4-5: 2体目＋攻撃
    cloneCard(ASTRAL_CARDS.astral_002),  // 蒼騎士（水）
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_002),  // 氷瀑星（水）★共鳴
    // 6-7: 防御＋サポート
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_001),  // 水鏡盾（水）★共鳴
    cloneCard(FATE_CARDS.fate_003),      // 星力充填
    // 8-9: 攻防
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_001),  // 火炎星（火）
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_002),  // 風障壁（風）
    // 10-11: 3体目
    cloneCard(ASTRAL_CARDS.astral_001),  // 火狐（火）
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_001),  // 火炎星（火）★共鳴
    // 12-13: 補助
    cloneCard(FATE_CARDS.fate_002),      // 星霊鼓舞
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_001),  // 水鏡盾
    // 14-15: 攻撃
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_003),  // 烈風星（風）
    cloneCard(FATE_CARDS.fate_001),      // 星辰回帰
    // 16-17: 切り札
    cloneCard(ASTRAL_CARDS.astral_005),  // 煌竜（火）
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_005),  // 流星撃（火）★共鳴
    // 18-19: 最終防衛
    cloneCard(DEFENSE_SPELL_CARDS.spell_def_003),  // 岩盤陣
    cloneCard(ATTACK_SPELL_CARDS.spell_atk_002),  // 氷瀑星
    // 20: 最後
    cloneCard(FATE_CARDS.fate_003),      // 星力充填
  ];
}

// =============================================
// デバッグ用: カードデータ出力
// =============================================
function debugCardData() {
  console.log('=== 星典戦記 カードデータ ===');
  console.log('');

  console.log('【星霊カード】');
  for (var key in ASTRAL_CARDS) {
    var c = ASTRAL_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | 星力:' + c.power + ' | 属性:' + ELEMENT_NAMES[c.element]);
  }

  console.log('');
  console.log('【攻星術カード】');
  for (var key in ATTACK_SPELL_CARDS) {
    var c = ATTACK_SPELL_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | 星力↑:+' + c.powerBoost + ' | ダメージ:' + c.damage + ' | 属性:' + ELEMENT_NAMES[c.element]);
  }

  console.log('');
  console.log('【守星術カード】');
  for (var key in DEFENSE_SPELL_CARDS) {
    var c = DEFENSE_SPELL_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | 星力↑:+' + c.powerBoost + ' | 属性:' + ELEMENT_NAMES[c.element]);
  }

  console.log('');
  console.log('【星命カード】');
  for (var key in FATE_CARDS) {
    var c = FATE_CARDS[key];
    console.log('  ' + c.name + ' | コスト:' + c.cost + ' | ' + c.effectDescription);
  }

  console.log('');
  console.log('【共鳴テスト】');
  var koko = ASTRAL_CARDS.astral_001;  // 火狐（火）
  var kaen = ATTACK_SPELL_CARDS.spell_atk_001;  // 火炎星（火）
  var hyou = ATTACK_SPELL_CARDS.spell_atk_002;  // 氷瀑星（水）
  console.log('  ' + koko.name + ' × ' + kaen.name + ' → 共鳴: ' + hasResonance(koko, kaen) + ' (期待: true)');
  console.log('  ' + koko.name + ' × ' + hyou.name + ' → 共鳴: ' + hasResonance(koko, hyou) + ' (期待: false)');

  console.log('');
  console.log('【プレイヤー星典 (20ページ)】');
  var pChron = getPlayerChronicle();
  for (var i = 0; i < pChron.length; i++) {
    var p = pChron[i];
    var info = (i + 1) + 'P: ' + p.name + ' [' + p.type + ']';
    if (p.element) info += ' ' + ELEMENT_NAMES[p.element];
    console.log('  ' + info);
  }

  console.log('');
  console.log('【CPU星典 (20ページ)】');
  var cChron = getCpuChronicle();
  for (var i = 0; i < cChron.length; i++) {
    var c = cChron[i];
    var info = (i + 1) + 'P: ' + c.name + ' [' + c.type + ']';
    if (c.element) info += ' ' + ELEMENT_NAMES[c.element];
    console.log('  ' + info);
  }

  console.log('');
  console.log('=== カードプール合計: ' + Object.keys(CARD_POOL).length + '種 ===');
}
