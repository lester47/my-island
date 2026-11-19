// 第 08 攤・有吃有玩真好玩：點心從天上掉下來，移動盤子接住點心，躲開小石頭
import { LIYU } from '../_kit/kit.js?v=20261119g';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 8, title: '點心快手', stall: '有吃有玩真好玩',
  how: ['手指按住畫面左右拖，移動盤子（電腦用 ← → 鍵）', '接住掉下來的點心：🍪🍬🧁🍡🌭', '躲開小石頭 🪨，接到會扣 2 分', '一輪 40 秒，越後面掉越快'],
  clear: '一輪接住 10 個點心',
  time: 40, goal: 10,
  snacks: ['🍪', '🍬', '🧁', '🍡', '🌭', '🍩', '🍫'], bad: '🪨',
  credit: '第 08 攤 有吃有玩真好玩',
};
const PY = 520;
let t, score, got, items, plate, spawnT, keys = {}, target = null, shake;
function start() { t = CONFIG.time; score = 0; got = 0; items = []; plate = 200; spawnT = .4; target = null; shake = 0; }
LIYU.on('down', (x) => { target = x; });
LIYU.on('move', (x, y, e, held) => { if (held) target = x; });
LIYU.on('up', () => { target = null; });
addEventListener('keydown', (e) => { keys[e.key] = true; }); addEventListener('keyup', (e) => { keys[e.key] = false; });
LIYU.loop((dt, now) => {
  LIYU.bg('#fff1de');
  for (let i = 0; i < 8; i++) LIYU.rrect(i * 50, 0, 25, 40, 0, i % 2 ? '#e8473f' : '#fff');      // 攤位遮雨棚
  LIYU.rrect(0, PY + 30, W, H, 0, '#c9a06a');
  if (!items) { LIYU.text('🍪🍬🧁', 200, 300, { size: 50 }); return; }
  if (LIYU.running) {
    t -= dt; spawnT -= dt;
    const lvl = 1 + (CONFIG.time - t) / CONFIG.time;                          // 越後面越快
    if (spawnT <= 0) { const bad = Math.random() < .22; items.push({ x: 30 + Math.random() * 340, y: 40, v: (150 + Math.random() * 80) * lvl, s: bad ? CONFIG.bad : CONFIG.snacks[Math.floor(Math.random() * CONFIG.snacks.length)], bad, r: Math.random() * 6 }); spawnT = (.75 + Math.random() * .4) / lvl; }
    if (keys.ArrowLeft) plate -= 380 * dt; if (keys.ArrowRight) plate += 380 * dt;
    if (target != null) plate += (target - plate) * Math.min(1, dt * 14);
    plate = Math.max(45, Math.min(W - 45, plate));
    for (const it of items) {
      it.y += it.v * dt; it.r += dt * 3;
      if (!it.done && it.y > PY - 18 && it.y < PY + 12 && Math.abs(it.x - plate) < 52) {
        it.done = true;
        if (it.bad) { score = Math.max(0, score - 2); shake = .35; LIYU.sfx('miss'); LIYU.toast('🪨 哎呀，是石頭！'); }
        else { score++; got++; LIYU.sfx('hit'); if (got >= CONFIG.goal) LIYU.clear(score); }
      }
    }
    items = items.filter((it) => !it.done && it.y < H + 30);
    if (t <= 0) LIYU.finish({ score, lines: [`接住 ${got} 個點心`, `得到 ${score} 分`] });
  }
  for (const it of items) { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(Math.sin(it.r) * .3); LIYU.text(it.s, 0, 0, { size: 38 }); ctx.restore(); }
  const sx = shake > 0 ? Math.sin(now * 80) * 6 : 0; if (shake > 0) shake -= dt;
  ctx.beginPath(); ctx.ellipse(plate + sx, PY + 6, 58, 14, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#2f7fd1'; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(plate + sx, PY + 4, 40, 8, 0, 0, Math.PI * 2); ctx.strokeStyle = '#bcd6ef'; ctx.lineWidth = 2; ctx.stroke();
  LIYU.text(`⏱ ${Math.max(0, Math.ceil(t))}`, 16, 64, { align: 'left' });
  LIYU.text(`🍪 ${got}／${CONFIG.goal}・${score} 分`, W - 16, 64, { align: 'right', size: 18 });
  if (got === 0 && LIYU.running) LIYU.text('← 按住左右拖動盤子 →', 200, 470, { size: 17, color: '#7a4a22' });
});
LIYU.peek = () => ({ items, plate });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
