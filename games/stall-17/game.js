// 第 17 攤・名不虛傳 GG 手：穩穩手挑戰（電流急急棒）——拖著小圈圈沿著彎彎的鐵絲走到終點，碰到邊就回上一個檢查點
import { LIYU } from '../_kit/kit.js?v=20261118t';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 17, title: '穩穩手挑戰', stall: '名不虛傳 GG 手',
  how: ['按住綠色起點的小圈圈，沿著鐵絲慢慢拖到紅色終點', '圈圈碰到黃色邊界就「嗶！」，回到上一個 🚩 檢查點', '手指放開沒關係，再按住圈圈就能繼續', '一共 3 關，越後面路越窄'],
  clear: '走完第 1 關（手部挑戰成功）',
  widths: [26, 19, 14],                                                        // 每關路的半寬（越小越難）
  paths: [
    [[60, 120], [340, 120], [340, 230], [80, 230], [80, 340], [320, 340], [320, 460], [120, 460], [200, 540]],
    [[50, 110], [200, 160], [350, 110], [330, 250], [180, 210], [70, 290], [200, 360], [340, 330], [300, 470], [140, 430], [80, 540], [330, 545]],
    [[50, 100], [350, 100], [350, 170], [60, 170], [60, 240], [340, 240], [340, 310], [70, 310], [70, 380], [330, 380], [330, 450], [80, 450], [80, 530], [340, 540]],
  ],
  credit: '第 17 攤 名不虛傳 GG 手',
};
let lv, pts, hw, pos, idx, holding, cp, buzz, time, touches;
// 把轉角點變成平滑的曲線點
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
function load(i) { lv = i; pts = smooth(CONFIG.paths[i]); hw = CONFIG.widths[i]; idx = 0; cp = 0; pos = { x: pts[0][0], y: pts[0][1] }; holding = false; }
function start() { time = 0; touches = 0; buzz = 0; load(0); }
// 找離 (x,y) 最近的路段（只在目前位置附近找，不能抄捷徑跳到別段）
function nearest(x, y) {
  let best = { d: 1e9, i: idx };
  for (let i = Math.max(0, idx - 6); i < Math.min(pts.length - 1, idx + 8); i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L)), d = Math.hypot(x - ax - vx * t, y - ay - vy * t);
    if (d < best.d) best = { d, i };
  }
  return best;
}
const CPS = () => [0, .33, .66].map((f) => Math.floor(f * (pts.length - 1)));
LIYU.on('down', (x, y) => { if (LIYU.running && !buzz && Math.hypot(x - pos.x, y - pos.y) < 34) { holding = true; LIYU.sfx('tap'); } });
LIYU.on('up', () => { holding = false; });
LIYU.on('move', (x, y, e, held) => {
  if (!holding || !held || buzz || !LIYU.running) return;
  // 一次最多移動 14 像素，避免手指一甩就跳過去
  const dx = x - pos.x, dy = y - pos.y, d = Math.hypot(dx, dy), k = d > 14 ? 14 / d : 1;
  const nx = pos.x + dx * k, ny = pos.y + dy * k, n = nearest(nx, ny);
  if (n.d > hw - 6) { buzz = .7; holding = false; touches++; LIYU.sfx('miss'); LIYU.toast('嗶！碰到了，回到檢查點'); return; }
  pos.x = nx; pos.y = ny; idx = n.i;
  for (const c of CPS()) if (idx >= c && c > cp) { cp = c; LIYU.sfx('tap'); }
  if (idx >= pts.length - 3 && Math.hypot(pos.x - pts.at(-1)[0], pos.y - pts.at(-1)[1]) < hw) {
    holding = false; LIYU.sfx('win'); if (lv === 0) LIYU.clear();
    if (lv < CONFIG.paths.length - 1) { LIYU.toast(`第 ${lv + 1} 關完成！`); setTimeout(() => LIYU.running && load(lv + 1), 900); }
    else LIYU.finish({ score: Math.round(time), higher: false, lines: ['3 關全部完成！你是穩穩手 👑', `花了 ${Math.round(time)} 秒・碰到 ${touches} 次`] });
  }
});
function drawPath(w, color) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
LIYU.loop((dt, now) => {
  LIYU.bg(buzz > 0 && Math.sin(now * 40) > 0 ? '#ffe0e0' : '#f1efe8');
  if (!pts) { LIYU.text('〰️ 穩穩手 〰️', 200, 300, { size: 34 }); return; }
  if (LIYU.running) { time += dt; if (buzz > 0 && (buzz -= dt) <= 0) { buzz = 0; idx = cp; pos = { x: pts[cp][0], y: pts[cp][1] }; } }
  drawPath(hw * 2 + 6, '#e3b23b'); drawPath(hw * 2, '#fff8e8'); drawPath(3, '#9aa3ad');
  for (const c of CPS()) if (c) LIYU.text('🚩', pts[c][0] + 4, pts[c][1] - hw - 8, { size: 18 });
  LIYU.circle(pts[0][0], pts[0][1], hw * .9, 'rgba(124,197,118,.4)');
  LIYU.circle(pts.at(-1)[0], pts.at(-1)[1], hw * .9, 'rgba(232,71,63,.35)', '#e8473f', 2); LIYU.text('終點', pts.at(-1)[0], pts.at(-1)[1], { size: 13, color: '#b3263a' });
  const r = Math.max(8, hw - 8);
  LIYU.circle(pos.x, pos.y, r, holding ? 'rgba(232,118,43,.35)' : 'rgba(232,118,43,.15)', buzz ? '#e8473f' : '#e8762b', 4);
  if (!holding && !buzz && LIYU.running) LIYU.text('按住我', pos.x, pos.y - r - 14, { size: 13, color: '#b34a10' });
  LIYU.text(`第 ${lv + 1}／3 關`, 16, 30, { align: 'left', size: 18 });
  LIYU.text(`⏱ ${Math.floor(time)}・碰 ${touches} 次`, W - 16, 30, { align: 'right', size: 16 });
});
LIYU.peek = () => ({ pts, pos, idx, lv });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
