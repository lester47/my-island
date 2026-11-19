// 第 14 攤・娃！茶一點就中：往後拉再放開（像彈弓），讓道具畫一道弧線落進茶杯
import { LIYU } from '../_kit/kit.js?v=20261119c';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 14, title: '娃！茶一點就中', stall: '娃！茶一點就中',
  how: ['在畫面上按住，往「左下」拉，放開就丟出去', '拉越長丟越遠，虛線是大概的飛行路線', '落進茶杯就得分：近的大杯 1 分、中杯 2 分、遠的小杯 3 分', '一輪 6 次；第 4 次開始有風，看旗子的方向'],
  clear: '至少投中 1 次（和現場一樣）',
  throws: 6, windFrom: 4,
  cups: [{ x: 190, w: 64, h: 54, pts: 1, c: '#7cc576' }, { x: 275, w: 50, h: 46, pts: 2, c: '#2f7fd1' }, { x: 348, w: 38, h: 40, pts: 3, c: '#e8473f' }],
  credit: '第 14 攤 娃！茶一點就中',
};
const TABLE = 470, L0 = { x: 56, y: 420 }, G = 900;
let left, score, hits, shot, drag, wind, msg, splash;
function start() { left = CONFIG.throws; score = 0; hits = 0; shot = null; drag = null; wind = 0; msg = ''; splash = null; }
function nextWind() { const n = CONFIG.throws - left + 1; wind = n >= CONFIG.windFrom ? Math.round((Math.random() * 2 - 1) * 140) : 0; }
LIYU.on('down', (x, y) => { if (LIYU.running && !shot && left > 0) drag = { x0: x, y0: y, x, y }; });
LIYU.on('move', (x, y) => { if (drag) { drag.x = x; drag.y = y; } });
LIYU.on('up', () => {
  if (!drag) return; const v = pullV(); drag = null;
  if (Math.hypot(v.vx, v.vy) < 120) return;
  shot = { x: L0.x, y: L0.y, vx: v.vx, vy: v.vy, done: false }; left--; LIYU.sfx('throw');
});
function pullV() { let dx = drag.x0 - drag.x, dy = drag.y0 - drag.y; const d = Math.hypot(dx, dy), m = 140; if (d > m) { dx *= m / d; dy *= m / d; } return { vx: dx * 4.2, vy: dy * 4.2 }; }
function cupTop(c) { return TABLE - c.h; }
function stepShot(dt) {
  const s = shot, px = s.x, py = s.y;
  s.vx += wind * dt; s.vy += G * dt; s.x += s.vx * dt; s.y += s.vy * dt;
  for (const c of CONFIG.cups) {
    const ty = cupTop(c), l = c.x - c.w / 2, r = c.x + c.w / 2;
    if (py < ty && s.y >= ty && s.vy > 0) {                                   // 剛好穿過杯口那條線
      if (s.x > l + 6 && s.x < r - 6) { s.done = true; hits++; score += c.pts; LIYU.sfx('hit'); msg = `🍵 進了！+${c.pts}`; splash = { x: c.x, y: ty, t: .6 }; LIYU.clear(score); return end(); }
      if (s.x > l - 6 && s.x < r + 6) { s.vy *= -.45; s.vx *= .6; s.y = ty - 1; LIYU.sfx('bump'); msg = '叮！碰到杯緣'; }
    }
  }
  if (s.y > TABLE - 8) { s.done = true; LIYU.sfx('miss'); msg = s.x < CONFIG.cups[0].x - 40 ? '太近了，拉長一點' : s.x > W ? '太遠了' : '沒進，再試試'; return end(); }
  if (s.x > W + 60 || s.x < -40) { s.done = true; msg = '飛出去了！'; return end(); }
}
function end() { setTimeout(() => { shot = null; if (!LIYU.running) return; if (left <= 0) LIYU.finish({ score, lines: [`6 次投中 ${hits} 次`, `得到 ${score} 分`] }); else nextWind(); }, 650); }
function drawCup(c) {
  const ty = cupTop(c);
  ctx.beginPath(); ctx.moveTo(c.x - c.w / 2, ty); ctx.lineTo(c.x + c.w / 2, ty); ctx.lineTo(c.x + c.w / 2 - 8, TABLE); ctx.lineTo(c.x - c.w / 2 + 8, TABLE); ctx.closePath(); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.strokeStyle = c.c; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(c.x, ty, c.w / 2, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#c9a050'; ctx.fill(); ctx.stroke();
  LIYU.rrect(c.x - 12, ty + 14, 24, 18, 6, c.c); LIYU.text(String(c.pts), c.x, ty + 24, { size: 14, color: '#fff' });
  ctx.beginPath(); ctx.arc(c.x + c.w / 2 + 2, ty + c.h / 2, 10, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = c.c; ctx.stroke();
}
LIYU.loop((dt, now) => {
  LIYU.bg('#fdf1dc');
  LIYU.rrect(120, TABLE, 290, 20, 4, '#a8743f'); ctx.fillStyle = '#8b5a2b'; ctx.fillRect(140, TABLE + 20, 14, 110); ctx.fillRect(376, TABLE + 20, 14, 110);
  for (const c of CONFIG.cups) drawCup(c);
  // 旗子顯示風向
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(380, 120, 4, 90);
  const wv = wind / 140; ctx.beginPath(); ctx.moveTo(382, 124); ctx.lineTo(382 + 40 * (Math.abs(wv) < .05 ? .15 : wv), 134 + Math.sin(now * 6) * 3); ctx.lineTo(382, 146); ctx.fillStyle = '#e8473f'; ctx.fill();
  LIYU.text(wind ? `風 ${wind > 0 ? '→' : '←'} ${Math.abs(Math.round(wind / 14))}` : '無風', 382, 222, { size: 15, color: '#7a4a22' });
  // 發射台
  LIYU.rrect(L0.x - 18, L0.y + 10, 36, TABLE - L0.y + 120, 6, '#c9a06a');
  if (!LIYU.running && !shot) { LIYU.text('🍵', 200, 260, { size: 60 }); return; }
  if (drag) {
    const v = pullV(); ctx.fillStyle = 'rgba(122,74,34,.5)';
    for (let i = 1; i < 14; i++) { const t = i * .05; LIYU.circle(L0.x + v.vx * t + .5 * wind * t * t, L0.y + v.vy * t + .5 * G * t * t, 3, 'rgba(122,74,34,.45)'); }
    ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L0.x, L0.y); ctx.lineTo(L0.x - (drag.x0 - drag.x) * .4, L0.y - (drag.y0 - drag.y) * .4); ctx.stroke();
  }
  if (shot && !shot.done) stepShot(dt);
  if (shot) LIYU.circle(shot.x, shot.y, 9, '#f2d14b', '#7a4a22', 2);
  else if (left > 0) LIYU.circle(L0.x - (drag ? (drag.x0 - drag.x) * .4 : 0), L0.y - (drag ? (drag.y0 - drag.y) * .4 : 0), 9, '#f2d14b', '#7a4a22', 2);
  if (splash && (splash.t -= dt) > 0) for (let i = 0; i < 6; i++) LIYU.circle(splash.x + Math.cos(i) * 20 * (1 - splash.t), splash.y - 20 * (1 - splash.t) - i * 2, 4, 'rgba(201,160,80,.8)');
  LIYU.text(`剩 ${left} 次・${score} 分`, 16, 28, { align: 'left', size: 18 });
  if (msg) LIYU.text(msg, 200, 80, { size: 20, color: '#b34a10' });
  if (!drag && !shot && left === CONFIG.throws) LIYU.text('按住畫面往左下拉 ↙ 再放開', 200, 330, { size: 18, color: '#7a4a22' });
});
LIYU.setup({ ...CONFIG, start });
