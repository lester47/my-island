// 貓咪聲音：用 Web Audio 即時合成（不需要音檔）
// meow 喵、purr 呼嚕、chirp 啾、yawn 哈欠、happy 開心連喵、grumble 不耐煩
export function createMeowBox() {
  let ctx = null, master = null, muted = false, noiseBuf = null;
  const purrs = new Set();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = .55;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const ready = () => { const c = ensure(); return c && !muted ? c : null; };

  // 喵：鋸齒波 → 兩個共振峰（m-i-a-o 的嘴形變化）
  function meow(pitch = 1, o = {}) {
    const c = ready(); if (!c) return;
    const len = o.len ?? .55, rise = o.rise ?? 1.22, fall = o.fall ?? .74, vol = o.vol ?? 1, open = o.open ?? 1;
    const t = c.currentTime + (o.delay || 0), f0 = 540 * pitch;
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * .82, t);
    osc.frequency.linearRampToValueAtTime(f0 * rise, t + len * .32);
    osc.frequency.linearRampToValueAtTime(f0 * fall, t + len);
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5; const lg = c.createGain(); lg.gain.value = f0 * .018; lfo.connect(lg); lg.connect(osc.frequency);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 3.2;
    f1.frequency.setValueAtTime(650, t); f1.frequency.linearRampToValueAtTime(1350 * open, t + len * .38); f1.frequency.linearRampToValueAtTime(620, t + len);
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 5;
    f2.frequency.setValueAtTime(2100, t); f2.frequency.linearRampToValueAtTime(2800, t + len * .38); f2.frequency.linearRampToValueAtTime(1900, t + len);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = c.createGain(), v = .9 * vol;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .045);
    g.gain.setValueAtTime(v, t + len * .55); g.gain.exponentialRampToValueAtTime(.0008, t + len);
    const m1 = c.createGain(); m1.gain.value = 1.6; const m2 = c.createGain(); m2.gain.value = .6; const m3 = c.createGain(); m3.gain.value = .12;
    osc.connect(f1); f1.connect(m1); m1.connect(g);
    osc.connect(f2); f2.connect(m2); m2.connect(g);
    osc.connect(lp); lp.connect(m3); m3.connect(g);
    g.connect(master);
    osc.start(t); lfo.start(t); osc.stop(t + len + .05); lfo.stop(t + len + .05);
  }

  // 呼嚕：低頻嗡嗡聲＋每秒約 25 下的顫動，配上吸氣吐氣的起伏
  function purr(pitch = 1, dur = 2.4) {
    const c = ready(); if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 46 / Math.sqrt(pitch);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 1.2;
    const og = c.createGain(); og.gain.value = .55; const ng = c.createGain(); ng.gain.value = .5;
    osc.connect(og); og.connect(lp); src.connect(ng); ng.connect(lp);
    const am = c.createGain(); am.gain.value = .5;
    const flutter = c.createOscillator(); flutter.type = 'triangle'; flutter.frequency.value = 23 + pitch * 3;
    const fg = c.createGain(); fg.gain.value = .5; flutter.connect(fg); fg.connect(am.gain);
    const env = c.createGain(); env.gain.setValueAtTime(0, t);
    const cyc = .95;                                    // 一吸一吐
    for (let k = 0; k * cyc < dur; k++) {
      const s = t + k * cyc;
      env.gain.linearRampToValueAtTime(k % 2 ? .75 : 1, s + cyc * .45);
      env.gain.linearRampToValueAtTime(.35, s + cyc * .95);
    }
    env.gain.linearRampToValueAtTime(0, t + dur + .15);
    lp.connect(am); am.connect(env); env.connect(master);
    const nodes = [src, osc, flutter];
    nodes.forEach((n) => { n.start(t); n.stop(t + dur + .2); });
    const h = { nodes, env }; purrs.add(h); setTimeout(() => purrs.delete(h), (dur + .3) * 1000);
  }

  // 啾：短促上揚的「mrrp」
  function chirp(pitch = 1, times = 2) {
    const c = ready(); if (!c) return;
    for (let i = 0; i < times; i++) {
      const t = c.currentTime + i * .16, f = 700 * pitch;
      const osc = c.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * .8, t); osc.frequency.exponentialRampToValueAtTime(f * 1.7, t + .1);
      const trill = c.createOscillator(); trill.frequency.value = 38; const tg = c.createGain(); tg.gain.value = f * .08; trill.connect(tg); tg.connect(osc.frequency);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.4;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.75, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .13);
      osc.connect(bp); bp.connect(g); g.connect(master);
      osc.start(t); trill.start(t); osc.stop(t + .15); trill.stop(t + .15);
    }
  }
  // 叫號的叮咚聲
  function chime() {
    const c = ready(); if (!c) return;
    [[880, 0], [698.5, .32]].forEach(([f, d]) => {
      const t = c.currentTime + d, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.01;
      const g2 = c.createGain(); g2.gain.value = .25; o2.connect(g2); g2.connect(g); o.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.55, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + 1.1);
      g.connect(master); o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2);
    });
  }
  const yawn = (p = 1) => meow(p * .82, { len: 1.15, rise: 1.08, fall: .55, open: 1.25, vol: .75 });
  const happy = (p = 1) => { meow(p * 1.12, { len: .26, rise: 1.4, fall: 1.05 }); meow(p * 1.2, { len: .34, rise: 1.45, fall: .9, delay: .3 }); };
  const grumble = (p = 1) => meow(p * .68, { len: .5, rise: .96, fall: .66, open: .7, vol: .8 });

  return {
    meow, purr, chirp, yawn, happy, grumble, chime,
    unlock() { ensure(); },
    get muted() { return muted; },
    setMuted(v) {
      muted = !!v;
      if (muted && ctx) for (const h of purrs) { try { h.env.gain.cancelScheduledValues(ctx.currentTime); h.env.gain.setValueAtTime(0, ctx.currentTime); } catch (e) { /* 已停止 */ } }
    },
  };
}
