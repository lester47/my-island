// 第 18 攤・丟球者：手指從球往洞口的方向滑出去，力道剛好才進洞；第 2 關開始洞口會左右移動
import { LIYU } from '../_kit/kit.js?v=20261118t';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 18, title: '丟球者', stall: '丟球者',
  how: ['按住紅色的球：右邊的力道條會一直上下跑', '按著的時候左右拖，可以瞄準洞口（看虛線）', '力道條跑到綠色時放開，球就剛好進洞', '電腦：按住空白鍵蓄力，← → 瞄準', '進 3 球升級：洞口開始左右移動、越來越快；一輪 30 秒'],
  clear: '至少投進 1 球（和現場一樣）',
  time: 30, levelEvery: 3,
  green: [.6, .8],                         // 力道條的綠色區（0＝最下面、1＝最上面）
  credit: '第 18 攤 丟球者',
};
const BALL = { x: 200, y: 530 }, HOLE_Y = 170, BAR = { x: 336, y: 260, w: 34, h: 240 };
const MID = (CONFIG.green[0] + CONFIG.green[1]) / 2, TOL = (CONFIG.green[1] - CONFIG.green[0]) / 2 / MID;
let t, score, level, hole, hold, ball, msg, lastPow, aim, keys = {};
function start() { t = CONFIG.time; score = 0; level = 1; hole = { x: 200, dir: 1 }; hold = null; ball = null; msg = ''; lastPow = null; aim = 200; }
// 力道條：按住時在 0～1 之間上下跑（越後面的關卡跑得越快）
const powNow = () => { if (!hold) return 0; const k = hold.c % 2; return k < 1 ? k : 2 - k; };
const aimAt = (x) => Math.max(90, Math.min(310, BALL.x + (x - BALL.x) * 1.6));
function begin(x) { if (!LIYU.running || ball || hold) return; hold = { c: 0, x0: x }; LIYU.sfx('tap'); }
function release() {
  if (!hold) return; const p = powNow(); hold = null;
  const depth = p / MID; lastPow = p;
  ball = { t: 0, tx: aim, depth, x: BALL.x, y: BALL.y, s: 1 }; LIYU.sfx('throw');
}
LIYU.on('down', (x, y) => { if (Math.hypot(x - BALL.x, y - BALL.y) < 70) begin(x); });
LIYU.on('move', (x, y, e, held) => { if (hold && held) aim = aimAt(x); });
LIYU.on('up', release);
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) begin(BALL.x); } keys[e.key] = true; });
addEventListener('keyup', (e) => { if (e.code === 'Space') release(); keys[e.key] = false; });
function judge() {
  const b = ball, inX = Math.abs(b.x - hole.x) < 34 - level * 2, inPow = Math.abs(b.depth - 1) < TOL;
  if (inX && inPow) { score++; LIYU.sfx('hit'); msg = '🏀 進了！'; LIYU.clear(score); if (score % CONFIG.levelEvery === 0) { level++; LIYU.toast(`升級！第 ${level} 關`); } }
  else { LIYU.sfx('miss'); msg = !inPow ? (b.depth < 1 ? '太近了！等力道條再高一點' : '太遠了！早一點放開') : (b.x < hole.x ? '偏左了，往右瞄一點' : '偏右了，往左瞄一點'); }
  setTimeout(() => (ball = null), 350);
}
LIYU.loop((dt, now) => {
  LIYU.bg('#e9f3fb');
  ctx.fillStyle = '#cfe3c0'; ctx.beginPath(); ctx.moveTo(120, 110); ctx.lineTo(280, 110); ctx.lineTo(400, 600); ctx.lineTo(0, 600); ctx.fill();   // 地面（有遠近）
  if (LIYU.running && level > 1) { hole.x += hole.dir * (40 + level * 22) * dt; if (hole.x > 280 || hole.x < 120) hole.dir *= -1; }
  const hx = hole ? hole.x : 200;
  LIYU.rrect(hx - 70, HOLE_Y - 70, 140, 90, 12, '#f2c14e', '#a8743f', 3);       // 洞口板
  ctx.beginPath(); ctx.ellipse(hx, HOLE_Y - 20, 30, 24, 0, 0, Math.PI * 2); ctx.fillStyle = '#2a1d12'; ctx.fill();
  LIYU.text('進洞', hx, HOLE_Y + 8, { size: 14, color: '#7a4a22' });
  if (!LIYU.running && !ball) { LIYU.circle(BALL.x, BALL.y, 26, '#e8473f', '#7a1d12', 3); return; }
  if (hold) { hold.c += dt * (1.1 + level * .15); if (keys.ArrowLeft) aim = Math.max(90, aim - 160 * dt); if (keys.ArrowRight) aim = Math.min(310, aim + 160 * dt); }
  if (LIYU.running) { t -= dt; if (t <= 0 && !ball) { LIYU.finish({ score, lines: [`30 秒投進 ${score} 球`, `最高到第 ${level} 關`] }); return; } }
  if (ball) {
    ball.t += dt / .75; const k = Math.min(1, ball.t), endY = BALL.y - (BALL.y - (HOLE_Y - 20)) * ball.depth;
    ball.x = BALL.x + (ball.tx - BALL.x) * k; ball.y = BALL.y + (endY - BALL.y) * k - Math.sin(k * Math.PI) * 140; ball.s = 1 - .55 * k * Math.min(1.2, ball.depth);
    LIYU.circle(ball.x, ball.y, 26 * ball.s, '#e8473f', '#7a1d12', 3);
    if (k >= 1 && !ball.judged) { ball.judged = true; judge(); }
  } else LIYU.circle(BALL.x, BALL.y, 26, '#e8473f', '#7a1d12', 3);
  // 瞄準虛線
  if (hold || (!ball && LIYU.running)) { ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(122,74,34,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(BALL.x, BALL.y - 30); ctx.quadraticCurveTo((BALL.x + aim) / 2, 260, aim, HOLE_Y - 20); ctx.stroke(); ctx.setLineDash([]); LIYU.circle(aim, HOLE_Y - 20, 6, 'rgba(232,71,63,.7)'); }
  // 力道條：按住球時上下跑，綠色區放開最剛好
  const { x: bx, y: by, w: bw, h: bh } = BAR, py = (v) => by + bh - v * bh;
  LIYU.rrect(bx, by, bw, bh, 10, '#fff', '#7a4a22', 3);
  LIYU.rrect(bx + 2, py(CONFIG.green[1]), bw - 4, (CONFIG.green[1] - CONFIG.green[0]) * bh, 4, '#7cc576');
  LIYU.text('太遠', bx + bw / 2, by + 16, { size: 12, color: '#b3263a' }); LIYU.text('剛好', bx - 22, py(MID), { size: 13, color: '#2f8a40' }); LIYU.text('太近', bx + bw / 2, by + bh - 14, { size: 12, color: '#7a4a22' });
  const pv = hold ? powNow() : lastPow;
  if (pv != null) LIYU.rrect(bx - 8, py(pv) - 4, bw + 16, 8, 4, hold ? '#e8473f' : 'rgba(232,71,63,.45)');
  LIYU.text('力道', bx + bw / 2, by + bh + 18, { size: 14, color: '#7a4a22' });
  LIYU.text(`⏱ ${Math.max(0, Math.ceil(t))}`, 16, 28, { align: 'left' });
  LIYU.text(`進 ${score} 球・第 ${level} 關`, W - 16, 28, { align: 'right', size: 18 });
  if (msg) LIYU.text(msg, 200, 70, { size: 20, color: '#b34a10' });
  if (!ball && !hold && LIYU.running) LIYU.text(score === 0 && !msg ? '👇 按住這顆球蓄力' : '👇 按住球再丟一次', 200, 478, { size: 18, color: '#7a4a22' });
  if (hold) LIYU.text('力道到綠色就放開！左右拖可以瞄準', 200, 478, { size: 16, color: '#b34a10' });
});
LIYU.peek = () => ({ pow: powNow(), hold: !!hold });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
