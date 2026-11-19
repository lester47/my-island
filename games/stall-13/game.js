// 第 13 攤・鯉魚記憶王／搖出你的好耳力：翻牌找相同圖案＋聽瓶子裡豆子的聲音找相同的一組
import { LIYU } from '../_kit/kit.js?v=20261119g';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 13, title: '記憶王＋好耳力', stall: '鯉魚記憶王／搖出你的好耳力',
  how: ['上方切換兩個遊戲', '🃏 記憶王：一次翻兩張，一樣就留著', '👂 好耳力：點瓶子聽豆子搖的聲音，找出聲音一樣的兩瓶（會自動打開聲音）', '兩個遊戲都完成就結束'],
  clear: '兩種遊戲各配對成功 1 組（和現場一樣）',
  cards: ['🍎', '🐻', '⭐', '🍓', '🌻', '🐟', '🎈', '🍪'],                       // 8 種牌面（學生可以換成自己畫的圖）
  beans: [                                                                       // 3 種豆子的聲音：頻率越低越「粗」
    { name: '紅豆', color: '#b3263a', freq: 2400, beats: 5, gap: .1 },
    { name: '綠豆', color: '#4f9a3a', freq: 4200, beats: 7, gap: .07 },
    { name: '黃豆', color: '#e3b23b', freq: 1200, beats: 4, gap: .15 },
  ],
  credit: '第 13 攤 鯉魚記憶王／搖出你的好耳力',
};
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let tab, cards, pick, lock, flips, memPairs, bottles, bpick, earPairs, earTries;
function start() {
  tab = 'mem'; flips = 0; memPairs = 0; earPairs = 0; earTries = 0; pick = []; bpick = []; lock = 0;
  cards = shuffle([...CONFIG.cards, ...CONFIG.cards]).map((s) => ({ s, open: false, done: false, f: 0 }));
  bottles = shuffle([0, 0, 1, 1, 2, 2]).map((b) => ({ b, done: false, shake: 0 }));
}
const CX = 30, CY = 130, CW = 85, CH = 100;
const BX = [80, 200, 320], BY = [230, 400];
function check() { if (memPairs >= 1 && earPairs >= 1) LIYU.clear(flips); if (memPairs === CONFIG.cards.length && earPairs === 3) setTimeout(() => LIYU.running && LIYU.finish({ score: flips, higher: false, lines: [`記憶王：翻了 ${flips} 次全部配完`, `好耳力：試了 ${earTries} 次找齊 3 組`] }), 700); }
LIYU.on('down', (x, y) => {
  if (!LIYU.running) return;
  if (y < 100 && y > 46) { const nt = x < W / 2 ? 'mem' : 'ear'; if (nt !== tab) { tab = nt; LIYU.sfx('tap'); if (tab === 'ear' && LIYU.muted) { LIYU.unmute(); LIYU.toast('🔊 已打開聲音'); } } return; }
  if (tab === 'mem') {
    if (lock > 0) return;
    const c = Math.floor((x - CX) / CW), r = Math.floor((y - CY) / CH); if (c < 0 || c > 3 || r < 0 || r > 3) return;
    const k = cards[r * 4 + c]; if (k.open || k.done) return;
    k.open = true; pick.push(k); LIYU.sfx('tap');
    if (pick.length === 2) {
      flips++;
      if (pick[0].s === pick[1].s) { pick.forEach((q) => (q.done = true)); memPairs++; LIYU.sfx('hit'); pick = []; check(); }
      else { lock = .8; }
    }
  } else {
    const i = bottles.findIndex((b, j) => Math.abs(x - BX[j % 3]) < 50 && Math.abs(y - BY[Math.floor(j / 3)]) < 70);
    if (i < 0) return; const b = bottles[i]; if (b.done) return;
    const bean = CONFIG.beans[b.b]; b.shake = .6; LIYU.sfx('shake', bean.freq, bean.beats, bean.gap);
    if (bpick.includes(b)) return;
    bpick.push(b);
    if (bpick.length === 2) {
      earTries++;
      const [a, c] = bpick; bpick = [];
      setTimeout(() => {
        if (a.b === c.b) { a.done = c.done = true; earPairs++; LIYU.sfx('hit'); LIYU.toast(`✅ 都是${CONFIG.beans[a.b].name}！`); check(); }
        else { LIYU.sfx('miss'); LIYU.toast('聲音不一樣，再聽聽看'); }
      }, 700);
    }
  }
});
function drawBottle(x, y, b, sel) {
  const off = b.shake > 0 ? Math.sin(b.shake * 50) * 6 : 0;
  ctx.save(); ctx.translate(x + off, y);
  LIYU.rrect(-34, -50, 68, 100, 16, sel ? '#ffe7cf' : 'rgba(220,240,255,.9)', sel ? '#e8762b' : '#7aa7c7', 3);
  LIYU.rrect(-18, -66, 36, 18, 6, '#c9a06a');
  if (b.done) { const c = CONFIG.beans[b.b]; for (let i = 0; i < 14; i++) LIYU.circle(-22 + (i % 5) * 11, 40 - Math.floor(i / 5) * 10, 5, c.color); LIYU.text(c.name, 0, -18, { size: 16 }); }
  else LIYU.text('？', 0, 0, { size: 34, color: '#7aa7c7' });
  ctx.restore();
}
LIYU.loop((dt) => {
  LIYU.bg('#fdf3e3');
  if (!cards) { LIYU.text('🃏 👂', 200, 300, { size: 60 }); return; }
  if (lock > 0 && (lock -= dt) <= 0) { pick.forEach((q) => (q.open = false)); pick = []; }
  for (const [k, x, label, n] of [['mem', 0, '🃏 記憶王', `${memPairs}/${CONFIG.cards.length}`], ['ear', W / 2, '👂 好耳力', `${earPairs}/3`]]) {
    LIYU.rrect(x + 8, 50, W / 2 - 16, 46, 14, tab === k ? '#e8762b' : '#fff', '#e8762b', 2);
    LIYU.text(`${label} ${n}`, x + W / 4, 74, { size: 18, color: tab === k ? '#fff' : '#b34a10' });
  }
  LIYU.text(`翻牌 ${flips} 次`, 16, 24, { align: 'left', size: 15, weight: 600 });
  if (tab === 'mem') {
    cards.forEach((k, i) => {
      const x = CX + (i % 4) * CW, y = CY + Math.floor(i / 4) * CH, up = k.open || k.done;
      k.f += ((up ? 1 : 0) - k.f) * Math.min(1, dt * 14);
      const sx = Math.abs(Math.cos(k.f * Math.PI)); ctx.save(); ctx.translate(x + CW / 2, y + CH / 2); ctx.scale(Math.max(.05, sx), 1);
      if (k.f > .5) { LIYU.rrect(-CW / 2 + 5, -CH / 2 + 5, CW - 10, CH - 10, 12, k.done ? '#e5f6dc' : '#fff', '#e8762b', 3); ctx.scale(1 / Math.max(.05, sx), 1); LIYU.text(k.s, 0, 2, { size: 40 }); }
      else { LIYU.rrect(-CW / 2 + 5, -CH / 2 + 5, CW - 10, CH - 10, 12, '#e8762b', '#b34a10', 3); LIYU.text('🐟', 0, 2, { size: 26 }); }
      ctx.restore();
    });
  } else {
    bottles.forEach((b, j) => { if (b.shake > 0) b.shake -= dt; drawBottle(BX[j % 3], BY[Math.floor(j / 3)], b, bpick.includes(b)); });
    LIYU.text('點瓶子聽聲音，找出一樣的兩瓶', 200, 520, { size: 17, color: '#7a4a22' });
    LIYU.text('紅豆、綠豆、黃豆各兩瓶', 200, 548, { size: 15, color: '#7a4a22', weight: 600 });
  }
});
LIYU.peek = () => ({ cards, bottles, tab });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
