// 第 18 攤・丟球者：手指從球往洞口的方向滑出去，力道剛好才進洞；第 2 關開始洞口會左右移動
import { LIYU } from '../_kit/kit.js?v=20261118r';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 18, title: '丟球者', stall: '丟球者',
  how: ['按住下方的球，往洞口的方向滑出去', '滑太慢球會太近、太快會太遠，力道條在綠色最好', '進 3 球升級：洞口開始左右移動、越來越快', '一輪 30 秒，看你能進幾球'],
  clear: '至少投進 1 球（和現場一樣）',
  time: 30, levelEvery: 3,
  credit: '第 18 攤 丟球者',
};
const BALL = { x: 200, y: 530 }, HOLE_Y = 170, IDEAL = 1500, TOL = .25;   // 理想滑動速度（像素／秒）與容許誤差
let t, score, level, hole, drag, ball, msg, lastPow;
function start() { t = CONFIG.time; score = 0; level = 1; hole = { x: 200, dir: 1 }; drag = null; ball = null; msg = ''; lastPow = null; }
LIYU.on('down', (x, y) => { if (LIYU.running && !ball && Math.hypot(x - BALL.x, y - BALL.y) < 60) drag = { pts: [{ x, y, t: performance.now() }] }; });
LIYU.on('move', (x, y) => { if (drag) { drag.pts.push({ x, y, t: performance.now() }); if (drag.pts.length > 8) drag.pts.shift(); } });
LIYU.on('up', (x, y) => {
  if (!drag) return; const p = drag.pts; drag = null; p.push({ x, y, t: performance.now() });
  const b = p.at(-1), a = p.find((q) => q.t >= b.t - 160) || p[0], dt = Math.max(.03, (b.t - a.t) / 1000), vy = (a.y - b.y) / dt, vx = (b.x - a.x) / dt;
  if (vy < 200) return;
  const pow = vy / IDEAL; lastPow = pow;
  ball = { t: 0, tx: BALL.x + vx / vy * (BALL.y - HOLE_Y) * .9, depth: pow, x: BALL.x, y: BALL.y, s: 1 }; LIYU.sfx('throw');
});
function judge() {
  const b = ball, inX = Math.abs(b.x - hole.x) < 34 - level * 2, inPow = Math.abs(b.depth - 1) < TOL;
  if (inX && inPow) { score++; LIYU.sfx('hit'); msg = '🏀 進了！'; LIYU.clear(score); if (score % CONFIG.levelEvery === 0) { level++; LIYU.toast(`升級！第 ${level} 關`); } }
  else { LIYU.sfx('miss'); msg = !inPow ? (b.depth < 1 ? '太近了，滑快一點' : '太遠了，滑慢一點') : (b.x < hole.x ? '偏左了' : '偏右了'); }
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
  if (LIYU.running) { t -= dt; if (t <= 0 && !ball) { LIYU.finish({ score, lines: [`30 秒投進 ${score} 球`, `最高到第 ${level} 關`] }); return; } }
  if (ball) {
    ball.t += dt / .75; const k = Math.min(1, ball.t), endY = BALL.y - (BALL.y - (HOLE_Y - 20)) * ball.depth;
    ball.x = BALL.x + (ball.tx - BALL.x) * k; ball.y = BALL.y + (endY - BALL.y) * k - Math.sin(k * Math.PI) * 140; ball.s = 1 - .55 * k * Math.min(1.2, ball.depth);
    LIYU.circle(ball.x, ball.y, 26 * ball.s, '#e8473f', '#7a1d12', 3);
    if (k >= 1 && !ball.judged) { ball.judged = true; judge(); }
  } else LIYU.circle(BALL.x, BALL.y, 26, '#e8473f', '#7a1d12', 3);
  // 力道條（上一球）
  LIYU.rrect(330, 300, 22, 200, 8, '#fff', '#7a4a22', 2);
  const gy = 500 - 200 * (1 + TOL) / 2, gh = 200 * TOL; LIYU.rrect(331, gy, 20, gh, 4, '#7cc576');
  if (lastPow != null) { const py = 500 - Math.min(1, lastPow / 2) * 200; LIYU.rrect(324, py - 3, 34, 6, 3, '#e8473f'); }
  LIYU.text('力道', 341, 516, { size: 13, color: '#7a4a22' });
  LIYU.text(`⏱ ${Math.max(0, Math.ceil(t))}`, 16, 28, { align: 'left' });
  LIYU.text(`進 ${score} 球・第 ${level} 關`, W - 16, 28, { align: 'right', size: 18 });
  if (msg) LIYU.text(msg, 200, 70, { size: 20, color: '#b34a10' });
  if (!ball && score === 0 && !msg) LIYU.text('按住球往上滑 ↑', 200, 470, { size: 18, color: '#7a4a22' });
});
LIYU.setup({ ...CONFIG, start });
