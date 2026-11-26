// 🎢 雲霄飛車音效：用 Web Audio 即時合成（不需要音檔）
// 坐在車上才有聲音：
//   - 軌道聲：低沉的滾動聲＋輪子壓過軌道接縫的「喀噠喀噠」，越快越大聲、接縫聲越密
//   - 風聲：速度越快越大
//   - 爬坡：鏈條「喀啦喀啦」，坡越陡、車越慢，喀啦聲越慢
//   - 尖叫：衝下大坡、翻大迴圈時，車上的遊客一起「啊～～」
export function createCoasterSound() {
  let ctx = null, master = null, noiseBuf = null, muted = false, live = null, nextJoint = 0, nextChain = 0, lastScream = -99;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
      master = ctx.createGain(); master.gain.value = .7;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); let b = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = .97 * b + .03 * w; d[i] = w * .6 + b * 3; }   // 白噪音加一點低頻（比較像金屬滾動）
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const noise = (c) => { const n = c.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.playbackRate.value = .8 + Math.random() * .4; return n; };

  // 開始坐車：建好一直在響的聲音（滾動、轟隆、風），音量先是 0，之後每一格依速度調
  function start() {
    const c = ensure(); if (!c || live) return;
    const t = c.currentTime;
    const mk = (type, f, q) => { const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; return fl; };
    const rumbleSrc = noise(c), rumbleF = mk('lowpass', 180), rumbleG = c.createGain(); rumbleG.gain.value = 0;
    rumbleSrc.connect(rumbleF); rumbleF.connect(rumbleG); rumbleG.connect(master);
    const roarSrc = noise(c), roarF = mk('bandpass', 500, .9), roarG = c.createGain(); roarG.gain.value = 0;
    roarSrc.connect(roarF); roarF.connect(roarG); roarG.connect(master);
    const windSrc = noise(c), windF = mk('highpass', 1400), windG = c.createGain(); windG.gain.value = 0;
    windSrc.connect(windF); windF.connect(windG); windG.connect(master);
    // 轟隆聲加一點「抖」：輪子不圓、軌道不平
    const wob = c.createOscillator(), wobG = c.createGain(); wob.frequency.value = 9; wobG.gain.value = 0; wob.connect(wobG); wobG.connect(roarG.gain);
    for (const n of [rumbleSrc, roarSrc, windSrc, wob]) n.start(t);
    live = { rumbleF, rumbleG, roarF, roarG, windF, windG, wob, wobG, srcs: [rumbleSrc, roarSrc, windSrc, wob] };
    nextJoint = t + .2; nextChain = t + .1;
  }
  function stop() {
    if (!live || !ctx) { live = null; return; }
    const t = ctx.currentTime, L = live; live = null;
    for (const g of [L.rumbleG, L.roarG, L.windG]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, .15); }
    setTimeout(() => { for (const n of L.srcs) try { n.stop(); } catch (e) { /* 已經停了 */ } }, 900);
  }

  // 一聲短短的「喀」：輪子壓過接縫（低一點、重一點）或鏈條（高一點、脆一點）
  function click(t, o) {
    const c = ctx, n = c.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 1.3;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q || 2.5;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.v, t + .004); g.gain.exponentialRampToValueAtTime(.001, t + o.len);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(t, Math.random() * 1.5); n.stop(t + o.len + .02);
    if (o.tone) {   // 鏈條還有一點金屬「叮」
      const os = c.createOscillator(); os.type = 'square'; os.frequency.value = o.tone;
      const og = c.createGain(); og.gain.setValueAtTime(o.v * .18, t); og.gain.exponentialRampToValueAtTime(.001, t + .05);
      os.connect(og); og.connect(master); os.start(t); os.stop(t + .06);
    }
  }

  // 每一格：v＝速度（公尺/秒）、phase＝lift/ride/brake/dock、grade＝坡度（往上為正）
  function update({ v = 0, phase = 'dock', grade = 0 }) {
    if (!live || !ctx || muted) return;
    const t = ctx.currentTime, k = Math.min(1, v / 14);
    const set = (p, val) => p.setTargetAtTime(val, t, .08);
    set(live.rumbleG.gain, phase === 'dock' ? 0 : .10 + .5 * k);
    set(live.rumbleF.frequency, 120 + 380 * k);
    set(live.roarG.gain, .02 + .38 * k * k);
    set(live.roarF.frequency, 350 + 900 * k);
    set(live.wobG.gain, .05 * k);
    set(live.wob.frequency, 6 + v * 1.4);
    set(live.windG.gain, .55 * k * k * k);
    set(live.windF.frequency, 1200 + 2200 * k);
    // 軌道接縫：每 1.6 公尺一節，前後輪各「喀」一下（喀噠）
    if (v > .4 && phase !== 'dock') {
      if (nextJoint < t) nextJoint = t;
      while (nextJoint < t + .12) {
        const gap = 1.6 / v, vol = .12 + .35 * k;
        click(nextJoint, { f: 900 + 500 * k, v: vol, len: .045, q: 2 });
        click(nextJoint + Math.min(.09, gap * .3), { f: 750 + 400 * k, v: vol * .8, len: .04, q: 2 });
        nextJoint += Math.max(.06, gap);
      }
    }
    // 爬坡鏈條：每 0.25 公尺一個卡齒；坡越陡、車越慢，喀啦聲越慢
    if (phase === 'lift' && v > .2) {
      if (nextChain < t) nextChain = t;
      while (nextChain < t + .12) {
        click(nextChain, { f: 2600 + 600 * Math.random(), v: .28, len: .03, q: 4, tone: 1700 + grade * 300 });
        nextChain += Math.max(.05, .25 / v);
      }
    }
  }

  // 尖叫：n 個遊客一起「啊～～」（鋸齒波＋「啊」的共振峰，音高各不同，先往上衝再抖著往下）
  function scream(n = 3, big = 1) {
    const c = ensure(); if (!c || muted) return;
    const now = c.currentTime; if (now - lastScream < 2.5) return; lastScream = now;
    for (let i = 0; i < n; i++) {
      const t = now + i * .07 + Math.random() * .12, len = 1.6 + Math.random() * 1.1 * big;
      const f0 = [330, 420, 560, 680, 760][Math.floor(Math.random() * 5)] * (.9 + Math.random() * .25);
      const osc = c.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0 * .7, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + .18);
      osc.frequency.linearRampToValueAtTime(f0 * 1.2, t + len * .6);
      osc.frequency.exponentialRampToValueAtTime(f0 * .75, t + len);
      const lfo = c.createOscillator(); lfo.frequency.value = 6 + Math.random() * 3; const lg = c.createGain(); lg.gain.value = f0 * .05; lfo.connect(lg); lg.connect(osc.frequency);
      const g = c.createGain(), vol = (.16 + Math.random() * .08) * big / Math.sqrt(n);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .08); g.gain.setValueAtTime(vol * .9, t + len * .7); g.gain.exponentialRampToValueAtTime(.001, t + len);
      // 「啊」的三個共振峰
      for (const [f, q, a] of [[850 + Math.random() * 150, 7, 1], [1300 + Math.random() * 200, 9, .7], [2900, 10, .35]]) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const ga = c.createGain(); ga.gain.value = a; osc.connect(bp); bp.connect(ga); ga.connect(g);
      }
      // 一點氣音
      const br = c.createBufferSource(); br.buffer = noiseBuf; const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1500; bf.Q.value = 1;
      const bg = c.createGain(); bg.gain.value = .25; br.connect(bf); bf.connect(bg); bg.connect(g);
      g.connect(master);
      osc.start(t); lfo.start(t); br.start(t, Math.random()); osc.stop(t + len + .05); lfo.stop(t + len + .05); br.stop(t + len + .05);
    }
  }

  return {
    start, stop, update, scream,
    unlock: () => ensure(),
    setMuted(v) { muted = v; if (master && ctx) master.gain.setTargetAtTime(v ? 0 : .7, ctx.currentTime, .05); },
    active: () => !!live,
  };
}
