// 第 12 攤・鯉魚 Liyu 遊戲店：四子連線（和電腦對下）。先把 4 顆同色連成一線（橫、直、斜都可以）就贏
import { LIYU } from '../_kit/kit.js?v=20261119g';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 12, title: '鯉魚四子連線', stall: '鯉魚 Liyu 遊戲店',
  how: ['點一個直排，棋子會掉到最下面', '你是橘色鯉魚 🟠，電腦是藍色 🔵，輪流下', '先把 4 顆連成一條線（橫、直、斜）就贏', '電腦會往前想好幾步，會擋你也會布局，小心！'],
  clear: '贏電腦 1 盤',
  credit: '第 12 攤 鯉魚 Liyu 遊戲店',
};
const COLS = 7, ROWS = 6, S = 52, OX = (W - COLS * S) / 2, OY = 150, ME = 1, AI = 2;
let board, turn, over, drop, wins, games, line, msg, hover = -1;
function fresh() { board = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); turn = ME; over = false; drop = null; line = null; msg = '換你下！'; }
function start() { wins = 0; games = 0; fresh(); }
const rowFor = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; };
function four(b, p) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
    if (cells.every(([y, x]) => y >= 0 && y < ROWS && x >= 0 && x < COLS && b[y][x] === p)) return cells;
  }
  return null;
}
// 電腦：往前想 DEPTH 步（你下、它回、你再下…），用 alpha-beta 剪枝；想不完的盤面用「每 4 格一組」的連線潛力打分數。
// 以前只看一步，「底排兩頭空的三顆」這種雙重威脅擋不住，每次都輸在同一招
const DEPTH = 5, WIN = 1e6, ORDER = [3, 2, 4, 1, 5, 0, 6];
function windowScore(a, b, c, d) {
  let ai = 0, me = 0; for (const v of [a, b, c, d]) { if (v === AI) ai++; else if (v === ME) me++; }
  if (ai && me) return 0;
  if (ai === 3) return 50; if (ai === 2) return 6;
  if (me === 3) return -60; if (me === 2) return -7;   // 擋你的比自己連線稍微重要一點
  return 0;
}
function evaluate(b) {
  let sc = 0;
  for (let r = 0; r < ROWS; r++) sc += (b[r][3] === AI ? 4 : b[r][3] === ME ? -4 : 0);   // 中間那排比較有用
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c + 3 < COLS) sc += windowScore(b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]);
    if (r + 3 < ROWS) sc += windowScore(b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]);
    if (r + 3 < ROWS && c + 3 < COLS) sc += windowScore(b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]);
    if (r + 3 < ROWS && c - 3 >= 0) sc += windowScore(b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]);
  }
  return sc;
}
function search(b, depth, alpha, beta, p) {
  const moves = ORDER.filter((c) => rowFor(b, c) >= 0);
  if (!moves.length) return 0;
  if (depth === 0) return evaluate(b);
  let best = p === AI ? -Infinity : Infinity;
  for (const c of moves) {
    const r = rowFor(b, c); b[r][c] = p;
    const v = four(b, p) ? (p === AI ? WIN + depth : -WIN - depth) : search(b, depth - 1, alpha, beta, p === AI ? ME : AI);   // 越早贏越好、越晚輸越好
    b[r][c] = 0;
    if (p === AI) { if (v > best) best = v; if (best > alpha) alpha = best; } else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  return best;
}
function aiMove() {
  const ok = ORDER.filter((c) => rowFor(board, c) >= 0);
  const scored = ok.map((c) => {
    const r = rowFor(board, c); board[r][c] = AI;
    const v = four(board, AI) ? WIN * 2 : search(board, DEPTH - 1, -Infinity, Infinity, ME);
    board[r][c] = 0; return { c, v };
  });
  const top = Math.max(...scored.map((m) => m.v));
  const best = scored.filter((m) => m.v >= top - 2);          // 分數差不多的走法隨機挑一個，每盤不會都一樣
  return best[Math.floor(Math.random() * best.length)].c;
}
function play(c, p) {
  const r = rowFor(board, c); if (r < 0) return false;
  drop = { c, r, p, y: OY - S, done: false }; LIYU.sfx('tap'); return true;
}
function landed() {
  const { c, r, p } = drop; board[r][c] = p; drop = null;
  const w = four(board, p);
  if (w) { line = w; over = true; games++; if (p === ME) { wins++; msg = '🎉 你贏了！'; LIYU.clear(wins); } else { msg = '電腦連成一線了…'; LIYU.sfx('miss'); } return setTimeout(endGame, 1400); }
  if (board[0].every((v) => v)) { over = true; games++; msg = '平手！'; return setTimeout(endGame, 1200); }
  turn = p === ME ? AI : ME; msg = turn === ME ? '換你下！' : '電腦想一下…';
  if (turn === AI) setTimeout(() => { if (LIYU.running && !over) play(aiMove(), AI); }, 550);
}
function endGame() { if (LIYU.running) LIYU.finish({ score: wins, lines: [msg, `你贏了 ${wins} 盤（共 ${games} 盤）`] }); }
LIYU.on('move', (x) => { hover = Math.floor((x - OX) / S); });
LIYU.on('down', (x, y) => {
  if (!LIYU.running || over || drop || turn !== ME) return;
  const c = Math.floor((x - OX) / S); if (c < 0 || c >= COLS || y < OY - 70 || y > OY + ROWS * S + 10) return;
  play(c, ME);
});
const piece = (x, y, p, r = S / 2 - 6) => { LIYU.circle(x, y, r, p === ME ? '#e8762b' : '#2f7fd1', p === ME ? '#b34a10' : '#1d5aa0', 3); LIYU.circle(x - r * .3, y - r * .3, r * .25, 'rgba(255,255,255,.55)'); if (p === ME) LIYU.text('🐟', x, y + 1, { size: 16 }); };
LIYU.loop((dt) => {
  LIYU.bg('#eaf3fb');
  if (!board) { LIYU.text('🟠🔵🟠🔵', 200, 300, { size: 40 }); return; }
  LIYU.text(msg, 200, 70, { size: 24, color: turn === ME ? '#b34a10' : '#1d5aa0' });
  LIYU.text(`你贏 ${wins} 盤`, 16, 26, { align: 'left', size: 16 });
  if (turn === ME && !over && !drop && hover >= 0 && hover < COLS) piece(OX + hover * S + S / 2, OY - 36, ME, 18);
  if (drop) { drop.y += 900 * dt; const ty = OY + drop.r * S + S / 2; if (drop.y >= ty) { drop.y = ty; landed(); } }
  LIYU.rrect(OX - 8, OY - 8, COLS * S + 16, ROWS * S + 16, 16, '#2f6fb5');
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const x = OX + c * S + S / 2, y = OY + r * S + S / 2; if (board[r][c]) piece(x, y, board[r][c]); else LIYU.circle(x, y, S / 2 - 6, '#eaf3fb'); }
  if (drop) piece(OX + drop.c * S + S / 2, drop.y, drop.p);
  if (line) { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); const [a, b] = [line[0], line[3]]; ctx.moveTo(OX + a[1] * S + S / 2, OY + a[0] * S + S / 2); ctx.lineTo(OX + b[1] * S + S / 2, OY + b[0] * S + S / 2); ctx.stroke(); }
  LIYU.text('點一個直排放棋子', 200, OY + ROWS * S + 40, { size: 16, color: '#4a6a8a', weight: 600 });
});
LIYU.peek = () => ({ board, turn, drop, over, wins });   // 自動測試用
LIYU.setup({ ...CONFIG, start: () => { start(); } });
