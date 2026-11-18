// 第 17 攤・名不虛傳 GG 手：穩穩手挑戰「小鯉魚回家」
// 小鯉魚要沿著安全水道游回家；水道外是危險水域：巡邏的大魚、漂來漂去的水母、海膽、躲在石縫的海鱔。
// 玩法和電流急急棒一樣：按住小魚拖著走，碰到水道邊緣就會被攻擊，回到上一個珍珠貝殼（檢查點）。
import { LIYU } from '../_kit/kit.js?v=20261118w';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 17, title: '穩穩手：小鯉魚回家', stall: '名不虛傳 GG 手',
  how: ['按住小鯉魚，沿著亮亮的安全水道，慢慢拖回「家」', '水道外面很危險：大魚會巡邏，你靠近邊緣時牠會盯上你！', '碰到水道邊緣就會被咬（或被水母電到、被海膽刺到），回到上一個 🐚 珍珠貝殼', '手指放開沒關係，再按住小鯉魚就能繼續', '一共 3 關：淺水溪流 → 珊瑚礁 → 深海峽谷，水道越來越窄'],
  clear: '游完第 1 關（手部挑戰成功）',
  widths: [26, 19, 14],                                                        // 每關水道的半寬（越小越難）
  paths: [
    [[60, 120], [340, 120], [340, 230], [80, 230], [80, 340], [320, 340], [320, 460], [120, 460], [200, 540]],
    [[50, 110], [200, 160], [350, 110], [330, 250], [180, 210], [70, 290], [200, 360], [340, 330], [300, 470], [140, 430], [80, 540], [330, 545]],
    [[50, 100], [350, 100], [350, 170], [60, 170], [60, 240], [340, 240], [340, 310], [70, 310], [70, 380], [330, 380], [330, 450], [80, 450], [80, 530], [340, 540]],
  ],
  // 每關的場景：名稱、水色（上→下）、沙、石頭、危險水域的暗度、掠食者數量
  scenes: [
    { name: '淺水溪流', top: '#8fd8ec', bot: '#2f86ad', sand: '#e9d6a6', rock: '#6f7f6c', dark: .34, pike: 2, jelly: 1, urchin: 2, eel: 0, coral: 0 },
    { name: '珊瑚礁', top: '#5cc2df', bot: '#1b5d8e', sand: '#eccba0', rock: '#7d6070', dark: .42, pike: 3, jelly: 2, urchin: 3, eel: 1, coral: 1 },
    { name: '深海峽谷', top: '#2c6f9b', bot: '#081a36', sand: '#545a6c', rock: '#363c52', dark: .52, pike: 3, jelly: 3, urchin: 3, eel: 2, coral: 0, angler: 1 },
  ],
  credit: '第 17 攤 名不虛傳 GG 手',
};
let lv, pts, hw, pos, idx, holding, cp, buzz, time, touches, ang = 0, scn, preds = [], attack = null, layer = null, gotCP = new Set();
const R = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- 水道（平滑曲線）與距離
function smooth(p) {
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    for (let k = 0; k < 12; k++) {
      const t = k / 12, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(p.at(-1)); return out;
}
const segD = (x, y, i) => { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L)); return Math.hypot(x - ax - vx * t, y - ay - vy * t); };
function distAll(x, y) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segD(x, y, i)); return d; }
// 找離 (x,y) 最近的路段（只在目前位置附近找，不能抄捷徑跳到別段）
function nearest(x, y) { let best = { d: 1e9, i: idx }; for (let i = Math.max(0, idx - 6); i < Math.min(pts.length - 1, idx + 8); i++) { const d = segD(x, y, i); if (d < best.d) best = { d, i }; } return best; }
const CPS = () => [0, .33, .66].map((f) => Math.floor(f * (pts.length - 1)));

// ---------------------------------------------------------------- 場景：靜態背景先畫在一張大圖上（每關畫一次）
function buildLayer() {
  const c = document.createElement('canvas'); c.width = 800; c.height = 1200; const g = c.getContext('2d'); g.scale(2, 2);
  const s = scn;
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, s.top); grd.addColorStop(1, s.bot); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // 沙地與石頭、珊瑚
  g.fillStyle = s.sand; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 20) g.lineTo(x, 566 + Math.sin(x * .05) * 8); g.lineTo(W, H); g.fill();
  for (let i = 0; i < 26; i++) { const x = R(0, W), y = R(70, 590); if (distAll(x, y) < hw + 22) continue; g.fillStyle = s.rock; g.globalAlpha = .55; g.beginPath(); g.ellipse(x, y, R(10, 26), R(7, 16), R(0, 3), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
  if (s.coral) for (let i = 0; i < 9; i++) { const x = R(10, 390), y = R(90, 590); if (distAll(x, y) < hw + 30) continue; coral(g, x, y, ['#ff7a8a', '#ffb347', '#c77dff', '#ff5d8f'][i % 4]); }
  // 危險水域變暗（水道挖空）
  const d = document.createElement('canvas'); d.width = 800; d.height = 1200; const dg = d.getContext('2d'); dg.scale(2, 2);
  dg.fillStyle = `rgba(2,10,30,${s.dark})`; dg.fillRect(0, 0, W, H);
  dg.globalCompositeOperation = 'destination-out'; stroke(dg, hw * 2 + 10, '#000'); dg.globalCompositeOperation = 'source-over';
  g.drawImage(d, 0, 0, W, H);
  // 水道：亮一點的水＋兩岸的小石頭
  stroke(g, hw * 2, 'rgba(200,245,255,.22)'); stroke(g, hw * 2 - 10, 'rgba(255,255,255,.08)');
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
    for (let k = 0; k < L; k += 9) for (const sd of [1, -1]) {
      const x = ax + (bx - ax) * k / L + nx * sd * (hw + 4), y = ay + (by - ay) * k / L + ny * sd * (hw + 4);
      if (distAll(x, y) < hw + 1) continue;
      g.fillStyle = ['#8a8f8a', '#9c8f7a', '#6f7a7f', '#a8a090'][(i + k) % 4]; g.beginPath(); g.ellipse(x, y, R(3.5, 6), R(3, 5), R(0, 3), 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 1.4, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}
function stroke(g, w, color) { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
function coral(g, x, y, c) { g.strokeStyle = c; g.lineCap = 'round'; const br = (x0, y0, a, l, w) => { if (l < 5) return; const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); br(x1, y1, a - .45, l * .7, w * .75); br(x1, y1, a + .4, l * .7, w * .75); }; br(x, y, -Math.PI / 2, R(14, 20), 5); }

// ---------------------------------------------------------------- 掠食者：放在危險水域（離水道夠遠的地方）
function freeSpot(minD, maxD = 999, tries = 300) {
  const [ex, ey] = pts.at(-1), [bx, by] = pts[0];
  for (let i = 0; i < tries; i++) { const x = R(20, 380), y = R(80, 560), d = distAll(x, y); if (d > minD && d < maxD && Math.hypot(x - ex, y - ey) > 70 && Math.hypot(x - bx, y - by) > 60 && preds.every((p) => Math.hypot(p.x - x, p.y - y) > 55)) return { x, y }; }
  return null;
}
function spawnPreds() {
  preds = []; const s = scn;
  for (let i = 0; i < s.pike + (s.angler || 0); i++) {
    const angler = i >= s.pike; let best = null;
    for (let k = 0; k < 200 && !best; k++) {                                // 找一段左右都安全的巡邏路線
      const p = freeSpot(hw + 20); if (!p) break; let L = 0;
      for (let span = 20; span <= 90; span += 10) { if (distAll(p.x - span, p.y) > hw + 18 && distAll(p.x + span, p.y) > hw + 18 && p.x - span > 10 && p.x + span < 390) L = span; else break; }
      if (L >= 30) best = { ...p, L };
    }
    if (!best) continue;
    preds.push({ kind: angler ? 'angler' : 'pike', x: best.x, y: best.y, hx: best.x, hy: best.y, L: best.L, dir: Math.random() < .5 ? -1 : 1, len: angler ? 54 : R(70, 92), face: 0, hunt: 0, open: 0, ph: R(0, 6) });
  }
  for (let i = 0; i < s.jelly; i++) { const p = freeSpot(hw + 28); if (p) preds.push({ kind: 'jelly', x: p.x, y: p.y, hy: p.y, ph: R(0, 6), c: ['#ff9ad5', '#b49cff', '#7fe3ff'][i % 3] }); }
  for (let i = 0; i < s.urchin; i++) { const p = freeSpot(hw + 14, hw + 40); if (p) preds.push({ kind: 'urchin', x: p.x, y: p.y, ph: R(0, 6) }); }
  for (let i = 0; i < s.eel; i++) { const p = freeSpot(hw + 22, hw + 46); if (p) { const n = nearestAll(p.x, p.y); preds.push({ kind: 'eel', x: p.x, y: p.y, a: Math.atan2(n.y - p.y, n.x - p.x), peek: 0, ph: R(0, 6) }); } }
}
function nearestAll(x, y) { let b = { d: 1e9, x, y }; for (const [px, py] of pts) { const d = Math.hypot(px - x, py - y); if (d < b.d) b = { d, x: px, y: py }; } return b; }

// ---------------------------------------------------------------- 關卡
function load(i) {
  lv = i; scn = CONFIG.scenes[i]; pts = smooth(CONFIG.paths[i]); hw = CONFIG.widths[i]; idx = 0; cp = 0; gotCP = new Set([0]);
  pos = { x: pts[0][0], y: pts[0][1] }; holding = false; attack = null; ang = Math.atan2(pts[3][1] - pts[0][1], pts[3][0] - pts[0][0]);
  layer = buildLayer(); spawnPreds();
}
function start() { time = 0; touches = 0; buzz = 0; load(0); LIYU.toast(`第 1 關：${scn.name}`); }

LIYU.on('down', (x, y) => { if (LIYU.running && !buzz && Math.hypot(x - pos.x, y - pos.y) < 36) { holding = true; LIYU.sfx('tap'); } });
LIYU.on('up', () => { holding = false; });
LIYU.on('move', (x, y, e, held) => {
  if (!holding || !held || buzz || !LIYU.running) return;
  const dx = x - pos.x, dy = y - pos.y, d = Math.hypot(dx, dy), k = d > 14 ? 14 / d : 1;   // 一次最多游 14 像素
  const nx = pos.x + dx * k, ny = pos.y + dy * k, n = nearest(nx, ny);
  if (d > 1.5) { const a = Math.atan2(dy, dx); ang += Math.atan2(Math.sin(a - ang), Math.cos(a - ang)) * .35; }
  if (n.d > hw - 6) { pos.x = nx; pos.y = ny; return caught(); }
  pos.x = nx; pos.y = ny; idx = n.i;
  for (const c of CPS()) if (idx >= c && c > cp) { cp = c; gotCP.add(c); LIYU.sfx('pop'); LIYU.toast('🐚 珍珠貝殼：存檔！'); }
  if (idx >= pts.length - 3 && Math.hypot(pos.x - pts.at(-1)[0], pos.y - pts.at(-1)[1]) < hw) {
    holding = false; LIYU.sfx('win'); if (lv === 0) LIYU.clear();
    if (lv < CONFIG.paths.length - 1) { LIYU.toast(`🏠 回到家了！下一關：${CONFIG.scenes[lv + 1].name}`, 2000); setTimeout(() => LIYU.running && load(lv + 1), 1100); }
    else LIYU.finish({ score: Math.round(time), higher: false, lines: ['3 關全部游完！你是穩穩手 👑', `花了 ${Math.round(time)} 秒・被攻擊 ${touches} 次`] });
  }
});
// 碰到邊：最近的掠食者發動攻擊
function caught() {
  holding = false; touches++; buzz = 1.1;
  let who = null, bd = 1e9; for (const p of preds) { const d = Math.hypot(p.x - pos.x, p.y - pos.y) * (p.kind === 'pike' || p.kind === 'angler' ? .6 : 1); if (d < bd) { bd = d; who = p; } }
  attack = { who, t: 0, x: pos.x, y: pos.y, sx: who ? who.x : pos.x, sy: who ? who.y : pos.y };
  const say = !who ? '碰到石頭了！' : who.kind === 'jelly' ? '⚡ 被水母電到了！' : who.kind === 'urchin' ? '🦔 被海膽刺到了！' : who.kind === 'eel' ? '🐍 被海鱔咬到了！' : who.kind === 'angler' ? '🔦 被燈籠魚吞掉了！' : '🦈 被大魚咬到了！';
  LIYU.sfx('bump'); setTimeout(() => LIYU.sfx('miss'), 120); LIYU.toast(`${say}回到珍珠貝殼`, 1600);
}

// ---------------------------------------------------------------- 畫：掠食者
function drawPike(p, now) {
  const L = p.len, eyeRed = p.hunt > .3, open = Math.max(p.open, eyeRed ? .25 + Math.sin(now * 10) * .1 : 0);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.face); if (Math.cos(p.face) < 0) { ctx.scale(1, -1); }
  const sw = Math.sin(now * 6 + p.ph) * .25;
  ctx.fillStyle = '#3f5a4a'; ctx.beginPath(); ctx.moveTo(-L * .45, 0); ctx.lineTo(-L * .72, -L * .2 + sw * 8); ctx.lineTo(-L * .68, 0); ctx.lineTo(-L * .72, L * .2 + sw * 8); ctx.closePath(); ctx.fill();        // 尾巴
  ctx.beginPath(); ctx.moveTo(-L * .1, -L * .14); ctx.lineTo(-L * .25, -L * .3); ctx.lineTo(-L * .32, -L * .12); ctx.fill();                                                                          // 背鰭
  const g = ctx.createLinearGradient(0, -L * .18, 0, L * .18); g.addColorStop(0, '#2f4a3c'); g.addColorStop(.6, '#5d7f62'); g.addColorStop(1, '#c9d6b0');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, L * .5, L * .17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,40,25,.45)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-L * .3 + i * L * .1, -L * .06 + (i % 2) * L * .05, L * .03, L * .02, 0, 0, Math.PI * 2); ctx.fill(); }
  // 嘴：張開時露出牙齒
  ctx.fillStyle = '#2a0d0d'; ctx.beginPath(); ctx.moveTo(L * .5, 0); ctx.lineTo(L * .3, -L * .02 - open * L * .12); ctx.lineTo(L * .3, L * .02 + open * L * .12); ctx.closePath(); ctx.fill();
  if (open > .1) { ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const x = L * .33 + i * L * .04; ctx.beginPath(); ctx.moveTo(x, -open * L * .1); ctx.lineTo(x + L * .015, -open * L * .04); ctx.lineTo(x + L * .03, -open * L * .1); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, open * L * .1); ctx.lineTo(x + L * .015, open * L * .04); ctx.lineTo(x + L * .03, open * L * .1); ctx.fill(); } }
  ctx.fillStyle = eyeRed ? '#ff2a2a' : '#ffe680'; ctx.beginPath(); ctx.arc(L * .3, -L * .07, L * .045, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * .31, -L * .07, L * .022, 0, Math.PI * 2); ctx.fill();
  if (eyeRed) { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L * .24, -L * .14); ctx.lineTo(L * .36, -L * .1); ctx.stroke(); }   // 生氣的眉毛
  ctx.restore();
}
function drawAngler(p, now) {
  const L = p.len, open = Math.max(p.open, .3 + Math.sin(now * 3) * .1);
  ctx.save(); ctx.translate(p.x, p.y); if (Math.cos(p.face) < 0) ctx.scale(-1, 1);
  const gl = ctx.createRadialGradient(L * .55, -L * .55, 1, L * .55, -L * .55, 26); gl.addColorStop(0, 'rgba(255,250,180,.95)'); gl.addColorStop(1, 'rgba(255,250,180,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(L * .55, -L * .55, 26, 0, Math.PI * 2); ctx.fill();   // 誘餌燈
  ctx.strokeStyle = '#2a2f40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -L * .4); ctx.quadraticCurveTo(L * .2, -L * .8, L * .55, -L * .55); ctx.stroke();
  ctx.fillStyle = '#fffbc8'; ctx.beginPath(); ctx.arc(L * .55, -L * .55, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2f40'; ctx.beginPath(); ctx.moveTo(-L * .4, 0); ctx.lineTo(-L * .7, -L * .25); ctx.lineTo(-L * .7, L * .25); ctx.fill();
  ctx.fillStyle = '#3a4058'; ctx.beginPath(); ctx.arc(0, 0, L * .45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#12131c'; ctx.beginPath(); ctx.moveTo(L * .45, -open * L * .3); ctx.lineTo(L * .05, 0); ctx.lineTo(L * .45, open * L * .3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const yy = -open * L * .28 + i * open * L * .18; ctx.beginPath(); ctx.moveTo(L * .45, yy); ctx.lineTo(L * .3, yy + 3); ctx.lineTo(L * .45, yy + 6); ctx.fill(); }
  ctx.fillStyle = p.hunt > .3 ? '#ff2a2a' : '#ffe680'; ctx.beginPath(); ctx.arc(L * .12, -L * .2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawJelly(p, now) {
  const y = p.y, pulse = Math.sin(now * 3 + p.ph);
  ctx.save(); ctx.translate(p.x, y);
  ctx.strokeStyle = p.c; ctx.globalAlpha = .7; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5, 4); for (let k = 1; k <= 6; k++) ctx.lineTo(i * 5 + Math.sin(now * 4 + k + i + p.ph) * 4, 4 + k * 6); ctx.stroke(); }
  const g = ctx.createRadialGradient(0, -4, 2, 0, -2, 20); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, p.c);
  ctx.globalAlpha = .85; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 16 + pulse * 2, 13 - pulse * 2, 0, Math.PI, 0); ctx.fill();
  if (p.zap > 0 && attack) { ctx.globalAlpha = 1; ctx.strokeStyle = '#fff36a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); for (let k = 1; k <= 5; k++) ctx.lineTo((attack.x - p.x) * k / 5 + R(-6, 6), (attack.y - y) * k / 5 + R(-6, 6)); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawUrchin(p, now) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(now + p.ph) * .08);
  ctx.strokeStyle = '#1b1530'; ctx.lineWidth = 2; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, l = 14 + (i % 2) * 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); }
  ctx.fillStyle = '#3a2350'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawEel(p, now) {
  const out = p.peek;                                                      // 0＝縮在洞裡，1＝伸出來
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#0d0f18'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 10, p.a, 0, Math.PI * 2); ctx.fill();   // 石縫
  ctx.rotate(p.a);
  const len = 6 + out * 26 + (attack && attack.who === p ? 18 : 0);
  ctx.fillStyle = '#7d8a2e'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(len * .5, -9 + Math.sin(now * 5) * 2, len, -6); ctx.lineTo(len + 8, 0); ctx.lineTo(len, 6); ctx.quadraticCurveTo(len * .5, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#c9d27a'; for (let i = 4; i < len; i += 7) { ctx.beginPath(); ctx.arc(i, -2, 1.5, 0, Math.PI * 2); ctx.fill(); }
  const mo = out > .7 ? Math.abs(Math.sin(now * 6)) * 4 : 0; ctx.fillStyle = '#2a0d0d'; ctx.beginPath(); ctx.moveTo(len + 8, 0); ctx.lineTo(len, -mo); ctx.lineTo(len, mo); ctx.fill();
  ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(len - 1, -3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// 主角小鯉魚
function drawKoi(x, y, a, r, now, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(a);
  const L = r * 2.4, sw = Math.sin(now * (holding ? 14 : 6)) * .35;
  ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.moveTo(-L * .35, 0); ctx.lineTo(-L * .62, -L * .2 + sw * 5); ctx.lineTo(-L * .55, 0); ctx.lineTo(-L * .62, L * .2 + sw * 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.ellipse(0, 0, L * .4, L * .2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff4e6'; ctx.beginPath(); ctx.ellipse(-L * .05, -L * .03, L * .14, L * .1, .3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8473f'; ctx.beginPath(); ctx.ellipse(L * .18, -L * .05, L * .1, L * .07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(L * .27, -L * .06, L * .055, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * .285, -L * .06, L * .03, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd2a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L * .38, L * .05); ctx.lineTo(L * .46, L * .12); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- 環境：光束、氣泡、水草
const bubbles = Array.from({ length: 28 }, () => ({ x: R(0, W), y: R(0, H), r: R(1.5, 4), v: R(18, 40) }));
const trail = [];
function ambient(dt, now) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) { const x = 60 + i * 95 + Math.sin(now * .4 + i) * 25; ctx.fillStyle = `rgba(255,255,255,${.035 + (lv === 2 ? -.015 : 0)})`; ctx.beginPath(); ctx.moveTo(x - 18, 0); ctx.lineTo(x + 18, 0); ctx.lineTo(x + 70, H); ctx.lineTo(x - 10, H); ctx.fill(); }
  ctx.restore();
  for (const b of bubbles) { b.y -= b.v * dt; b.x += Math.sin(now * 2 + b.r) * .2; if (b.y < -5) { b.y = H + 5; b.x = R(0, W); } ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 9; i++) {                                            // 底部水草
    const x = 14 + i * 46, h = 30 + (i % 3) * 12; ctx.strokeStyle = ['#3f8f4a', '#2f7a44', '#5aa65a'][i % 3]; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const o of [-5, 5]) { ctx.beginPath(); ctx.moveTo(x + o, H); for (let k = 1; k <= 5; k++) ctx.lineTo(x + o + Math.sin(now * 1.5 + k * .8 + i) * k * 1.6, H - h * k / 5); ctx.stroke(); }
  }
  for (const t of trail) { t.y -= 22 * dt; t.life -= dt; ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, t.life)})`; ctx.beginPath(); ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2); ctx.stroke(); }
  while (trail.length && trail[0].life <= 0) trail.shift();
}

// ---------------------------------------------------------------- 每一格
function updatePreds(dt, now) {
  const n = LIYU.running && !buzz ? nearest(pos.x, pos.y) : { d: 0 }, edge = n.d / (hw - 6);   // 0＝在水道中間，1＝碰到邊
  for (const p of preds) {
    if (p.kind === 'pike' || p.kind === 'angler') {
      const dp = Math.hypot(pos.x - p.x, pos.y - p.y), alert = edge > .55 && dp < 150;
      p.hunt += ((alert ? 1 : 0) - p.hunt) * Math.min(1, dt * 4); p.open = Math.max(0, p.open - dt * 2);
      let tx, ty;
      if (p.hunt > .3) { tx = pos.x; ty = pos.y; } else { tx = p.hx + p.dir * p.L; ty = p.hy + Math.sin(now + p.ph) * 6; if (Math.abs(p.x - tx) < 4) p.dir *= -1; }
      const sp = (p.hunt > .3 ? 40 : 28) * (p.kind === 'angler' ? .6 : 1), dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
      const nx = p.x + dx / d * sp * dt, ny = p.y + dy / d * sp * dt;
      if (distAll(nx, ny) > hw + 15) { p.x = nx; p.y = ny; }                 // 牠們進不了安全水道
      const fa = Math.atan2(dy, dx); p.face += Math.atan2(Math.sin(fa - p.face), Math.cos(fa - p.face)) * Math.min(1, dt * 4);
    } else if (p.kind === 'jelly') { p.y = p.hy + Math.sin(now * .8 + p.ph) * 10; if (p.zap) p.zap = Math.max(0, p.zap - dt); }
    else if (p.kind === 'eel') { const near = Math.hypot(pos.x - p.x, pos.y - p.y) < 90 && edge > .4; const want = near ? 1 : (Math.sin(now * .9 + p.ph) > .6 ? .6 : 0); p.peek += (want - p.peek) * Math.min(1, dt * 3); }
  }
  return edge;
}
LIYU.loop((dt, now) => {
  if (!pts) { load(0); }                                                    // 開始畫面也看得到場景
  ctx.drawImage(layer, 0, 0, W, H);
  ambient(dt, now);
  // 水道中間的水流（虛線慢慢往前流）
  ctx.save(); ctx.setLineDash([6, 14]); ctx.lineDashOffset = -now * 18; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
  if (LIYU.running) { time += dt; if (buzz > 0 && (buzz -= dt) <= 0) { buzz = 0; if (attack && attack.who && attack.who.hx != null) { attack.who.x = attack.sx; attack.who.y = attack.sy; attack.who.hunt = 0; } attack = null; idx = cp; pos = { x: pts[cp][0], y: pts[cp][1] }; } }
  const edge = updatePreds(dt, now);
  // 起點、珍珠貝殼（檢查點）、家
  const [sx, sy] = pts[0]; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([3, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, hw * .9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  for (const c of CPS()) if (c) {
    const [x, y] = pts[c], got = gotCP.has(c);
    ctx.fillStyle = '#f3d3c0'; ctx.beginPath(); ctx.arc(x, y + 4, 10, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#c99a86'; ctx.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + k * 4.5, y - 5); ctx.stroke(); }
    const g = ctx.createRadialGradient(x, y + 1, 0, x, y + 1, got ? 16 : 7); g.addColorStop(0, '#ffffff'); g.addColorStop(1, got ? 'rgba(255,240,255,0)' : 'rgba(230,230,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 1, got ? 16 : 7, 0, Math.PI * 2); ctx.fill();
  }
  const [gx, gy] = pts.at(-1);
  ctx.fillStyle = scn.rock; ctx.beginPath(); ctx.arc(gx, gy + 6, hw + 12, Math.PI, 0); ctx.fill();
  const hg = ctx.createRadialGradient(gx, gy, 2, gx, gy, hw + 4); hg.addColorStop(0, '#ffe7a8'); hg.addColorStop(1, '#5a3a1a'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(gx, gy + 6, hw + 2, Math.PI, 0); ctx.fill();
  LIYU.text('家', gx, gy - hw - 18, { size: 15, color: '#fff' }); LIYU.text('🏠', gx, gy - hw - 34, { size: 14 });
  // 掠食者（攻擊時衝過來）
  if (attack && attack.who) {
    attack.t += dt; const w = attack.who, k = Math.min(1, attack.t / .22);
    if (w.kind === 'pike' || w.kind === 'angler') { w.x = attack.sx + (attack.x - attack.sx) * k; w.y = attack.sy + (attack.y - attack.sy) * k; w.open = 1; w.face = Math.atan2(attack.y - attack.sy, attack.x - attack.sx); w.hunt = 1; }
    if (w.kind === 'jelly') w.zap = .3; if (w.kind === 'eel') w.peek = 1;
  }
  for (const p of preds) ({ pike: drawPike, angler: drawAngler, jelly: drawJelly, urchin: drawUrchin, eel: drawEel })[p.kind](p, now);
  // 小鯉魚
  const r = Math.max(8, hw - 8);
  if (holding && Math.random() < dt * 8) trail.push({ x: pos.x - Math.cos(ang) * r, y: pos.y - Math.sin(ang) * r, life: .8 });
  if (buzz > 0) { const eaten = attack && attack.who && ['pike', 'angler', 'eel'].includes(attack.who.kind); if (!eaten || attack.t < .22) drawKoi(pos.x, pos.y, ang + Math.sin(now * 40) * .5, r, now, Math.sin(now * 25) > 0 ? .9 : .35); }
  else {
    if (holding) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2); ctx.stroke(); }
    drawKoi(pos.x, pos.y, ang, r, now);
    if (!holding && LIYU.running) { LIYU.rrect(pos.x - 32, pos.y - r - 34, 64, 22, 11, 'rgba(255,255,255,.85)'); LIYU.text('按住我', pos.x, pos.y - r - 23, { size: 13, color: '#b34a10' }); }
  }
  // 危險感：越靠近邊緣，四周越紅；被攻擊時閃一下
  const dang = buzz > 0 ? .45 + Math.sin(now * 30) * .15 : Math.max(0, (edge - .55) / .45) * .35;
  if (dang > 0) { const vg = ctx.createRadialGradient(200, 300, 150, 200, 300, 380); vg.addColorStop(0, 'rgba(255,0,0,0)'); vg.addColorStop(1, `rgba(220,20,20,${dang})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
  if (buzz > .6 && attack && attack.who && (attack.who.kind === 'pike' || attack.who.kind === 'angler')) LIYU.text('咬！', attack.x, attack.y - 30, { size: 34, color: '#fff', weight: 900 });
  // HUD
  LIYU.rrect(8, 8, 384, 42, 14, 'rgba(255,255,255,.82)');
  LIYU.text(`第 ${lv + 1}／3 關・${scn.name}`, 20, 30, { align: 'left', size: 16 });
  LIYU.text(`⏱ ${Math.floor(time || 0)}・被攻擊 ${touches || 0} 次`, W - 20, 30, { align: 'right', size: 14 });
});
LIYU.peek = () => ({ pts, pos, idx, lv, preds });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
