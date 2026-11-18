// 第 15 攤・夏來寶：鑽石貼紙畫——點格子貼上閃亮的鑽石，可以照著底圖貼，也可以自由創作
import { LIYU } from '../_kit/kit.js?v=20261118w';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 15, title: '鑽石貼紙畫', stall: '夏來寶',
  how: ['下方選顏色，點格子（或按住拖）貼上鑽石', '再點一次同顏色的鑽石可以拿掉', '可以選底圖照著貼：鯉魚、愛心、星星，或自由創作', '貼好按「✅ 完成」存成圖片'],
  clear: '貼好一幅鑽石畫，按「完成」',
  palette: ['#e8473f', '#ff9a3d', '#ffd23a', '#5ec26a', '#2f7fd1', '#8a5cd0', '#ff7aa8', '#ffffff', '#2a1d12', '#9aa3ad'],
  // 底圖（16×16）：字母對應上面的顏色（a=第 1 色、b=第 2 色…），. 是空白
  templates: {
    鯉魚: ['................', '................', '.....aa.........', '....aaaa........', '...ahahaa....aa.', '..ahhhaaaa..aaa.', '.ihhhhaaaaaaaa..', '.hhhhhhaaaaaa...', '.hhhhhhhaaaaa...', '..hhhhhhaaaaaaa.', '...hhhhhh....aa.', '....hhhh.....a..', '.....hh.........', '................', '................', '................'],
    愛心: ['................', '................', '...aaa....aaa...', '..aaaaa..aaaaa..', '.aahaaaaaaaaaaa.', '.ahhaaaaaaaaaaa.', '.aaaaaaaaaaaaaa.', '.aaaaaaaaaaaaaa.', '..aaaaaaaaaaaa..', '...aaaaaaaaaa...', '....aaaaaaaa....', '.....aaaaaa.....', '......aaaa......', '.......aa.......', '................', '................'],
    星星: ['................', '.......cc.......', '.......cc.......', '......cccc......', '......cccc......', 'cccccccccccccccc', '.cccccccccccccc.', '..cccccccccccc..', '...cccccccccc...', '...cccccccccc...', '..cccccc.ccccc..', '..ccccc...cccc..', '.cccc......cccc.', '.ccc........ccc.', '.cc..........cc.', '................'],
  },
  credit: '第 15 攤 夏來寶',
};
const N = 16, S = 22, OX = (W - N * S) / 2, OY = 76;
let grid, color, tmpl, painting, ready = false;
function start() { grid = Array.from({ length: N * N }, () => null); color = CONFIG.palette[0]; tmpl = '鯉魚'; painting = null; ready = true; }
const TB = Object.keys(CONFIG.templates).concat(['自由']).map((k, i) => ({ k, x: 48 + i * 88, y: 46 }));
const PAL = CONFIG.palette.map((c, i) => ({ c, x: 26 + (i % 10) * 38, y: 464 }));
const DONE = { x: 200, y: 556 }, CLR = { x: 200, y: 510 };
function cellAt(x, y) { const c = Math.floor((x - OX) / S), r = Math.floor((y - OY) / S); return c >= 0 && c < N && r >= 0 && r < N ? r * N + c : -1; }
function paint(i) { if (i < 0) return; if (painting === 'erase') { if (grid[i]) { grid[i] = null; LIYU.sfx('pop'); } } else if (grid[i] !== color) { grid[i] = color; LIYU.sfx('tap'); } }
LIYU.on('down', (x, y) => {
  if (!LIYU.running) return;
  const t = TB.find((o) => Math.abs(x - o.x) < 42 && Math.abs(y - o.y) < 18); if (t) { tmpl = t.k; LIYU.sfx('tap'); return; }
  const p = PAL.find((o) => Math.hypot(x - o.x, y - o.y) < 18); if (p) { color = p.c; LIYU.sfx('tap'); return; }
  if (Math.abs(x - CLR.x) < 60 && Math.abs(y - CLR.y) < 18) { grid.fill(null); LIYU.sfx('pop'); return; }
  if (Math.abs(x - DONE.x) < 90 && Math.abs(y - DONE.y) < 22) return finish();
  const i = cellAt(x, y); if (i < 0) return;
  painting = grid[i] === color ? 'erase' : 'paint'; paint(i);
});
LIYU.on('move', (x, y, e, held) => { if (held && painting) paint(cellAt(x, y)); });
LIYU.on('up', () => { painting = null; });
function finish() {
  const n = grid.filter(Boolean).length; if (n < 10) { LIYU.toast('再多貼幾顆鑽石吧！（至少 10 顆）'); return; }
  draw(true); LIYU.save(`我的鑽石畫-${Date.now()}`); LIYU.clear(n);
  LIYU.finish({ win: true, lines: [`💎 貼了 ${n} 顆鑽石！`, '已經存成圖片（在「下載」裡找得到）'] });
}
function gem(x, y, c, t) {
  ctx.beginPath(); ctx.moveTo(x, y - S / 2 + 2); ctx.lineTo(x + S / 2 - 2, y); ctx.lineTo(x, y + S / 2 - 2); ctx.lineTo(x - S / 2 + 2, y); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - S / 2 + 2); ctx.lineTo(x + S / 2 - 2, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y + S / 2 - 2); ctx.lineTo(x - S / 2 + 2, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
  const tw = (Math.sin(t * 3 + x * .1 + y * .07) + 1) / 2; if (tw > .92) LIYU.circle(x - 3, y - 4, 2, '#fff');
}
function draw(clean, t = 0) {
  LIYU.bg('#2a2438');
  LIYU.rrect(OX - 8, OY - 8, N * S + 16, N * S + 16, 10, '#3a3350');
  const T = CONFIG.templates[tmpl];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = OX + c * S + S / 2, y = OY + r * S + S / 2, v = grid[r * N + c];
    if (v) gem(x, y, v, t);
    else if (!clean) { const k = T && T[r][c]; LIYU.circle(x, y, 3, k && k !== '.' ? CONFIG.palette[k.charCodeAt(0) - 97] + '99' : 'rgba(255,255,255,.12)'); }
  }
  if (clean) return;
  TB.forEach((o) => { LIYU.rrect(o.x - 40, o.y - 16, 80, 32, 16, tmpl === o.k ? '#e8762b' : '#3a3350'); LIYU.text(o.k === '自由' ? '自由創作' : `底圖：${o.k}`, o.x, o.y + 1, { size: 12, color: '#fff' }); });
  PAL.forEach((o) => { LIYU.circle(o.x, o.y, 15, o.c, color === o.c ? '#ffd23a' : 'rgba(255,255,255,.3)', color === o.c ? 4 : 2); });
  LIYU.rrect(CLR.x - 60, CLR.y - 16, 120, 32, 16, '#3a3350'); LIYU.text('全部拿掉', CLR.x, CLR.y + 1, { size: 14, color: '#ddd' });
  LIYU.rrect(DONE.x - 90, DONE.y - 22, 180, 44, 22, '#e8762b'); LIYU.text('✅ 完成', DONE.x, DONE.y + 1, { size: 20, color: '#fff' });
  LIYU.text(`💎 ${grid.filter(Boolean).length} 顆`, W - 12, 14, { align: 'right', size: 13, color: '#ddd' });
}
LIYU.loop((dt, t) => { if (!ready) { LIYU.bg('#2a2438'); LIYU.text('💎', 200, 280, { size: 80 }); return; } draw(false, t); });
LIYU.peek = () => ({ grid });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
