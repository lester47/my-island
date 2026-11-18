// 第 06 攤・巧手工坊／自己畫貼紙 DIY：在圓形空白貼紙上畫畫，按「完成」存成圖片
import { LIYU } from '../_kit/kit.js?v=20261118t';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 6, title: '自己畫貼紙', stall: '巧手工坊／自己畫貼紙 DIY',
  how: ['在圓形貼紙上用手指（或滑鼠）畫畫', '下面選顏色、筆的粗細，也有橡皮擦', '畫好按「✅ 完成」，貼紙會存成圖片', '現場也可以畫一張真的貼紙帶回家！'],
  clear: '畫好一張貼紙，按「完成」',
  colors: ['#2a1d12', '#e8473f', '#e8762b', '#ffd23a', '#5ec26a', '#2f7fd1', '#8a5cd0', '#ff7aa8'],
  credit: '第 06 攤 巧手工坊／自己畫貼紙 DIY',
};
const CX = 200, CY = 245, R = 165;
const paper = document.createElement('canvas'); paper.width = 400; paper.height = 600; const pc = paper.getContext('2d');   // 畫的內容另外存一層
let color, size, eraser, last, strokes, ready = false;
const SIZES = [4, 9, 16];
function start() { color = CONFIG.colors[0]; size = SIZES[1]; eraser = false; last = null; strokes = 0; pc.clearRect(0, 0, 400, 600); ready = true; }
// 下方的工具列位置
const UI = {
  colors: CONFIG.colors.map((c, i) => ({ c, x: 32 + i * 48, y: 450 })),
  sizes: SIZES.map((s, i) => ({ s, x: 40 + i * 52, y: 506 })),
  eraser: { x: 210, y: 506 }, clear: { x: 282, y: 506 }, done: { x: 200, y: 562 },
};
const near = (x, y, o, r = 22) => Math.hypot(x - o.x, y - o.y) < r;
function inPaper(x, y) { return Math.hypot(x - CX, y - CY) < R; }
function line(a, b) {
  pc.save(); pc.beginPath(); pc.arc(CX, CY, R, 0, Math.PI * 2); pc.clip();
  pc.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
  pc.strokeStyle = color; pc.lineWidth = eraser ? size * 2 : size; pc.lineCap = 'round'; pc.lineJoin = 'round';
  pc.beginPath(); pc.moveTo(a.x, a.y); pc.lineTo(b.x, b.y); pc.stroke(); pc.restore();
}
LIYU.on('down', (x, y) => {
  if (!LIYU.running) return;
  const c = UI.colors.find((o) => near(x, y, o)); if (c) { color = c.c; eraser = false; LIYU.sfx('tap'); return; }
  const s = UI.sizes.find((o) => near(x, y, o)); if (s) { size = s.s; LIYU.sfx('tap'); return; }
  if (near(x, y, UI.eraser, 26)) { eraser = !eraser; LIYU.sfx('tap'); return; }
  if (near(x, y, UI.clear, 30)) { pc.clearRect(0, 0, 400, 600); strokes = 0; LIYU.sfx('pop'); return; }
  if (Math.abs(x - UI.done.x) < 90 && Math.abs(y - UI.done.y) < 22) return finish();
  if (inPaper(x, y)) { last = { x, y }; line(last, { x: x + .1, y }); strokes++; }
});
LIYU.on('move', (x, y, e, held) => { if (held && last) { const p = { x, y }; line(last, p); last = p; } });
LIYU.on('up', () => { last = null; });
function finish() {
  if (strokes === 0) { LIYU.toast('先在貼紙上畫一點東西吧！'); return; }
  draw(true); LIYU.save(`我的貼紙-${Date.now()}`); LIYU.clear();
  LIYU.finish({ win: true, lines: ['🎨 你的貼紙完成了！', '已經存成圖片（在「下載」裡找得到）'] });
}
function draw(clean) {
  LIYU.bg('#fdf3e3');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.15)'; ctx.shadowBlur = 12; LIYU.circle(CX, CY, R + 6, '#ffffff'); ctx.restore();
  LIYU.circle(CX, CY, R, '#ffffff', '#e8d6bd', 2);
  ctx.drawImage(paper, 0, 0, 400, 600);
  if (clean) return;
  UI.colors.forEach((o) => LIYU.circle(o.x, o.y, 17, o.c, !eraser && color === o.c ? '#e8762b' : '#fff', !eraser && color === o.c ? 5 : 3));
  UI.sizes.forEach((o) => { LIYU.circle(o.x, o.y, 21, '#fff', size === o.s ? '#e8762b' : '#d8c8b0', 3); LIYU.circle(o.x, o.y, o.s / 2 + 1, eraser ? '#bbb' : color); });
  LIYU.rrect(UI.eraser.x - 32, UI.eraser.y - 20, 64, 40, 12, eraser ? '#e8762b' : '#fff', '#d8c8b0', 2); LIYU.text('橡皮擦', UI.eraser.x, UI.eraser.y + 1, { size: 14, color: eraser ? '#fff' : '#7a4a22' });
  LIYU.rrect(UI.clear.x - 32, UI.clear.y - 20, 64, 40, 12, '#fff', '#d8c8b0', 2); LIYU.text('全部清掉', UI.clear.x, UI.clear.y + 1, { size: 13, color: '#7a4a22' });
  LIYU.rrect(UI.done.x - 90, UI.done.y - 22, 180, 44, 22, '#e8762b'); LIYU.text('✅ 完成', UI.done.x, UI.done.y + 1, { size: 20, color: '#fff' });
}
LIYU.loop(() => {
  if (!ready) { LIYU.bg('#fdf3e3'); LIYU.text('🖍️', 200, 280, { size: 80 }); return; }
  draw(false);
  if (strokes === 0) LIYU.text('在圓圈裡畫畫 ✏️', CX, CY, { size: 20, color: '#c9b79c' });
});
LIYU.setup({ ...CONFIG, start });
