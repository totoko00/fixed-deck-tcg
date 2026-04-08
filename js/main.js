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
  if (typeof resetUiState === 'function') {
    resetUiState();
  }

  var state = initGame();
  syncGameState(state);
}

if (typeof window !== 'undefined') {
  window.render_game_to_text = function() {
    return renderGameToText(gameState);
  };

  window.advanceTime = function() {
    syncGameState(gameState);
    return window.render_game_to_text();
  };

  window.runPhase2Simulation = runPhase2Simulation;
  window.runPhase4Simulation = runPhase4Simulation;
  window.runPhase5Simulation = runPhase5Simulation;
}
