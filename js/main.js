/* ========================================
   main.js — 初期化・エントリーポイント
   ======================================== */

(function() {
  console.log('★ 星典戦記 — Chronicle of Stars ★');
  console.log('Version: 0.7.0 (Phase 7: 内容拡張基盤)');
})();

/**
 * ゲーム開始
 */
function startGame() {
  var setupOptions = typeof getSetupSelection === 'function' ? getSetupSelection() : {};

  if (typeof resetUiState === 'function') {
    resetUiState(setupOptions);
  }

  var state = initGame(setupOptions);
  syncGameState(state);
}

function returnToTitleScreen() {
  var setupOptions = typeof getSetupSelection === 'function' ? getSetupSelection() : {};

  gameState = null;
  if (typeof resetUiState === 'function') {
    resetUiState(setupOptions);
  }

  if (typeof renderTitleScreen === 'function') {
    renderTitleScreen();
  }
}

function bootApplication() {
  if (typeof resetUiState === 'function') {
    resetUiState();
  }

  if (typeof renderTitleScreen === 'function') {
    renderTitleScreen();
  }
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
  window.runPhase7Simulation = runPhase7Simulation;
  window.returnToTitleScreen = returnToTitleScreen;
}

bootApplication();
