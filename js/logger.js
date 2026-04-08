/* ========================================
   logger.js — ログ管理
   ======================================== */

/**
 * ゲームログにメッセージを追加
 */
function addLog(state, message) {
  if (!state.log) state.log = [];
  state.log.push(message);
  console.log('[LOG] ' + message);
}
