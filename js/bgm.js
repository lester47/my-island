// 🎵 市集背景音樂：用 Web Audio 即時合成（不需要音檔），淡淡的
//   - 有 4 種曲風可以選（設定 → 🎵 曲風），也可以「跟著白天晚上自動換」；音量可以調
//   - 木琴般的分解和弦＋小旋律（五聲音階，每次都有一點不一樣），低音、沙鈴很小聲
//   - 坐雲霄飛車時自動淡出（不跟軌道聲、尖叫互相干擾），下車後再慢慢回來
//   - 分頁切到背景時暫停，省電
const VOL = .085;                                          // 音量 100% 時的大小（本來就很淡）
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);          // MIDI 音高 → 頻率
// 曲風：bpm 速度、chords 和弦（[低音, 和弦內音…]，每小節一個）、scale 旋律音階、arp 分解和弦順序、
//       swing 搖擺、mel 旋律多常出現（0～1）、tone 木琴泛音、shaker 沙鈴、bassBeats 低音踩哪幾個八分音符
export const STYLES = {
  market: { icon: '🌴', name: '輕鬆市集', bpm: 96, swing: .06, mel: .6, tone: 4.01, shaker: .05, bassBeats: [0, 4],
    chords: [[48, 60, 64, 67], [43, 59, 62, 67], [45, 57, 60, 64], [41, 57, 60, 65]], scale: [72, 74, 76, 79, 81, 84], arp: [0, 1, 2, 1, 0, 2, 1, 2] },
  fun: { icon: '🎪', name: '熱鬧遊樂園', bpm: 124, swing: 0, mel: .8, tone: 3.01, shaker: .07, bassBeats: [0, 2, 4, 6],
    chords: [[48, 60, 64, 67], [41, 60, 65, 69], [43, 59, 62, 67], [48, 60, 64, 67]], scale: [72, 74, 76, 77, 79, 81, 84], arp: [0, 2, 1, 2, 0, 2, 1, 2] },
  night: { icon: '🌙', name: '晚安星空', bpm: 72, swing: .04, mel: .35, tone: 5.02, shaker: 0, bassBeats: [0],
    chords: [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]], scale: [69, 72, 74, 76, 79, 81], arp: [0, 1, 2, 3, 2, 1, 2, 1] },
  temple: { icon: '🏮', name: '廟口夜市', bpm: 104, swing: .03, mel: .7, tone: 2.76, shaker: .04, bassBeats: [0, 3, 4],
    chords: [[50, 62, 66, 69], [50, 62, 64, 69], [45, 57, 62, 66], [47, 59, 62, 66]], scale: [74, 76, 78, 81, 83, 86], arp: [0, 1, 0, 2, 1, 0, 2, 1] },
};
export function createBgm() {
  let ctx = null, master = null, bus = null, noiseBuf = null, timer = 0, next = 0, step = 0;
  let wanted = false, muted = false, ducked = false, phrase = [], vol = 1, styleId = 'market', st = STYLES.market;
  const BEAT = () => 60 / st.bpm;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      // 一點點空間感：短的回聲
      bus = ctx.createGain(); bus.connect(master);
      const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
      dl.delayTime.value = .47; fb.gain.value = .28; wet.gain.value = .22; lp.type = 'lowpass'; lp.frequency.value = 2200;
      bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // 木琴：基音＋高 4 倍的泛音（很快消失），聲音短短圓圓的
  function mallet(t, f, v, len = .9) {
    const c = ctx, g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(.0008, t + len);
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * st.tone;   // 泛音不同，聽起來像不同的敲擊樂器
    const g2 = c.createGain(); g2.gain.setValueAtTime(.35, t); g2.gain.exponentialRampToValueAtTime(.001, t + .12);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
    o1.start(t); o2.start(t); o1.stop(t + len + .05); o2.stop(t + .15);
  }
  function bass(t, f, v) {
    const c = ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + BEAT() * 1.6);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + BEAT() * 1.7);
  }
  function shaker(t, v) {
    const c = ctx, n = c.createBufferSource(); n.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random() * .3); n.stop(t + .08);
  }
  // 每兩小節換一句旋律：大多走和弦內音附近，偶爾休息，最後落在穩定的音
  function newPhrase() {
    const P = st.scale; phrase = []; let k = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < 16; i++) {
      if (i % 2 === 1 && Math.random() < .55) { phrase.push(null); continue; }      // 反拍常常休息，比較輕鬆
      if (Math.random() > st.mel) { phrase.push(null); continue; }                   // 曲風決定旋律多寡
      k = Math.max(0, Math.min(P.length - 1, k + [-1, 0, 1, 1, -1, 2, -2][Math.floor(Math.random() * 7)]));
      phrase.push(P[k]);
    }
    phrase[14] = P[Math.random() < .5 ? 0 : 2]; phrase[15] = null;
  }

  function schedule() {
    if (!ctx) return;
    while (next < ctx.currentTime + .25) {
      const t = next, eighth = step % 8, bar = Math.floor(step / 8) % st.chords.length, ch = st.chords[bar];
      if (step % 16 === 0) newPhrase();
      const swing = eighth % 2 ? BEAT() * st.swing : 0;                             // 一點點搖擺
      const tone = ch[1 + (st.arp[eighth] % (ch.length - 1))];
      mallet(t + swing, N(tone), eighth % 2 ? .16 : .22, styleId === 'night' ? 1.4 : .7);   // 分解和弦（星空版拖長一點）
      if (st.bassBeats.includes(eighth)) bass(t, N(ch[0]), .5);                     // 低音
      if (st.shaker && eighth % 2 === 1) shaker(t + swing, st.shaker);              // 沙鈴
      const m = phrase[step % 16]; if (m) mallet(t + swing, N(m), .28, 1.1);         // 旋律
      step++; next += BEAT() / 2;
    }
  }

  function level() {
    if (!ctx) return;
    const v = wanted && !muted && !document.hidden ? (ducked ? 0 : VOL * vol) : 0;
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
    /** 換曲風（STYLES 的 key）：從下一小節開始換，換的時候新的一句旋律 */
    setStyle(id) { if (!STYLES[id] || id === styleId) return; styleId = id; st = STYLES[id]; step = Math.ceil(step / 8) * 8; phrase = []; },
    style: () => styleId,
    /** 音量 0～1（1＝原本的大小） */
    setVolume(v) { vol = Math.max(0, Math.min(1.5, +v || 0)); level(); },
  };
}
