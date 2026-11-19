// 第 16 攤・聖誕 DIY 製造所：把彩球、星星、蝴蝶結拖到聖誕樹上裝飾，按「完成」存成圖片
import { LIYU } from '../_kit/kit.js?v=20261119g';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 16, title: '裝飾聖誕樹', stall: '聖誕 DIY 製造所',
  how: ['從下面拖一個裝飾放到聖誕樹上', '樹上的裝飾可以再拖去別的地方，拖出樹外就拿掉', '「💡 燈串」可以開關閃閃的燈', '裝飾好按「✅ 完成」存成圖片'],
  clear: '裝飾一棵聖誕樹，按「完成」',
  items: ['🔴', '🟡', '🔵', '🟣', '⭐', '🎀', '🔔', '🍬', '❄️', '🎁', '🐟'],    // 🐟 是鯉魚市集限定裝飾
  credit: '第 16 攤 聖誕 DIY 製造所',
};
const TREE = [[200, 70], [330, 420], [70, 420]];              // 三角形樹
let placed, drag, lights, ready = false, snow;
function start() { placed = []; drag = null; lights = true; ready = true; snow = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 30 })); }
const TRAY = CONFIG.items.map((s, i) => ({ s, x: 30 + (i % 6) * 68, y: 478 + Math.floor(i / 6) * 46 }));
const LIGHT = { x: 70, y: 566 }, DONE = { x: 270, y: 566 };
function onTree(x, y) {
  if (y > 420 && y < 470 && Math.abs(x - 200) < 22) return true;            // 樹幹
  const [a, b, c] = TREE, s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const P = [x, y], d1 = s(P, a, b), d2 = s(P, b, c), d3 = s(P, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
LIYU.on('down', (x, y) => {
  if (!LIYU.running) return;
  if (Math.abs(x - LIGHT.x) < 60 && Math.abs(y - LIGHT.y) < 20) { lights = !lights; LIYU.sfx('tap'); return; }
  if (Math.abs(x - DONE.x) < 90 && Math.abs(y - DONE.y) < 22) return finish();
  for (let i = placed.length - 1; i >= 0; i--) if (Math.hypot(x - placed[i].x, y - placed[i].y) < 22) { drag = placed.splice(i, 1)[0]; drag.x = x; drag.y = y; return; }
  const t = TRAY.find((o) => Math.hypot(x - o.x, y - o.y) < 22); if (t) { drag = { s: t.s, x, y }; LIYU.sfx('tap'); }
});
LIYU.on('move', (x, y) => { if (drag) { drag.x = x; drag.y = y; } });
LIYU.on('up', (x, y) => {
  if (!drag) return;
  if (onTree(x, y)) { placed.push({ s: drag.s, x, y }); LIYU.sfx('pop'); } else LIYU.sfx('bump');
  drag = null;
});
function finish() {
  if (placed.length < 3) { LIYU.toast('再多掛幾個裝飾吧！（至少 3 個）'); return; }
  draw(true, 0); LIYU.save(`我的聖誕樹-${Date.now()}`); LIYU.clear(placed.length);
  LIYU.finish({ win: true, lines: [`🎄 掛了 ${placed.length} 個裝飾！`, '已經存成圖片（在「下載」裡找得到）'] });
}
function draw(clean, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d2b4a'); g.addColorStop(1, '#3b4f7a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const f of snow) LIYU.circle(f.x, f.y, 2, 'rgba(255,255,255,.7)');
  LIYU.rrect(0, 440, W, 160, 0, '#e8eef5');
  LIYU.rrect(180, 410, 40, 50, 6, '#7a4a22');
  for (const [k, c] of [[0, '#2f8a40'], [1, '#3a9e4c'], [2, '#46b058']]) {                       // 三層樹
    const top = 70 + k * 95, half = 70 + k * 45; ctx.beginPath(); ctx.moveTo(200, top); ctx.lineTo(200 + half + 20, top + 170); ctx.lineTo(200 - half - 20, top + 170); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
  }
  if (lights) for (let i = 0; i < 26; i++) { const k = i / 26, y = 110 + k * 300, w = 30 + k * 120, x = 200 + Math.sin(k * 22) * w; LIYU.circle(x, y, 4, ['#ffd23a', '#ff5d8f', '#7fd3ff', '#fff'][i % 4] + (Math.sin(t * 4 + i) > 0 ? '' : '66')); }
  for (const p of placed) LIYU.text(p.s, p.x, p.y, { size: 30 });
  if (clean) return;
  LIYU.rrect(0, 452, W, 148, 0, 'rgba(255,255,255,.9)');
  TRAY.forEach((o) => LIYU.text(o.s, o.x, o.y, { size: 30 }));
  LIYU.rrect(LIGHT.x - 60, LIGHT.y - 18, 120, 36, 18, lights ? '#ffd23a' : '#ddd'); LIYU.text(`💡 燈串 ${lights ? '開' : '關'}`, LIGHT.x, LIGHT.y + 1, { size: 15 });
  LIYU.rrect(DONE.x - 90, DONE.y - 22, 180, 44, 22, '#e8762b'); LIYU.text('✅ 完成', DONE.x, DONE.y + 1, { size: 20, color: '#fff' });
  if (drag) LIYU.text(drag.s, drag.x, drag.y, { size: 36 });
  if (!placed.length && !drag) LIYU.text('從下面拖裝飾到樹上 ↑', 200, 40, { size: 17, color: '#fff' });
}
LIYU.loop((dt, t) => {
  if (!ready) { LIYU.bg('#1d2b4a'); LIYU.text('🎄', 200, 280, { size: 90 }); return; }
  for (const f of snow) { f.y += f.v * dt; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } }
  draw(false, t);
});
LIYU.peek = () => ({ placed });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
