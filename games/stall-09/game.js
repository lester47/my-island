// 第 09 攤・正反接球王：球從左邊來按「反手」，從右邊來按「正手」，時機對了就接住
import { LIYU } from '../_kit/kit.js?v=20261118s';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 9, title: '正反接球王', stall: '正反接球王',
  how: ['球從左邊飛來 → 按左半邊（反手）', '球從右邊飛來 → 按右半邊（正手）', '球飛到球拍旁邊再揮，太早太晚都接不到', '電腦可以用 ← → 鍵', '漏接 3 球或 60 秒到就結束'],
  clear: '正手與反手各接住一次（和現場一樣）',
  time: 60, lives: 3,
  speed0: 170, speedUp: 7, feintFrom: 8,      // 起始球速、每接一球加快多少、接到幾球後開始出現「假動作球」
  credit: '第 09 攤 正反接球王',
};
const PX = 200, PY = 430, ZONE = [34, 92];     // 球拍可以接到的距離範圍（離人的中心）

let t, lives, balls, fh, bh, combo, best, swing, spawnT;
function start() { t = CONFIG.time; lives = CONFIG.lives; balls = []; fh = bh = combo = best = 0; swing = null; spawnT = .8; }
function spawn() {
  const side = Math.random() < .5 ? -1 : 1, n = fh + bh;
  const v = CONFIG.speed0 + n * CONFIG.speedUp;
  balls.push({ side, x: side < 0 ? -16 : W + 16, y: PY - 10, v, feint: n >= CONFIG.feintFrom && Math.random() < .25, paused: 0, done: false, fly: null });
}
function hit(side) {
  if (!LIYU.running || swing) return;
  swing = { side, t: .22 }; LIYU.sfx('tap');
  const b = balls.find((q) => !q.done && q.side === side && Math.abs(q.x - PX) > ZONE[0] && Math.abs(q.x - PX) < ZONE[1]);
  if (!b) return;
  b.done = true; b.fly = { vx: -side * 260, vy: -420 };
  if (side > 0) fh++; else bh++;
  combo++; best = Math.max(best, combo); LIYU.sfx('hit');
  if (fh >= 1 && bh >= 1) LIYU.clear(fh + bh);
}
LIYU.on('down', (x) => hit(x < W / 2 ? -1 : 1));
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') hit(-1); if (e.key === 'ArrowRight') hit(1); });

function drawPlayer() {
  const s = swing ? swing.side : 0;
  ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  LIYU.circle(PX, PY - 70, 20, '#ffd9b8', '#2a1d12', 3);
  LIYU.rrect(PX - 18, PY - 48, 36, 50, 10, '#2f7fd1');
  ctx.beginPath(); ctx.moveTo(PX - 8, PY + 2); ctx.lineTo(PX - 12, PY + 40); ctx.moveTo(PX + 8, PY + 2); ctx.lineTo(PX + 12, PY + 40); ctx.stroke();
  for (const side of [-1, 1]) {                          // 兩隻手；揮拍的那一邊伸出去拿球拍
    const out = s === side, ang = out ? (side < 0 ? Math.PI : 0) : (side < 0 ? Math.PI * .65 : Math.PI * .35);
    const hx = PX + side * 16, hy = PY - 38, ex = hx + Math.cos(ang) * 30, ey = hy + Math.sin(ang) * 30;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    if (out) { ctx.save(); ctx.translate(ex + side * 22, ey); LIYU.circle(0, 0, 18, 'rgba(232,118,43,.25)', '#e8762b', 4); ctx.restore(); }
  }
}
LIYU.loop((dt, now) => {
  LIYU.bg('#e8f6e1');
  LIYU.rrect(0, PY + 40, W, H - PY - 40, 0, '#c9a06a');
  ctx.fillStyle = 'rgba(47,127,209,.08)'; ctx.fillRect(0, 0, W / 2, H); ctx.fillStyle = 'rgba(232,118,43,.08)'; ctx.fillRect(W / 2, 0, W / 2, H);
  LIYU.text('反手', W / 4, H - 50, { size: 30, color: '#2f7fd1' }); LIYU.text('正手', W * .75, H - 50, { size: 30, color: '#e8762b' });
  LIYU.text('← 點這半邊', W / 4, H - 20, { size: 15, color: '#2f7fd1', weight: 600 }); LIYU.text('點這半邊 →', W * .75, H - 20, { size: 15, color: '#e8762b', weight: 600 });
  if (!balls) { drawPlayer(); return; }
  if (LIYU.running) {
    t -= dt; spawnT -= dt;
    if (spawnT <= 0 && balls.filter((b) => !b.done).length < 2) { spawn(); spawnT = Math.max(.55, 1.5 - (fh + bh) * .04) + Math.random() * .5; }
    if (swing && (swing.t -= dt) <= 0) swing = null;
    for (const b of balls) {
      if (b.fly) { b.x += b.fly.vx * dt; b.y += b.fly.vy * dt; b.fly.vy += 700 * dt; continue; }
      if (b.done) continue;
      if (b.feint && !b.paused && Math.abs(b.x - PX) < 150) b.paused = .45;        // 假動作：停一下再飛
      if (b.paused > 0) { b.paused -= dt; if (b.paused <= 0) { b.paused = -1; b.v *= 1.25; } continue; }
      b.x -= b.side * b.v * dt;
      if (Math.abs(b.x - PX) < 14) { b.done = true; lives--; combo = 0; LIYU.sfx('miss'); LIYU.toast(b.side > 0 ? '漏接！右邊來要按正手' : '漏接！左邊來要按反手'); }
    }
    balls = balls.filter((b) => !(b.fly && b.y > H + 40) && !(b.done && !b.fly));
    if (t <= 0 || lives <= 0) LIYU.finish({ score: fh + bh, lines: [`接住 ${fh + bh} 球（正手 ${fh}、反手 ${bh}）`, `最多連續 ${best} 球`] });
  }
  for (const b of balls) {
    const bounce = b.fly ? 0 : Math.abs(Math.sin(now * 8 + b.x * .02)) * 18;
    LIYU.circle(b.x, b.y - bounce, 11, b.feint ? '#ff5d8f' : '#ffd23a', '#2a1d12', 2);
  }
  // 可以接球的範圍提示
  ctx.globalAlpha = .18; for (const s of [-1, 1]) LIYU.rrect(PX + s * (s < 0 ? ZONE[1] : ZONE[0]), PY - 40, ZONE[1] - ZONE[0], 50, 10, s < 0 ? '#2f7fd1' : '#e8762b'); ctx.globalAlpha = 1;
  drawPlayer();
  LIYU.text(`⏱ ${Math.max(0, Math.ceil(t))}`, 16, 28, { align: 'left' });
  LIYU.text('❤️'.repeat(Math.max(0, lives)), W / 2, 28);
  LIYU.text(`正手 ${fh}・反手 ${bh}`, W - 16, 28, { align: 'right', size: 18 });
  if (fh + bh === 0 && LIYU.running) LIYU.text('球到淡色框框裡再揮拍！', W / 2, 120, { size: 20, color: '#7a4a22' });
});
LIYU.peek = () => ({ balls, fh, bh });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
