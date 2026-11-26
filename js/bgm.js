// 🎵 市集背景音樂：用 Web Audio 即時合成（不需要音檔），輕鬆、有趣、淡淡的
//   - 木琴般的分解和弦＋輕快的小旋律（五聲音階，每次都有一點不一樣），低音輕輕踩在一、三拍，沙鈴很小聲
//   - 和弦：C → G → Am → F，每小節一個，大約每分鐘 96 拍
//   - 坐雲霄飛車時自動淡出（不跟軌道聲、尖叫互相干擾），下車後再慢慢回來
//   - 分頁切到背景時暫停，省電
const BPM = 96, BEAT = 60 / BPM, VOL = .085;
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);          // MIDI 音高 → 頻率
const CHORDS = [                                           // [低音, 和弦內音…]
  [48, 60, 64, 67],   // C
  [43, 59, 62, 67],   // G
  [45, 57, 60, 64],   // Am
  [41, 57, 60, 65],   // F
];
const PENTA = [72, 74, 76, 79, 81, 84];                    // C 五聲音階（旋律）
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];                      // 每小節 8 個八分音符的分解和弦順序

export function createBgm() {
  let ctx = null, master = null, bus = null, noiseBuf = null, timer = 0, next = 0, step = 0;
  let wanted = false, muted = false, ducked = false, phrase = [];

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      // 一點點空間感：短的回聲
      bus = ctx.createGain(); bus.connect(master);
      const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
      dl.delayTime.value = BEAT * .75; fb.gain.value = .28; wet.gain.value = .22; lp.type = 'lowpass'; lp.frequency.value = 2200;
      bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // 木琴：基音＋高 4 倍的泛音（很快消失），聲音短短圓圓的
  function mallet(t, f, vol, len = .9) {
    const c = ctx, g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0008, t + len);
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4.01;
    const g2 = c.createGain(); g2.gain.setValueAtTime(.35, t); g2.gain.exponentialRampToValueAtTime(.001, t + .12);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
    o1.start(t); o2.start(t); o1.stop(t + len + .05); o2.stop(t + .15);
  }
  function bass(t, f, vol) {
    const c = ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + BEAT * 1.6);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + BEAT * 1.7);
  }
  function shaker(t, vol) {
    const c = ctx, n = c.createBufferSource(); n.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random() * .3); n.stop(t + .08);
  }
  // 每兩小節換一句旋律：大多走和弦內音附近，偶爾休息，最後落在穩定的音
  function newPhrase() {
    phrase = []; let k = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < 16; i++) {
      if (i % 2 === 1 && Math.random() < .55) { phrase.push(null); continue; }      // 反拍常常休息，比較輕鬆
      if (Math.random() < .18) { phrase.push(null); continue; }
      k = Math.max(0, Math.min(PENTA.length - 1, k + [-1, 0, 1, 1, -1, 2, -2][Math.floor(Math.random() * 7)]));
      phrase.push(PENTA[k]);
    }
    phrase[14] = PENTA[Math.random() < .5 ? 0 : 2]; phrase[15] = null;
  }

  function schedule() {
    if (!ctx) return;
    while (next < ctx.currentTime + .25) {
      const t = next, eighth = step % 8, bar = Math.floor(step / 8) % CHORDS.length, ch = CHORDS[bar];
      if (step % 16 === 0) newPhrase();
      const swing = eighth % 2 ? BEAT * .06 : 0;                                   // 一點點搖擺
      mallet(t + swing, N(ch[1 + ARP[eighth]]), eighth % 2 ? .16 : .22, .7);        // 分解和弦
      if (eighth === 0 || eighth === 4) bass(t, N(ch[0]), .5);                      // 低音
      if (eighth % 2 === 1) shaker(t + swing, .05);                                 // 沙鈴
      const m = phrase[step % 16]; if (m) mallet(t + swing, N(m), .28, 1.1);         // 旋律
      step++; next += BEAT / 2;
    }
  }

  function level() {
    if (!ctx) return;
    const v = wanted && !muted && !document.hidden ? (ducked ? 0 : VOL) : 0;
    master.gain.setTargetAtTime(v, ctx.currentTime, ducked ? .25 : .9);            // 淡出快一點、淡入慢慢來
  }
  function run() {
    const c = ensure(); if (!c) return;
    if (!timer) { next = c.currentTime + .1; timer = setInterval(schedule, 90); }
    level();
  }
  function halt() { clearInterval(timer); timer = 0; level(); }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { halt(); } else if (wanted && !muted) run();
  });

  return {
    /** 使用者第一次點畫面時呼叫（瀏覽器規定要有點擊才能出聲） */
    start() { wanted = true; if (!muted) run(); },
    stop() { wanted = false; level(); setTimeout(() => { if (!wanted) halt(); }, 2500); },
    setMuted(v) { muted = v; if (v) { level(); setTimeout(() => { if (muted) halt(); }, 2500); } else if (wanted) run(); },
    /** 坐雲霄飛車時淡出，下車後回來 */
    duck(v) { ducked = !!v; level(); },
    playing: () => !!timer && wanted && !muted,
  };
}
