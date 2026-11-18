// 🎮 115 鯉魚市集・攤位小遊戲共用工具包
// 每個遊戲只要：
//   import { LIYU } from '../_kit/kit.js';
//   LIYU.setup({ no: 11, title: '彈珠迷宮', how: ['怎麼玩…'], clear: '過關條件…', start: () => {…} });
//   LIYU.loop((dt, t) => { 畫面每一格要做的事 });
//   過關時呼叫 LIYU.clear(分數)；一輪結束呼叫 LIYU.finish({ score, lines: ['…'] })
// 畫布固定是 400 × 600（直式），在手機、平板、電腦上會自動縮放；座標一律用這個大小來算。

const W = 400, H = 600;
const embedded = new URLSearchParams(location.search).has('embed') && window.parent !== window;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const post = (type, extra = {}) => { if (embedded) window.parent.postMessage({ liyu: 1, type, ...extra }, location.origin); };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 無痕模式存不了也沒關係 */ } },
};

// ---------------------------------------------------------------- 音效（不用音檔，用瀏覽器內建合成；預設靜音）
let AC = null, muted = store.get('liyu-game-muted', true);
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { AC = null; } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(freq, dur = .12, type = 'sine', vol = .2, slide = 0, delay = 0) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + .02);
}
// 沙沙聲（搖豆子）：雜訊經過濾波；freq 越低聽起來越「粗」
function shake(freq = 2000, beats = 4, gap = .11, vol = .35) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * .07), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  for (let k = 0; k < beats; k++) {
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4; g.gain.value = vol;
    s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + k * gap);
  }
}
const SFX = {
  tap: () => tone(660, .06, 'triangle', .15),
  hit: () => { tone(520, .08, 'triangle', .25); tone(780, .1, 'triangle', .2, 0, .07); },
  miss: () => tone(220, .2, 'sawtooth', .12, -80),
  pop: () => tone(900, .08, 'square', .12, -500),
  throw: () => tone(300, .18, 'sine', .15, 400),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .16, 'triangle', .22, 0, i * .11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, .2, 'triangle', .18, 0, i * .14)),
  bump: () => tone(140, .1, 'square', .2, -40),
};

// ---------------------------------------------------------------- 畫面
const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./kit.css', import.meta.url).href; document.head.append(css);
const root = el('div', 'lg-root');
const bar = el('header', 'lg-bar');
const back = el('button', 'lg-back', embedded ? '✕ 回市集' : '← 回鯉魚市集');
const title = el('h1', 'lg-title');
const snd = el('button', 'lg-snd');
bar.append(back, title, snd);
if (embedded) back.hidden = true;                    // 在市集裡打開時，市集上方已經有「✕ 回市集」
const stage = el('main', 'lg-stage');
const cv = el('canvas', 'lg-cv'); cv.width = W; cv.height = H; cv.setAttribute('aria-label', '遊戲畫面');
const ctx = cv.getContext('2d');
const toastEl = el('p', 'lg-toast'); toastEl.setAttribute('role', 'status');
const over = el('section', 'lg-over');
const box = el('div', 'lg-box'); box.append(cv);                 // 3D 遊戲：3D 畫布放在 box 裡、cv 下面，cv 變成透明的 HUD
stage.append(box, toastEl, over);
root.append(bar, stage);
document.body.append(root);

function renderSnd() { snd.textContent = muted ? '🔇' : '🔊'; snd.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
snd.onclick = () => { muted = !muted; store.set('liyu-game-muted', muted); renderSnd(); if (!muted) SFX.tap(); };
renderSnd();
back.onclick = () => { if (embedded) post('close'); else location.href = new URL('../../', location.href).href; };
addEventListener('keydown', (e) => { if (e.key === 'Escape' && embedded) post('close'); });

// 畫布縮放：保持 2:3，盡量填滿；高解析度螢幕畫得更清楚
let scale = 1, layer3d = null;
function fit() {
  const r = stage.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = `${W * s}px`; cv.style.height = `${H * s}px`; box.style.width = cv.style.width; box.style.height = cv.style.height;
  if (layer3d) layer3d.resize(W * s, H * s, dpr);
  cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
  scale = s * dpr; ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
addEventListener('resize', fit); new ResizeObserver(fit).observe(stage);

// 觸控／滑鼠：座標換算成 400×600
const handlers = { down: [], move: [], up: [] };
const toXY = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
let pid = null;
cv.addEventListener('pointerdown', (e) => { if (pid != null) return; pid = e.pointerId; cv.setPointerCapture(pid); ac(); const p = toXY(e); handlers.down.forEach((f) => f(p.x, p.y, e)); e.preventDefault(); });
cv.addEventListener('pointermove', (e) => { if (e.pointerId !== pid && e.pointerType !== 'mouse') return; const p = toXY(e); handlers.move.forEach((f) => f(p.x, p.y, e, pid != null)); });
const up = (e) => { if (e.pointerId !== pid) return; pid = null; const p = toXY(e); handlers.up.forEach((f) => f(p.x, p.y, e)); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

// 主迴圈
let loopFn = null, last = 0, running = false;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
  if (loopFn) { ctx.save(); loopFn(dt, now / 1000); ctx.restore(); }
  requestAnimationFrame(frame);
}

let cfg = {}, clearedThisRound = false;
function showOver(html) { over.innerHTML = html; over.hidden = false; const b = over.querySelector('button'); if (b) b.focus(); }
function hideOver() { over.hidden = true; over.innerHTML = ''; }
function startScreen() {
  const best = store.get(bestKey(), null);
  showOver(`<div class="lg-card">
    <img class="lg-logo" src="${new URL('../../assets/brand/koi-logo.png', import.meta.url).href}" alt="" width="72" height="72">
    <p class="lg-no">第 ${String(cfg.no).padStart(2, '0')} 攤${cfg.stall ? `・${esc(cfg.stall)}` : ''}</p>
    <h2>${esc(cfg.title)}</h2>
    <ul class="lg-how">${(cfg.how || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="lg-clear">🎯 過關：${esc(cfg.clear || '')}</p>
    ${best != null ? `<p class="lg-best">🏆 你的最佳：${esc(best)}</p>` : ''}
    <button type="button" class="lg-btn" data-go>開始！</button>
    ${cfg.credit ? `<p class="lg-credit">${esc(cfg.credit)}</p>` : ''}
  </div>`);
  over.querySelector('[data-go]').onclick = () => { ac(); hideOver(); clearedThisRound = false; running = true; cfg.start && cfg.start(); };
}
const bestKey = () => `liyu-game-${cfg.no}-best`;

export const LIYU = window.__liyu = {
  W, H, ctx, cv, embedded, store,
  setup(o) {
    cfg = o; title.textContent = `${String(o.no).padStart(2, '0')}・${o.title}`; document.title = `${o.title}｜115 鯉魚市集`;
    fit(); startScreen(); post('ready'); requestAnimationFrame((t) => { last = t; frame(t); });
  },
  loop(fn) { loopFn = fn; },
  on(type, fn) { handlers[type].push(fn); },
  get running() { return running; },
  unmute() { if (muted) { muted = false; store.set('liyu-game-muted', false); renderSnd(); } },
  get muted() { return muted; },
  sfx(name, ...a) { if (muted) return; if (name === 'shake') shake(...a); else if (SFX[name]) SFX[name](); },
  toast(msg, ms = 1600) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('on'), ms); },
  // 達成這一攤的過關條件：通知市集蓋「線上通關章」（每輪只通知一次）
  clear(score) {
    if (clearedThisRound) return; clearedThisRound = true; LIYU.clears = (LIYU.clears || 0) + 1;
    LIYU.sfx('win'); LIYU.toast('🎉 過關！可以繼續挑戰更高分', 2200);
    post('clear', { score: typeof score === 'number' ? score : null });
  },
  // 一輪結束：顯示結果卡；higher=false 表示分數越低越好（例如步數）
  finish({ score = null, lines = [], higher = true, win = clearedThisRound } = {}) {
    running = false;
    let best = store.get(bestKey(), null), nb = false;
    if (typeof score === 'number' && (best == null || (higher ? score > best : score < best))) { best = score; nb = true; store.set(bestKey(), best); }
    if (!win) LIYU.sfx('lose');
    showOver(`<div class="lg-card">
      <h2>${win ? '🎉 過關！' : '再試一次！'}</h2>
      ${lines.map((t) => `<p class="lg-line">${esc(t)}</p>`).join('')}
      ${best != null ? `<p class="lg-best">${nb ? '✨ 新紀錄！' : '🏆 最佳'}：${esc(best)}</p>` : ''}
      ${win && embedded ? '<p class="lg-line">已在市集蓋上「線上通關章」✅</p>' : ''}
      <div class="lg-btns"><button type="button" class="lg-btn" data-again>再玩一次</button><button type="button" class="lg-btn ghost" data-back>${embedded ? '回市集' : '看說明'}</button></div>
    </div>`);
    over.querySelector('[data-again]').onclick = () => { hideOver(); clearedThisRound = false; running = true; cfg.start && cfg.start(); };
    over.querySelector('[data-back]').onclick = () => { if (embedded) post('close'); else startScreen(); };
  },
  // 把現在的畫面存成圖片（創作類小工具用）
  save(name = 'liyu-art') {
    cv.toBlob((blob) => {
      if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  },
  // 3D 版：建一個 3D 畫布放在 HUD 下面；onResize(cssW, cssH, dpr) 讓遊戲調整 renderer 和相機
  layer3d(onResize) {
    const c3 = el('canvas', 'lg-3d'); box.insertBefore(c3, cv); cv.classList.add('hud');
    layer3d = { canvas: c3, resize: onResize }; fit(); return c3;
  },
  // HUD 座標（400×600）→ 3D 用的 -1～1 螢幕座標
  ndc(x, y) { return { x: x / W * 2 - 1, y: -(y / H * 2 - 1) }; },
  // 畫圖小幫手
  text(s, x, y, { size = 20, color = '#2a1d12', align = 'center', weight = 800, base = 'middle' } = {}) {
    ctx.font = `${weight} ${size}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
  },
  rrect(x, y, w, h, r, fill, stroke, lw = 3) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } },
  circle(x, y, r, fill, stroke, lw = 3) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } },
  // 圖片：學生畫好的圖放在 assets/，用這個載入；還沒載好時回傳 null（遊戲先畫簡單圖形代替）
  img(src) { const i = new Image(); i.src = src; const o = { el: i, ok: false }; i.onload = () => (o.ok = true); return o; },
  bg(color = '#fff8ec') { if (layer3d) { ctx.clearRect(0, 0, W, H); return; } ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); },
};
