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
    usedCardIndices: []       // 使用済みカードのページインデックス
  };
}

/**
 * 星典を1ページ詠む（SP+2獲得）
 * @returns {Card|null} 詠んだカード（詠めない場合null）
 */
function readPage(player) {
  if (!canRead(player)) return null;

  var card = player.chroniclePages[player.chronicleIndex];
  player.chronicleIndex++;
  player.sp += SP_PER_PAGE;

  // 天窓を更新
  updateSkyWindow(player);

  return card;
}

/**
 * 詠めるかどうか判定
 */
function canRead(player) {
  return player.chronicleIndex < player.chroniclePages.length;
}

/**
 * 残りページ数を取得
 */
function getRemainingPages(player) {
  return player.chroniclePages.length - player.chronicleIndex;
}

/**
 * 天窓（見開き）カードを更新
 * 直近2ページ分のカードのうち、未使用のものを天窓に表示
 */
function updateSkyWindow(player) {
  player.skyWindow = [];

  // 直近2ページ分のインデックスを算出
  // chronicleIndex は「次に詠むページ」なので、
  // 直近2ページは chronicleIndex-2 と chronicleIndex-1
  var startIdx = Math.max(0, player.chronicleIndex - 2);
  var endIdx = player.chronicleIndex; // exclusive

  for (var i = startIdx; i < endIdx; i++) {
    // 使用済みでないカードのみ天窓に表示
    if (player.usedCardIndices.indexOf(i) === -1) {
      var card = player.chroniclePages[i];
      // 天窓用の情報を付加
      card._pageIndex = i; // 元のページインデックス
      player.skyWindow.push(card);
    }
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
  if (player.sp < cost) return false;
  player.sp -= cost;
  return true;
}

/**
 * SP追加
 */
function addSP(player, amount) {
  player.sp += amount;
}

/**
 * 星霊を場に召喚
 * @returns {boolean} 召喚成功ならtrue
 */
function summonAstral(player, card, pageIndex) {
  if (player.field.length >= MAX_FIELD_ASTRALS) return false;
  if (card.type !== 'astral') return false;

  // カードを複製してフィールドに追加
  var fieldCard = cloneCard(card);
  fieldCard.state = 'radiant'; // 輝態で召喚
  fieldCard.tempPowerBoost = 0;
  player.field.push(fieldCard);

  // 使用済みに追加
  if (pageIndex !== undefined) {
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
  astral.state = 'eclipse';
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
  if (player.field.length === 0) {
    var hasAstralInChronicle = false;
    for (var i = player.chronicleIndex; i < player.chroniclePages.length; i++) {
      if (player.chroniclePages[i].type === 'astral') {
        hasAstralInChronicle = true;
        break;
      }
    }
    if (!hasAstralInChronicle) return true;
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
      player.chronicleIndex = Math.max(0, player.chronicleIndex - fateCard.value);
      updateSkyWindow(player);
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
  if (pageIndex !== undefined) {
    player.usedCardIndices.push(pageIndex);
    updateSkyWindow(player);
  }

  return true;
}
