/* ========================================
   main.js — 初期化・エントリーポイント
   ======================================== */

/**
 * アプリケーション初期化
 * ページ読み込み完了時に自動実行
 */
(function() {
  console.log('★ 星典戦記 — Chronicle of Stars ★');
  console.log('Version: 0.1.0 (Phase 1: 基盤)');
  console.log('');

  // Phase 1 動作確認: カードデータをコンソールに出力
  debugCardData();
})();

/**
 * ゲーム開始（タイトル画面の「星典を開く」ボタン）
 */
function startGame() {
  console.log('');
  console.log('=== ゲーム開始 ===');
  console.log('（Phase 2 で initGame() を実装予定）');

  // TODO: Phase 2 で initGame() を呼び出す
  // TODO: Phase 3 で UI描画を呼び出す
  alert('Phase 2 の実装後にゲームが開始されます。\nコンソール（F12）でカードデータを確認してください。');
}
