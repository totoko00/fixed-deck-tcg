/* ========================================
   player.js — プレイヤー状態管理
   星典の詠み・SP管理・フィールド管理
   ======================================== */

// --- 定数 ---
var SP_PER_PAGE = 2;       // 1ページ詠みあたりのSP獲得量
var MAX_FIELD_ASTRALS = 3; // フィールド上の星霊上限
var MAX_READ_PER_TURN = 3; // スタートフェイズの最大詠み回数

/**
 * プレイヤーオブジェクトを生成
 * @param {string} id - 'player' | 'cpu'
 * @param {Card[]} chroniclePages - 星典の全ページ（20枚）
 * @returns {Player}
 */
function createPlayer(id, chroniclePages) {
  return {
    id: id,
    sp: 0,
    chronicleIndex: 0,       // 次に詠むページのインデックス（0始まり）
    chroniclePages: chroniclePages,
    skyWindow: [],            // 現在の天窓カード
    field: [],                // フィールド上の星霊
    usedFate: false,          // このターン星命を使用したか
    usedCardIndices: [],      // 使用済みカードのページインデックス
    readPageIndices: []       // 実際に詠んだページ履歴（ダメージめくりは含めない）
  };
}

/**
 * 星典を1ページ詠む（SP+2獲得）
 * @returns {Card|null} 詠んだカード（詠めない場合null）
 */
function readPage(player) {
  if (!canRead(player)) return null;

  var pageIndex = player.chronicleIndex;
  var card = player.chroniclePages[pageIndex];

  player.chronicleIndex = pageIndex + 1;
  player.readPageIndices.push(pageIndex);
  addSP(player, SP_PER_PAGE);

  // 天窓を更新
  updateSkyWindow(player);

  return card;
}

/**
 * 詠めるかどうか判定
 */
function canRead(player) {
  return player.chronicleIndex >= 0 && player.chronicleIndex < player.chroniclePages.length;
}

/**
 * 残りページ数を取得
 */
function getRemainingPages(player) {
  return Math.max(0, player.chroniclePages.length - player.chronicleIndex);
}

/**
 * 天窓（見開き）カードを更新
 * 直近2ページ分のカードのうち、未使用のものを天窓に表示
 */
function updateSkyWindow(player) {
  player.skyWindow = [];

  // 天窓は「実際に詠んだ直近2ページ」から作る。
  // ダメージでめくれたページは含めない。
  var startIdx = Math.max(0, player.readPageIndices.length - 2);

  for (var i = startIdx; i < player.readPageIndices.length; i++) {
    var pageIndex = player.readPageIndices[i];

    if (player.usedCardIndices.indexOf(pageIndex) !== -1) continue;

    var card = player.chroniclePages[pageIndex];
    if (!card) continue;

    card._pageIndex = pageIndex;
    player.skyWindow.push(card);
  }
}

/**
 * 現在の天窓カードを取得
 */
function getSkyWindow(player) {
  return player.skyWindow;
}

/**
 * SP消費
 * @returns {boolean} 消費成功ならtrue
 */
function spendSP(player, cost) {
  if (cost < 0) return false;
  if (player.sp < cost) return false;
  player.sp -= cost;
  return true;
}

/**
 * SP追加
 */
function addSP(player, amount) {
  if (amount <= 0) return;
  player.sp += amount;
}

/**
 * 星霊を場に召喚
 * @returns {boolean} 召喚成功ならtrue
 */
function summonAstral(player, card, pageIndex) {
  if (player.field.length >= MAX_FIELD_ASTRALS) return false;
  if (card.type !== 'astral') return false;

  if (pageIndex === undefined && card._pageIndex !== undefined) {
    pageIndex = card._pageIndex;
  }

  // カードを複製してフィールドに追加
  var fieldCard = cloneCard(card);
  fieldCard.state = 'radiant'; // 輝態で召喚
  fieldCard.tempPowerBoost = 0;
  player.field.push(fieldCard);

  // 使用済みに追加
  if (pageIndex !== undefined && player.usedCardIndices.indexOf(pageIndex) === -1) {
    player.usedCardIndices.push(pageIndex);
    updateSkyWindow(player);
  }

  return true;
}

/**
 * 星霊を場から除去（消星）
 */
function removeAstral(player, index) {
  if (index >= 0 && index < player.field.length) {
    player.field.splice(index, 1);
  }
}

/**
 * 星霊を蝕態にする
 */
function eclipseAstral(astral) {
  if (!astral || astral.state !== 'radiant') return false;
  astral.state = 'eclipse';
  return true;
}

function trimReadHistory(player) {
  var nextHistory = [];

  for (var i = 0; i < player.readPageIndices.length; i++) {
    if (player.readPageIndices[i] < player.chronicleIndex) {
      nextHistory.push(player.readPageIndices[i]);
    }
  }

  player.readPageIndices = nextHistory;
}

function restoreChroniclePages(player, amount) {
  if (amount <= 0) return 0;

  var nextIndex = Math.max(0, player.chronicleIndex - amount);
  var restored = player.chronicleIndex - nextIndex;

  player.chronicleIndex = nextIndex;
  trimReadHistory(player);
  updateSkyWindow(player);

  return restored;
}

function hasRemainingAstralSource(player) {
  var i;

  for (i = 0; i < player.skyWindow.length; i++) {
    if (player.skyWindow[i].type === 'astral') {
      return true;
    }
  }

  for (i = player.chronicleIndex; i < player.chroniclePages.length; i++) {
    if (player.usedCardIndices.indexOf(i) !== -1) continue;
    if (player.chroniclePages[i].type === 'astral') {
      return true;
    }
  }

  return false;
}

/**
 * 敗北判定
 * 星典が0ページ かつ 場に星霊がいない場合は敗北
 * また、星典が0ページに到達した場合も即敗北
 */
function isDefeated(player) {
  // 星典消滅（ページが尽きた）
  if (getRemainingPages(player) <= 0) return true;

  // 星霊全滅（場に星霊なし かつ 残り星典に星霊カードなし）
  if (player.field.length === 0 && !hasRemainingAstralSource(player)) {
    return true;
  }

  return false;
}

/**
 * ターン開始時のリセット処理
 */
function resetTurnState(player) {
  player.usedFate = false;
  // 一時的な星力バフをリセット
  for (var i = 0; i < player.field.length; i++) {
    player.field[i].tempPowerBoost = 0;
  }
}

/**
 * 星命カードの効果を適用
 * @returns {boolean} 使用成功ならtrue
 */
function applyFateEffect(player, fateCard, pageIndex) {
  if (player.usedFate) return false; // 1ターン1枚制限
  if (!spendSP(player, fateCard.cost)) return false;

  switch (fateCard.effectType) {
    case 'chronicle_restore':
      // 星典の詠み位置を戻す（最小0）
      restoreChroniclePages(player, fateCard.value);
      break;

    case 'power_buff':
      // 場の星霊1体の星力+N（ターン終了まで）
      // MVPでは最初の星霊に適用
      if (player.field.length > 0) {
        player.field[0].tempPowerBoost += fateCard.value;
      }
      break;

    case 'sp_charge':
      // SP+N
      addSP(player, fateCard.value);
      break;
  }

  player.usedFate = true;

  // 使用済みに追加
  if (pageIndex !== undefined && player.usedCardIndices.indexOf(pageIndex) === -1) {
    player.usedCardIndices.push(pageIndex);
    updateSkyWindow(player);
  }

  return true;
}
