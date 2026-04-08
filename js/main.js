/* ========================================
   main.js — 初期化・エントリーポイント
   ======================================== */

(function() {
  console.log('★ 星典戦記 — Chronicle of Stars ★');
  console.log('Version: 0.5.0 (Phase 1-5: 統合)');
})();

/**
 * ゲーム開始
 */
function startGame() {
  var state = initGame();
  renderGameState(state);
}
