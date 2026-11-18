// 第 19 攤・三二一發射！／戰鬥陀螺：倒數後按住「發射」貯力，在綠色區放開；陀螺互撞，先停下或被撞出場的輸
import { LIYU } from '../_kit/kit.js?v=20261118s';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 19, title: '三二一發射！戰鬥陀螺', stall: '三二一發射！／戰鬥陀螺',
  how: ['倒數 3、2、1 後，按住下方「發射」貯力', '力道條在綠色區放開最強', '對戰中點擂台，可以把你的陀螺往那個方向推一下（每場 3 次）', '你的陀螺比對手轉得久就贏；被撞出擂台就輸', '連贏 3 個對手就是陀螺王！'],
  clear: '讓自己的陀螺比對手轉得更久（贏 1 場，和現場一樣）',
  pushes: 3,
  rivals: [                                                               // 對手：名字、顏色、發射力道、重量
    { name: '小旋風', color: '#7cc576', power: .62, mass: .9 },
    { name: '火焰王', color: '#e8473f', power: .78, mass: 1.05 },
    { name: '黑鐵龍', color: '#3a3a4a', power: .86, mass: 1.1 },
  ],
  credit: '第 19 攤 三二一發射！／戰鬥陀螺',
};
const AX = 200, AY = 300, AR = 165, TR = 24, BTN = { x: 200, y: 545, w: 200, h: 60 };
let phase, cd, charge, holding, me, cpu, rival, wins, pushes, msg, endT;
function start() { wins = 0; rival = 0; newMatch(); }
function newMatch() { phase = 'count'; cd = 3.2; charge = 0; holding = false; me = cpu = null; pushes = CONFIG.pushes; msg = ''; endT = 0; }
const mkTop = (x, y, vx, vy, spin, mass, color, mine) => ({ x, y, vx, vy, spin, mass, color, mine, ang: 0, out: 0 });
function launch(pow) {
  const R = CONFIG.rivals[rival], cp = R.power * (.9 + Math.random() * .2);
  me = mkTop(AX - 110, AY + 60, 180 + pow * 40, -60 - Math.random() * 60, .5 + pow * .5, 1, '#e8762b', true);      // 力道主要決定轉速
  cpu = mkTop(AX + 110, AY - 60, -(180 + cp * 40), 60 + Math.random() * 60, .5 + cp * .5, R.mass, R.color, false);
  phase = 'battle'; LIYU.sfx('throw'); msg = pow > .85 ? '💥 完美發射！' : pow > .6 ? '不錯的發射！' : '發射力道有點弱…';
}
// 力道條：按住時在 0～1 之間來回跑；綠色區 0.8～0.95
const powNow = () => { const k = (charge % 2); return k < 1 ? k : 2 - k; };
LIYU.on('down', (x, y) => {
  if (!LIYU.running) return;
  if (phase === 'ready' && Math.abs(x - BTN.x) < BTN.w / 2 && Math.abs(y - BTN.y) < BTN.h / 2) { holding = true; charge = 0; LIYU.sfx('tap'); return; }
  if (phase === 'battle' && me && pushes > 0 && Math.hypot(x - AX, y - AY) < AR) {
    const dx = x - me.x, dy = y - me.y, d = Math.hypot(dx, dy) || 1; me.vx += dx / d * 150; me.vy += dy / d * 150; pushes--; LIYU.sfx('tap');
  }
});
LIYU.on('up', () => { if (holding && phase === 'ready') { holding = false; launch(powNow()); } });

function physics(dt) {
  for (const t of [me, cpu]) {
    if (t.out) continue;
    const dx = t.x - AX, dy = t.y - AY;
    t.vx += -dx * 1.6 * dt; t.vy += -dy * 1.6 * dt;                         // 碗形擂台：往中間滑
    t.vx *= Math.pow(.55, dt); t.vy *= Math.pow(.55, dt);
    t.x += t.vx * dt; t.y += t.vy * dt;
    t.spin -= dt * (.06 + Math.hypot(t.vx, t.vy) / 7000);                  // 慢慢變慢
    t.ang += t.spin * dt * 40;
    if (Math.hypot(t.x - AX, t.y - AY) > AR - 4) { t.out = 1; t.spin = 0; LIYU.sfx('miss'); }
  }
  const dx = cpu.x - me.x, dy = cpu.y - me.y, d = Math.hypot(dx, dy);
  if (d < TR * 2 && d > 0 && !me.out && !cpu.out) {
    const nx = dx / d, ny = dy / d, rv = (me.vx - cpu.vx) * nx + (me.vy - cpu.vy) * ny;
    const push = (TR * 2 - d) / 2; me.x -= nx * push; me.y -= ny * push; cpu.x += nx * push; cpu.y += ny * push;
    if (rv > 0) {
      const kick = 1.7 * rv / (me.mass + cpu.mass) + 60;                    // 互相彈開（重的比較不會被彈）
      me.vx -= nx * kick * cpu.mass; me.vy -= ny * kick * cpu.mass; cpu.vx += nx * kick * me.mass; cpu.vy += ny * kick * me.mass;
      const hitE = Math.min(.16, rv / 2400 + .03);                           // 轉速損失：轉得慢的那個吃虧
      me.spin -= hitE * cpu.spin / (me.spin + cpu.spin + .01) * (1.1 / me.mass); cpu.spin -= hitE * me.spin / (me.spin + cpu.spin + .01) * (1.1 / cpu.mass);
      LIYU.sfx('bump');
    }
  }
}
function result(win) {
  phase = 'end'; endT = 1.6;
  if (win) { wins++; LIYU.sfx('win'); msg = `🏆 你贏了 ${CONFIG.rivals[rival].name}！`; LIYU.clear(wins); }
  else { msg = `${CONFIG.rivals[rival].name} 贏了…`; LIYU.sfx('lose'); }
  setTimeout(() => {
    if (!LIYU.running) return;
    if (win && rival < CONFIG.rivals.length - 1) { rival++; newMatch(); LIYU.toast(`下一個對手：${CONFIG.rivals[rival].name}`); }
    else LIYU.finish({ score: wins, lines: [win ? '👑 連贏 3 場，你是陀螺王！' : `連贏 ${wins} 場`, `最後的對手：${CONFIG.rivals[rival].name}`] });
  }, 1800);
}
function drawTop(t) {
  if (!t) return;
  const s = t.out ? .7 : 1, wob = t.spin < .25 ? (0.25 - t.spin) * 30 : 0;
  ctx.save(); ctx.translate(t.x + Math.sin(t.ang * .3) * wob, t.y + Math.cos(t.ang * .3) * wob); ctx.scale(s, s);
  LIYU.circle(2, 4, TR, 'rgba(0,0,0,.2)');
  ctx.rotate(t.ang);
  LIYU.circle(0, 0, TR, t.color, '#2a1d12', 3);
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, TR - 4, 0, .5); ctx.fill(); }
  LIYU.circle(0, 0, 7, '#ddd', '#2a1d12', 2);
  ctx.restore();
}
function spinBar(x, label, t, color) {
  LIYU.text(label, x, 50, { size: 15, color });
  LIYU.rrect(x - 60, 62, 120, 14, 7, '#fff', '#7a4a22', 2);
  if (t) LIYU.rrect(x - 59, 63, 118 * Math.max(0, Math.min(1, t.spin)), 12, 6, color);
}
LIYU.loop((dt) => {
  LIYU.bg('#f5ead6');
  ctx.beginPath(); ctx.arc(AX, AY, AR + 10, 0, Math.PI * 2); ctx.fillStyle = '#8b5a2b'; ctx.fill();
  const g = ctx.createRadialGradient(AX, AY, 10, AX, AY, AR); g.addColorStop(0, '#e9eef3'); g.addColorStop(1, '#b9c4cf'); ctx.beginPath(); ctx.arc(AX, AY, AR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(42,29,18,.15)'; ctx.lineWidth = 2; for (const r of [50, 100, 150]) { ctx.beginPath(); ctx.arc(AX, AY, r, 0, Math.PI * 2); ctx.stroke(); }
  if (!phase) { LIYU.text('🌀', 200, 300, { size: 70 }); return; }
  const R = CONFIG.rivals[rival];
  spinBar(90, '你的陀螺', me, '#e8762b'); spinBar(310, R.name, cpu, R.color);
  if (LIYU.running) {
    if (phase === 'count') { cd -= dt; LIYU.text(cd > 0 ? String(Math.ceil(cd)) : '發射！', AX, AY, { size: 80, color: '#b34a10' }); if (cd <= -.3) phase = 'ready'; }
    else if (phase === 'battle') {
      physics(dt);
      if (me.spin <= 0 || cpu.spin <= 0) result(cpu.spin <= 0 && me.spin > 0);
    }
  }
  drawTop(cpu); drawTop(me);
  if (phase === 'ready') {
    if (holding) charge += dt * 1.6;
    const p = powNow();
    LIYU.rrect(60, 470, 280, 22, 11, '#fff', '#7a4a22', 2); LIYU.rrect(60 + 280 * .8, 471, 280 * .15, 20, 4, '#7cc576');
    LIYU.rrect(60 + 280 * p - 4, 464, 8, 34, 4, '#e8473f');
    LIYU.rrect(BTN.x - BTN.w / 2, BTN.y - BTN.h / 2, BTN.w, BTN.h, 30, holding ? '#b34a10' : '#e8762b');
    LIYU.text(holding ? '在綠色區放開！' : '按住 發射', BTN.x, BTN.y + 1, { size: 22, color: '#fff' });
  }
  if (phase === 'battle') LIYU.text(`點擂台推一下：剩 ${pushes} 次`, 200, 520, { size: 17, color: '#7a4a22' });
  if (msg && phase !== 'count') LIYU.text(msg, 200, 580, { size: 19, color: '#b34a10' });
  LIYU.text(`連勝 ${wins}`, 16, 22, { align: 'left', size: 15 }); LIYU.text(`對手 ${rival + 1}/3`, W - 16, 22, { align: 'right', size: 15 });
});
LIYU.peek = () => ({ phase, me, cpu, wins, pow: powNow() });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
