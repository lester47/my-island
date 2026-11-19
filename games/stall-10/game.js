// 第 10 攤・套圈圈／戳洞洞：往上滑丟圈圈，套中木樁就得到一次戳洞洞機會，戳開紙格看看藏了什麼
import { LIYU } from '../_kit/kit.js?v=20261119c';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 10, title: '套圈圈＋戳洞洞', stall: '圈圈洞洞／好開心抽抽樂',
  how: ['手指按住圈圈，往木樁的方向「往上滑」放開', '滑得越快飛越遠，往左右滑會偏', '一輪 5 個圈圈；套中幾個就有幾次戳洞洞', '戳洞洞：點一格紙格，看裡面藏了什麼'],
  clear: '至少套中 1 個＋完成 1 次戳洞洞（和現場一樣）',
  rings: 5,
  surprises: ['🐟', '⭐', '😄', '🎈', '🍬', '🌈', '🍀', '🎵', '💎', '🐢'],   // 洞裡的小驚喜（只是圖案，不是現場獎品）
  credit: '第 10 攤 圈圈洞洞／好開心抽抽樂',
};
const PEGS = [[110, 190, .6], [200, 175, .55], [290, 190, .6], [150, 270, .78], [255, 270, .78], [200, 350, .92]];   // x, y, 遠近（越小越遠）
const HOME = { x: 200, y: 530 };

let phase, left, hits, pokes, poked, ring, drag, grid, msg;
function start() { phase = 'ring'; left = CONFIG.rings; hits = 0; pokes = 0; poked = 0; ring = null; drag = null; grid = null; msg = ''; }
LIYU.on('down', (x, y) => {
  if (!LIYU.running) return;
  if (phase === 'ring' && !ring && Math.hypot(x - HOME.x, y - HOME.y) < 70) drag = { x0: x, y0: y, x, y, t0: performance.now() };
  if (phase === 'poke') pokeAt(x, y);
});
LIYU.on('move', (x, y) => { if (drag) { drag.x = x; drag.y = y; } });
LIYU.on('up', (x, y) => {
  if (!drag) return;
  const dt = Math.max(60, performance.now() - drag.t0) / 1000, dy = drag.y0 - y, dx = x - drag.x0; drag = null;
  if (dy < 25) return;
  const power = Math.min(1.25, dy / dt / 1400);                            // 往上滑的速度 → 飛多遠
  const ty = HOME.y - 120 - power * 330, tx = HOME.x + dx * 1.4;
  ring = { t: 0, x0: HOME.x, y0: HOME.y, tx, ty, x: HOME.x, y: HOME.y, s: 1 }; left--; LIYU.sfx('throw');
});
function land() {
  const r = ring; ring = null;
  const peg = PEGS.find(([px, py, s]) => Math.abs(r.x - px) < 20 * s && Math.abs(r.y - py) < 16 * s);
  if (peg) { hits++; pokes++; LIYU.sfx('hit'); msg = '🎯 套中了！多一次戳洞洞'; peg.flash = 1; }
  else { LIYU.sfx('miss'); msg = r.y > 360 ? '太近了，滑快一點' : r.y < 150 ? '太遠了，滑慢一點' : '差一點點！'; }
  if (left <= 0) setTimeout(() => { if (!LIYU.running) return; if (pokes > 0) { phase = 'poke'; grid = Array.from({ length: 25 }, () => ({ open: false, s: CONFIG.surprises[Math.floor(Math.random() * CONFIG.surprises.length)] })); msg = `戳洞洞！你有 ${pokes} 次機會`; } else end(); }, 700);
}
const GX = 50, GY = 150, GS = 60;
function pokeAt(x, y) {
  const c = Math.floor((x - GX) / GS), r = Math.floor((y - GY) / GS);
  if (c < 0 || c > 4 || r < 0 || r > 4 || pokes <= 0) return;
  const g = grid[r * 5 + c]; if (g.open) return;
  g.open = true; pokes--; poked++; LIYU.sfx('pop'); msg = `${g.s} 戳開了！`;
  if (hits >= 1 && poked >= 1) LIYU.clear(hits);
  if (pokes <= 0) setTimeout(end, 900);
}
function end() { if (LIYU.running) LIYU.finish({ score: hits, lines: [`套中 ${hits}／${CONFIG.rings} 個`, `戳開 ${poked} 個洞`] }); }

function drawRing(x, y, s, a = 1) { ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); ctx.scale(s, s * .45); ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.lineWidth = 9; ctx.strokeStyle = '#e8473f'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd23a'; ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; }
LIYU.loop((dt) => {
  LIYU.bg('#dff1d6');
  if (phase !== 'poke') {
    ctx.fillStyle = '#c9e3b8'; ctx.beginPath(); ctx.moveTo(60, 130); ctx.lineTo(340, 130); ctx.lineTo(400, 440); ctx.lineTo(0, 440); ctx.fill();   // 場地（有遠近）
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(30, 450); ctx.lineTo(370, 450); ctx.stroke(); ctx.setLineDash([]);
    LIYU.text('站在白線後面丟', 200, 470, { size: 14, color: '#5a7a4a', weight: 600 });
    for (const p of PEGS) { const [px, py, s] = p; LIYU.rrect(px - 7 * s, py - 46 * s, 14 * s, 46 * s, 4, '#a8743f'); ctx.beginPath(); ctx.ellipse(px, py, 16 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fillStyle = p.flash ? `rgba(255,210,58,${p.flash})` : 'rgba(0,0,0,.15)'; ctx.fill(); if (p.flash) p.flash = Math.max(0, p.flash - dt); }
    if (ring && LIYU.running) {
      ring.t += dt / .7; const k = Math.min(1, ring.t);
      ring.x = ring.x0 + (ring.tx - ring.x0) * k; ring.y = ring.y0 + (ring.ty - ring.y0) * k - Math.sin(k * Math.PI) * 120; ring.s = 1 - (1 - (ring.ty - 130) / 400) * .5 * k;
      drawRing(ring.x, ring.y, ring.s); if (k >= 1) { ring.y = ring.ty; land(); }
    }
    for (let i = 0; i < left - (ring ? 0 : 1); i++) drawRing(30 + i * 34, 570, .6, .8);
    if (!ring && left > 0 && phase === 'ring') {
      const dx = drag ? drag.x - drag.x0 : 0, dy = drag ? drag.y - drag.y0 : 0;
      drawRing(HOME.x + dx * .3, HOME.y + dy * .3, 1.2);
      if (!drag && LIYU.running) LIYU.text('↑ 按住往上滑', HOME.x, HOME.y + 48, { size: 16, color: '#7a4a22' });
    }
  } else {
    LIYU.text('👆 點一格戳開', 200, 120, { size: 22 });
    for (let i = 0; i < 25; i++) {
      const g = grid[i], x = GX + (i % 5) * GS, y = GY + Math.floor(i / 5) * GS;
      LIYU.rrect(x + 3, y + 3, GS - 6, GS - 6, 8, g.open ? '#fff' : '#e8473f', '#a8743f', 2);
      if (g.open) LIYU.text(g.s, x + GS / 2, y + GS / 2 + 2, { size: 30 }); else LIYU.circle(x + GS / 2, y + GS / 2, 12, '#ffd23a');
    }
    LIYU.text(`剩下 ${pokes} 次`, 200, 480, { size: 22, color: '#b34a10' });
  }
  if (phase) {
    LIYU.text(`圈圈 ${left}・套中 ${hits}`, 16, 28, { align: 'left', size: 18 });
    if (msg) LIYU.text(msg, 200, 80, { size: 20, color: '#b34a10' });
  }
});
LIYU.setup({ ...CONFIG, start });
