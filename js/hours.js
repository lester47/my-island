// 🕙 營業時間：每天 06:00 開張、22:00 休市（台灣時間，不管裝置設定哪個時區）
//   - 休市時整個市集蓋上「休市中」畫面，什麼都不能玩
//   - 老師名冊上的帳號（管理人員）不受限制，休市時登入照樣可以進來測試
//   - 本機開發（localhost）可以用 ?clock=23:10 假裝現在幾點，方便測試
export const OPEN = 6 * 60, CLOSE = 22 * 60;   // 用「一天的第幾分鐘」表示
const TW = 8 * 60;                               // 台灣 UTC+8，沒有日光節約時間

function fakeClock() {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return null;
  const m = /[?&]clock=(\d{1,2}):(\d{2})/.exec(location.search);
  return m ? (+m[1] * 60 + +m[2]) : null;
}
/** 現在是台灣時間一天的第幾分鐘（0～1439） */
export function nowMin() {
  const f = fakeClock(); if (f != null) return f;
  return Math.floor(Date.now() / 60000 + TW) % 1440;
}
export const isOpen = (m = nowMin()) => m >= OPEN && m < CLOSE;
/** 離休市還有幾分鐘（休市中回傳 0） */
export const minsToClose = (m = nowMin()) => (isOpen(m) ? CLOSE - m : 0);
/** 離開張還有幾分鐘（營業中回傳 0） */
export const minsToOpen = (m = nowMin()) => (isOpen(m) ? 0 : (OPEN - m + 1440) % 1440);
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
