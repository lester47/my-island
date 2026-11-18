// 第 12 攤・鯉魚 Liyu 遊戲店：四子連線（和電腦對下）。先把 4 顆同色連成一線（橫、直、斜都可以）就贏
import { LIYU } from '../_kit/kit.js?v=20261118s';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 12, title: '鯉魚四子連線', stall: '鯉魚 Liyu 遊戲店',
  how: ['點一個直排，棋子會掉到最下面', '你是橘色鯉魚 🟠，電腦是藍色 🔵，輪流下', '先把 4 顆連成一條線（橫、直、斜）就贏', '電腦會擋你，也會偷偷連線，小心！'],
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
function aiMove() {
  const ok = [...Array(COLS).keys()].filter((c) => rowFor(board, c) >= 0);
  const test = (c, p) => { const r = rowFor(board, c); board[r][c] = p; const w = !!four(board, p); board[r][c] = 0; return w; };
  for (const c of ok) if (test(c, AI)) return c;                                // 能贏就贏
  for (const c of ok) if (test(c, ME)) return c;                                // 擋住你
  const safe = ok.filter((c) => { const r = rowFor(board, c); if (r <= 0) return true; board[r][c] = AI; board[r - 1][c] = ME; const bad = !!four(board, ME); board[r][c] = board[r - 1][c] = 0; return !bad; });
  const pool = safe.length ? safe : ok;
  pool.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) + (Math.random() - .5) * 2.2);   // 喜歡中間，但有點隨機（不會太強）
  return pool[0];
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
