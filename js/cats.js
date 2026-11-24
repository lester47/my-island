// 島上的貓：每座島一隻，會散步、坐、舔毛、睡覺；被擼的時候有 10 種反應
import * as THREE from 'three';
import { TAU, clamp, lerp, rng, mat, GEO } from './kit.js?v=20261125a';
import { H } from './world.js?v=20261125a';

// ------------------------------------------------------------------ 反應清單
export const REACTIONS = {
  purr:    { name: '瞇眼呼嚕', icon: '😽', dur: 2.6, text: '{n}瞇起眼睛，呼嚕呼嚕～' },
  belly:   { name: '翻肚肚',   icon: '🙃', dur: 2.9, text: '{n}咕嚕一聲翻過來，露出軟軟的肚子！' },
  rub:     { name: '蹭蹭你',   icon: '🥰', dur: 2.2, text: '{n}用頭蹭蹭你的手，好黏人～' },
  stretch: { name: '伸懶腰',   icon: '🧘', dur: 2.4, text: '{n}伸了一個好長好長的懶腰～' },
  tail:    { name: '尾巴豎直', icon: '✨', dur: 2.0, text: '{n}的尾巴豎得直直的，尾巴尖抖抖抖！' },
  knead:   { name: '踩奶',     icon: '🐾', dur: 2.6, text: '{n}開始用前腳踩奶，左踩右踩～' },
  roll:    { name: '打滾',     icon: '🌀', dur: 2.5, text: '{n}在地上滾來滾去，好開心！' },
  meow:    { name: '抬頭喵喵', icon: '🎵', dur: 1.9, text: '{n}抬起頭對你「喵～」了一聲！' },
  yawn:    { name: '打哈欠',   icon: '🥱', dur: 2.4, text: '{n}張大嘴巴，打了一個大哈欠～' },
  spin:    { name: '跳起來轉圈', icon: '🎉', dur: 1.7, text: '{n}開心到跳起來轉了一圈！' },
};
export const REACTION_IDS = Object.keys(REACTIONS);
// 每種反應配的聲音
export function playReaction(sound, id, p = 1) {
  ({ purr: () => sound.purr(p, 2.4), belly: () => sound.chirp(p, 2), rub: () => sound.meow(p, { len: .38, rise: 1.1, fall: .8 }), stretch: () => sound.meow(p * .9, { len: .8, rise: 1.05, fall: .7, open: .8 }),
    tail: () => sound.chirp(p, 3), knead: () => sound.purr(p, 2.5), roll: () => sound.meow(p * 1.05, { len: .5, rise: 1.3 }), meow: () => sound.meow(p, { len: .75, rise: 1.3, fall: .7 }),
    yawn: () => sound.yawn(p), spin: () => sound.happy(p) })[id]?.();
}
const MOOD_MAX = 7;           // 開心值超過這個，貓會覺得「摸夠了」
const COOL = 9;               // 摸夠了要休息幾秒

// ------------------------------------------------------------------ 小圖示貼圖（愛心、音符、Zz、腳印、星星、煙）
function iconTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.lineJoin = 'round'; x.lineWidth = 8; x.strokeStyle = '#ffffff';
  if (kind === 'heart') {
    x.beginPath(); x.moveTo(64, 108); x.bezierCurveTo(10, 72, 12, 26, 40, 22); x.bezierCurveTo(54, 20, 62, 30, 64, 40); x.bezierCurveTo(66, 30, 74, 20, 88, 22); x.bezierCurveTo(116, 26, 118, 72, 64, 108); x.closePath();
    x.fillStyle = '#ff5f86'; x.stroke(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(42, 42, 9, 6, -.6, 0, TAU); x.fill();
  } else if (kind === 'paw') {
    x.fillStyle = '#ff9fbc';
    const blob = (cx, cy, rx, ry) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.stroke(); x.fill(); };
    blob(64, 80, 28, 24); blob(30, 50, 12, 15); blob(52, 34, 12, 15); blob(76, 34, 12, 15); blob(98, 50, 12, 15);
  } else if (kind === 'star') {
    x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 54, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath();
    x.fillStyle = '#ffd23f'; x.stroke(); x.fill();
  } else if (kind === 'puff') {
    x.fillStyle = '#d9dde3'; for (const [cx, cy, r] of [[44, 70, 26], [70, 56, 30], [88, 76, 22]]) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); x.fill(); }
  } else {
    const t = kind === 'note' ? '♪' : 'Z';
    x.font = `900 ${kind === 'note' ? 104 : 92}px "Noto Sans TC", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = kind === 'note' ? '#8a5cd0' : '#4d7fd6'; x.lineWidth = 10; x.strokeText(t, 64, 68); x.fillText(t, 64, 68);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

// ------------------------------------------------------------------ 貓的模型（原創低多邊形）
function makeCat(look, sc) {
  const L = look, chub = L.chubby ? 1.18 : 1;
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = .28; g.add(body);       // 旋轉中心＝身體中間
  const inner = new THREE.Group(); inner.position.y = -.28; body.add(inner);
  const add = (geo, c, x, y, z, sx, sy, sz, parent, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, mat(c)); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.castShadow = true; parent.add(o); return o;
  };
  const base = L.base, belly = L.belly || '#ffffff';
  // 軀幹：以後腰為支點，坐下時前半身抬起
  const trunk = new THREE.Group(); trunk.position.set(0, .3, -.2); inner.add(trunk);
  add(GEO.sph, base, 0, .03, .2, .42 * chub, .37 * chub, .7, trunk);
  add(GEO.sph, belly, 0, -.04, .27, .3 * chub, .26 * chub, .52, trunk);
  add(GEO.sph, base, 0, .08, .4, .36 * chub, .36, .3, trunk);              // 胸口
  add(GEO.sph, belly, 0, .04, .5, .22, .26, .14, trunk);                   // 胸前白毛
  // 花紋
  if (L.pattern === 'tabby' || L.pattern === 'tuft') {
    const n = L.pattern === 'tabby' ? 4 : 2;
    for (let i = 0; i < n; i++) add(GEO.box, L.stripe, 0, .2 * chub, .02 + i * .13, .34 * chub, .05, .045, trunk, 0, 0, 0);
  }
  if (L.pattern === 'calico') {
    add(GEO.sph, L.patchA, .1, .14, .08, .26, .2, .32, trunk); add(GEO.sph, L.patchB, -.11, .15, .32, .22, .17, .24, trunk);
    add(GEO.sph, L.patchB, .06, .12, -.08, .2, .14, .18, trunk);
  }
  // 頭
  const head = new THREE.Group(); head.position.set(0, .3, .5); trunk.add(head);
  add(GEO.sph, base, 0, 0, 0, .5 * (L.chubby ? 1.08 : 1), .42, .42, head);
  add(GEO.sph, belly, 0, -.08, .15, .26, .15, .14, head);                 // 嘴邊白毛
  if (L.pattern === 'tuxedo') add(GEO.cone4, belly, 0, .02, .19, .1, .2, .04, head, 0, Math.PI / 4, 0);
  if (L.pattern === 'tabby') for (const dx of [-.06, 0, .06]) add(GEO.box, L.stripe, dx, .17, .14, .025, .1, .03, head, -.5);
  if (L.pattern === 'tuft') add(GEO.cone4, L.tuft, 0, .22, .07, .09, .14, .06, head, -.4, Math.PI / 4);
  if (L.pattern === 'calico') add(GEO.sph, L.patchA, .12, .1, .05, .22, .2, .3, head);
  const ears = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * .14, .17, -.01); head.add(p);
    const ec = L.pattern === 'calico' ? (s < 0 ? L.patchB : L.patchA) : base;
    add(GEO.cone4, ec, 0, .07, 0, .15, .17, .09, p, 0, Math.PI / 4, s * -.18);
    add(GEO.cone4, '#ffb3c1', s * -.005, .055, .025, .08, .1, .03, p, 0, Math.PI / 4, s * -.18);
    return p;
  });
  const eyes = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * .1, .03, .185); head.add(p);
    add(GEO.sph, '#231a16', 0, 0, 0, .085, .1, .04, p);
    add(GEO.sph, '#ffffff', s * -.013, .022, .016, .028, .03, .015, p);
    return p;
  });
  for (const s of [-1, 1]) add(GEO.sph, '#ffa0b4', s * .16, -.06, .15, .07, .04, .03, head);
  add(GEO.sph, '#ff8fa7', 0, -.035, .218, .05, .035, .03, head);         // 鼻子
  const mouth = add(GEO.sph, '#8c3b46', 0, -.1, .205, .065, .015, .03, head);
  for (const s of [-1, 1]) for (const k of [-1, 0, 1]) add(GEO.box, '#5a4a45', s * .2, -.07 + k * .02, .16, .16, .006, .006, head, 0, s * .2, s * k * .2);
  // 腳
  const leg = (parent, x, y, z, c) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); add(GEO.cyl8, c, 0, -.15, 0, .11, .3, .11, p); add(GEO.sph, belly, 0, -.29, .02, .13, .07, .15, p); return p; };
  const legC = L.pattern === 'tuxedo' ? base : base;
  const legsF = [-1, 1].map((s) => leg(trunk, s * .11 * chub, 0, .42, legC));
  const legsB = [-1, 1].map((s) => leg(inner, s * .13 * chub, .3, -.2, legC));
  // 尾巴：6 節，可以豎起、捲、搖
  const tail = []; let parent = trunk;
  const tailBase = new THREE.Group(); tailBase.position.set(0, .1, -.16); trunk.add(tailBase); parent = tailBase;
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group(); if (i) p.position.y = .11; parent.add(p);
    const tc = L.pattern === 'tabby' && i % 2 ? L.stripe : (L.pattern === 'calico' && i > 3 ? L.patchB : base);
    add(GEO.cyl8, i === 5 && L.pattern === 'tuxedo' ? belly : tc, 0, .055, 0, .075 - i * .004, .13, .075 - i * .004, p);
    tail.push(p); parent = p;
  }
  // 配件
  const col = L.collar || '#dc4848';
  add(new THREE.TorusGeometry(.5, .12, 6, 14), col, 0, .2, .46, .44, .44, .5, trunk, Math.PI / 2 - .5);
  if (L.extra === 'bell') add(GEO.sph, '#ffd23f', 0, .1, .6, .09, .09, .09, trunk);
  if (L.extra === 'bolt') add(GEO.cone4, '#f5c518', 0, .08, .6, .07, .14, .04, trunk, 0, Math.PI / 4, .5);
  if (L.extra === 'bow') { for (const s of [-1, 1]) add(GEO.cone4, col, .13 + s * .055, .21, -.02, .08, .11, .06, head, 0, 0, s * Math.PI / 2); add(GEO.sph, '#ffd1ef', .13, .21, -.02, .045, .045, .045, head); }
  if (L.extra === 'glasses') { for (const s of [-1, 1]) add(new THREE.TorusGeometry(.5, .1, 6, 14), '#3a2d28', s * .1, .03, .215, .15, .15, .15, head); add(GEO.box, '#3a2d28', 0, .03, .215, .06, .012, .012, head); }
  if (L.extra === 'scarf') { add(GEO.box, col, .1, .06, .55, .1, .22, .03, trunk, -.3, 0, .2); add(GEO.sph, '#ff8a3d', .12, -.04, .57, .07, .05, .04, trunk); }
  if (L.extra === 'bandana') add(GEO.cone4, col, 0, .08, .55, .3, .22, .06, trunk, Math.PI, Math.PI / 4, 0);
  // 點擊判定
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.85, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, .45, .15); g.add(hit);
  g.scale.setScalar(1.08 * sc);
  return { g, body, inner, trunk, head, ears, eyes, mouth, legsF, legsB, tailBase, tail, hit };
}

// 一組姿勢參數（目前值會平滑追上目標值）
const POSE0 = { sit: 0, low: 0, lean: 0, roll: 0, rollY: 0, jump: 0, spin: 0, buzz: 0, bodyRY: 0, headRX: 0, headRY: 0, headRZ: 0, eye: 1, mouth: 0, ear: 0, tailUp: .35, tailCurl: .1, tailWag: .12, wagSp: 2, lf0: 0, lf1: 0, lb0: 0, lb1: 0 };
const SNAP = new Set(['spin', 'jump', 'buzz', 'lf0', 'lf1', 'lb0', 'lb1', 'roll']);   // 這些直接套用，不平滑
const bell = (k, a = .15, b = .85) => k < a ? k / a : k > b ? (1 - k) / (1 - b) : 1;
const easeIO = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ------------------------------------------------------------------ 主程式
export function createCats(W, content, opts = {}) {
  const { scene, islands } = W;
  const r = rng(2026);
  const cats = [], pickables = [];
  // 預設走在石板小路外側；有找到空地（setHomes）就在空地附近小範圍散步，不會鑽進攤位或裝飾裡
  const ringR = (I, c) => (c && c.home ? .55 : I.ring + 1.2);
  for (const d of content.cats || []) {
    const I = islands[d.island]; if (!I) continue;
    const M = makeCat(d.look, d.scale || 1); scene.add(M.g);
    const c = {
      data: d, island: I, M, ang: r() * TAU, dir: r() < .5 ? 1 : -1, state: 'sit', timer: 2 + r() * 3,
      pose: { ...POSE0 }, target: { ...POSE0 }, heading: 0, react: null, mood: 0, pets: 0, coolUntil: 0, walkPh: r() * 10,
      talking: false, celebrate: 0,
    };
    cats.push(c); pickables.push({ obj: M.hit, cat: c });
  }

  // 粒子
  const TEX = Object.fromEntries(['heart', 'note', 'z', 'paw', 'star', 'puff'].map((k) => [k, iconTex(k)]));
  const sprites = [];
  function puff(kind, pos, n = 1, spread = .5) {
    for (let i = 0; i < n; i++) {
      let s = sprites.find((x) => !x.alive);
      if (!s) { if (sprites.length > 60) return; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); sp.renderOrder = 5; scene.add(sp); s = { sp }; sprites.push(s); }
      s.sp.material.map = TEX[kind]; s.sp.material.needsUpdate = true;
      s.sp.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * spread, Math.random() * .2, (Math.random() - .5) * spread));
      s.v = new THREE.Vector3((Math.random() - .5) * .5, .7 + Math.random() * .5, (Math.random() - .5) * .5);
      s.life = 0; s.max = kind === 'z' ? 2.2 : 1.4; s.kind = kind; s.alive = true; s.sp.visible = true; s.size = kind === 'puff' ? .4 : .3;
    }
  }
  const headPos = (c) => c.M.head.getWorldPosition(new THREE.Vector3());

  // ---------------------------------------------------------------- 擼貓
  const pick = (c) => {
    const d = c.data, likes = d.likes || [];
    let pool = REACTION_IDS.filter((k) => k !== c.lastReact);
    if (d.id === 'baobao' && c.pets < 4) pool = pool.filter((k) => k !== 'belly' && k !== 'roll');   // 害羞：熟了才翻肚
    if (opts.reduced && opts.reduced()) pool = pool.filter((k) => k !== 'spin' && k !== 'roll' && k !== 'belly');
    const w = pool.map((k) => (likes.includes(k) ? 3 : 1));
    let s = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { s -= w[i]; if (s <= 0) return pool[i]; }
    return pool[0];
  };
  // 回傳 { kind: 'react'|'leave'|'cool'|'busy', id, text }
  function pet(c, sound) {
    const now = performance.now() / 1000;
    if (now < c.coolUntil) return { kind: 'cool', left: Math.ceil(c.coolUntil - now) };
    const busy = c.react && c.react.id !== 'leave' && now - c.react.t0 < c.react.dur * .55;
    if (busy) { puff('heart', headPos(c), 1, .4); return { kind: 'busy' }; }   // 動作還沒做完：不算新的一下
    c.mood += 1; c.pets += 1;
    if (c.mood > MOOD_MAX) {
      c.mood = 0; c.coolUntil = now + COOL; c.react = { id: 'leave', t0: now, dur: 1.4 };
      c.state = 'leave'; c.timer = 3.2; c.dir = Math.random() < .5 ? 1 : -1;
      sound && sound.grumble(c.data.pitch);
      puff('puff', headPos(c), 2, .3);
      return { kind: 'leave', text: `${c.data.name}甩甩尾巴走開了……牠想休息一下，等一下再輕輕摸牠吧。` };
    }
    if (c.react && c.react.id !== 'leave' && now - c.react.t0 < c.react.dur * .55) {   // 動作做到一半：只加愛心
      puff('heart', headPos(c), 1, .4);
      return { kind: 'busy' };
    }
    const wasAsleep = c.state === 'sleep';
    const id = wasAsleep ? 'yawn' : pick(c);
    c.lastReact = id; c.state = 'sit';
    c.react = { id, t0: now, dur: REACTIONS[id].dur, side: Math.random() < .5 ? -1 : 1, fx: 0 };
    if (sound) playReaction(sound, id, c.data.pitch || 1);
    const text = wasAsleep ? `${c.data.name}被你摸醒了，打了一個大哈欠～` : REACTIONS[id].text.replace('{n}', c.data.name);
    return { kind: 'react', id, text };
  }
  // 別人（同時在線的玩家）擼了這隻貓：在我的畫面上播同一個反應
  function remote(c, id, sound) {
    const now = performance.now() / 1000;
    if (id === 'leave') { scare(c, sound); return; }
    if (!REACTIONS[id] || now < c.coolUntil) return;
    if (c.react && c.react.id !== 'leave' && now - c.react.t0 < c.react.dur * .55) { puff('heart', headPos(c), 1, .4); return; }
    c.mood += 1; c.pets += 1;
    c.state = 'sit'; c.lastReact = id;
    c.react = { id, t0: now, dur: REACTIONS[id].dur, side: Math.random() < .5 ? -1 : 1, fx: 0 };
    if (sound) playReaction(sound, id, c.data.pitch || 1);
  }
  // 被欺負（摸太快太用力）：嚇一跳跑走，休息一陣子
  function scare(c, sound) {
    const now = performance.now() / 1000;
    if (c.state === 'leave') return;
    c.mood = 0; c.coolUntil = now + COOL; c.react = { id: 'leave', t0: now, dur: 1.4 };
    c.state = 'leave'; c.timer = 3.2; c.dir = Math.random() < .5 ? 1 : -1;
    if (sound) sound.grumble(c.data.pitch);
    puff('puff', headPos(c), 2, .3);
  }
  function celebrate(sound) {
    cats.forEach((c, i) => { c.celebrate = performance.now() / 1000 + i * .25; if (sound) setTimeout(() => sound.happy(c.data.pitch), i * 250); });
  }

  // ---------------------------------------------------------------- 每幀
  const camPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  function update(t, dt, moving, night, camera) {
    dt = Math.min(dt, .05);
    camera.getWorldPosition(camPos);
    const now = performance.now() / 1000, isNight = night > .7;
    for (const c of cats) {
      const I = c.island, M = c.M, T = c.target;
      Object.assign(T, POSE0);
      T.tailWag = .1; T.wagSp = 1.6;
      c.mood = Math.max(0, c.mood - dt * .55);
      let walking = false, faceCam = false;
      // ---- 日常狀態
      if (c.react && now - c.react.t0 > c.react.dur) c.react = null;
      if (c.state === 'leave') {
        c.timer -= dt; walking = c.timer > .8;
        if (walking) c.ang += c.dir * dt * 2.1 / ringR(I, c);
        T.ear = 1; T.tailUp = .1; T.tailWag = .45; T.wagSp = 9; T.eye = .55;
        if (c.timer <= 0) { c.state = 'sulk'; c.timer = Math.max(1, c.coolUntil - now); }
      } else if (c.state === 'sulk') {
        c.timer -= dt; T.sit = 1; T.ear = .6; T.tailWag = .25; T.wagSp = 5; T.eye = .6;
        if (c.timer <= 0) c.state = 'sit';
      } else if (c.talking || c.react || c.held) {
        c.state = c.state === 'sleep' && !c.react ? 'sleep' : 'sit';
        if (c.state === 'sleep') { T.low = 1; T.eye = 0; T.tailUp = 0; T.tailCurl = .5; T.tailWag = 0; }
        else { T.sit = 1; T.tailWag = .22; T.wagSp = 2.2; faceCam = c.talking; }
      } else if (isNight) {
        c.state = 'sleep';
      } else if (moving) {
        c.timer -= dt;
        if (c.timer < 0) {
          const roll = r();
          if (c.state === 'walk') { c.state = roll < .45 ? 'sit' : roll < .75 ? 'groom' : 'loaf'; c.timer = 3 + r() * 5; }
          else { c.state = 'walk'; c.timer = 2.5 + r() * 4; if (r() < .4) c.dir *= -1; }
        }
        if (c.state === 'sleep') { c.state = 'sit'; c.timer = 2; }
      }
      if (c.state === 'walk' && moving && !c.talking && !c.react) { walking = true; c.ang += c.dir * dt * .75 / ringR(I, c); }
      if (c.state === 'sit' && !c.talking && !c.react) { T.sit = 1; T.headRY = moving ? Math.sin(t * .7 + c.walkPh) * .45 : 0; }
      if (c.state === 'groom' && !c.talking && !c.react) {
        T.sit = 1; T.headRX = .35; T.headRZ = .25; T.eye = .25;
        if (moving) { T.lf1 = -1.7 + Math.sin(t * 6) * .25; T.headRY = -.3 + Math.sin(t * 6) * .1; }
      }
      if (c.state === 'loaf' && !c.talking && !c.react) { T.low = 1; T.eye = moving ? (Math.sin(t * .5 + c.walkPh) > .6 ? .15 : .9) : .9; T.tailUp = 0; T.tailCurl = .4; T.tailWag = .06; }
      if (c.state === 'sleep') {
        T.low = 1; T.eye = 0; T.tailUp = 0; T.tailCurl = .55; T.tailWag = 0; T.headRX = .25;
        T.buzz = Math.sin(t * 1.6) * .012;
        if (moving && Math.random() < dt * .45) puff('z', headPos(c).add(tmp.set(0, .3, 0)), 1, .1);
      }
      if (walking) {
        c.walkPh += dt * (c.state === 'leave' ? 14 : 8);
        const s = Math.sin(c.walkPh);
        T.lf0 = s * .55; T.lf1 = -s * .55; T.lb0 = -s * .5; T.lb1 = s * .5; T.buzz = Math.abs(s) * .025;
        T.tailUp = c.state === 'leave' ? .1 : .75; T.tailCurl = .25;
      }
      // ---- 擼貓反應
      if (c.react && c.react.id !== 'leave') {
        const R = c.react, tt = now - R.t0, k = clamp(tt / R.dur, 0, 1), e = bell(k), side = R.side;
        const head = () => headPos(c);
        const every = (sec, fn) => { const n = Math.floor(tt / sec); if (n > R.fx) { R.fx = n; fn(); } };
        switch (R.id) {
          case 'purr': T.eye = .08; T.headRZ = Math.sin(tt * 2.2) * .18 * e; T.headRX = .1; T.buzz = Math.sin(tt * 90) * .006; T.ear = .15; every(.55, () => puff('heart', head(), 1, .35)); break;
          case 'belly': T.sit = 0; T.roll = side * 2.75 * easeIO(bell(k, .22, .8)); T.low = .2; T.eye = .5; T.mouth = .35 * e; T.lf0 = Math.sin(tt * 9) * .5 * e; T.lf1 = -Math.sin(tt * 9) * .5 * e; T.lb0 = Math.sin(tt * 7) * .4 * e; T.lb1 = -T.lb0; T.tailWag = .3; T.wagSp = 5; every(.5, () => puff('heart', head(), 1, .4)); break;
          case 'rub': T.sit = .6; T.bodyRY = Math.sin(tt * 5.5) * .35 * e; T.headRZ = Math.sin(tt * 5.5) * .35 * e; T.headRX = .2; T.eye = .25; T.tailUp = .9; every(.5, () => puff('heart', head(), 1, .3)); break;
          case 'stretch': T.sit = 0; T.lean = .55 * e; T.lf0 = T.lf1 = -1.15 * e; T.tailUp = 1; T.tailCurl = .25; T.eye = 1 - .75 * e; T.mouth = k > .35 && k < .7 ? .7 : 0; T.headRX = -.25 * e; T.ear = .3 * e; break;
          case 'tail': T.sit = 0; T.tailUp = 1; T.tailCurl = .32; T.tailWag = .07; T.wagSp = 32; T.eye = 1; T.headRX = -.15; every(.45, () => puff('star', head(), 1, .6)); break;
          case 'knead': { T.sit = 1; T.eye = .15; const s = Math.sin(tt * 7); T.lf0 = -.35 - Math.max(0, s) * .7; T.lf1 = -.35 - Math.max(0, -s) * .7; T.headRX = .1; T.ear = .1; every(.6, () => puff('paw', M.legsF[R.fx % 2].getWorldPosition(new THREE.Vector3()).add(tmp.set(0, -.15, 0)), 1, .15)); every(.6, () => puff('heart', head(), 1, .3)); break; }
          case 'roll': T.sit = 0; T.low = .75; T.roll = side * Math.sin(k * TAU * 1.5) * 2.1 * bell(k, .1, .9); T.eye = .4; T.mouth = .3; T.lf0 = Math.sin(tt * 8) * .5; T.lf1 = -T.lf0; T.lb0 = Math.sin(tt * 6) * .4; T.lb1 = -T.lb0; T.tailWag = .4; T.wagSp = 6; every(.5, () => puff('heart', head(), 1, .5)); break;
          case 'meow': T.sit = 1; T.headRX = -.4 * e; T.mouth = k > .15 && k < .6 ? 1 : 0; T.eye = 1; T.tailWag = .2; every(.6, () => puff('note', head(), 1, .4)); break;
          case 'yawn': T.sit = 1; T.headRX = -.45 * e; T.mouth = bell(k, .3, .65); T.eye = 1 - bell(k, .25, .75); T.ear = .35 * e; T.headRZ = .1 * e; if (tt > 1.4) every(1.6, () => puff('puff', head(), 1, .2)); break;
          case 'spin': { const kk = clamp((k - .15) / .65, 0, 1); T.sit = 0; T.jump = Math.sin(kk * Math.PI) * .95; T.spin = easeIO(kk) * TAU; T.tailUp = 1; T.lf0 = T.lf1 = -.5 * Math.sin(kk * Math.PI); T.lb0 = T.lb1 = .6 * Math.sin(kk * Math.PI); T.eye = .2; T.mouth = .6 * Math.sin(kk * Math.PI); every(.3, () => puff(R.fx % 2 ? 'star' : 'heart', head(), 1, .6)); break; }
        }
      } else if (c.react && c.react.id === 'leave') { T.ear = 1; T.eye = .5; T.tailWag = .5; T.wagSp = 10; }
      // 全員慶祝（圖鑑收集完成）
      if (c.celebrate) {
        const tt = now - c.celebrate;
        if (tt > 0 && tt < 1.4) { const kk = tt / 1.4; T.sit = 0; T.low = 0; T.jump = Math.sin(kk * Math.PI) * 1; T.spin = easeIO(kk) * TAU; T.tailUp = 1; T.eye = .2; if (Math.random() < dt * 8) puff('heart', headPos(c), 1, .6); }
        else if (tt >= 1.4) c.celebrate = 0;
      }

      // ---- 位置與朝向
      const ctr = c.home || I.pos, p = new THREE.Vector3(ctr.x + Math.cos(c.ang) * ringR(I, c), H, ctr.z + Math.sin(c.ang) * ringR(I, c));
      M.g.position.copy(p);
      let want;
      if (faceCam) want = Math.atan2(camPos.x - p.x, camPos.z - p.z);
      else if (c.state === 'sulk') want = Math.atan2(p.x - camPos.x, p.z - camPos.z) + .5;          // 背對你，生悶氣
      else if (walking || c.state === 'walk') want = Math.atan2(-Math.sin(c.ang) * c.dir, Math.cos(c.ang) * c.dir);
      else want = c.heading;
      let dh = want - c.heading; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU;
      c.heading += dh * Math.min(1, dt * (walking ? 10 : 5));

      // ---- 平滑套用姿勢
      const P = c.pose, rate = Math.min(1, dt * 7);
      for (const k in T) P[k] = SNAP.has(k) ? T[k] : lerp(P[k], T[k], rate);
      applyPose(c, t);
    }
    // 粒子
    for (const s of sprites) {
      if (!s.alive) continue;
      s.life += dt; const k = s.life / s.max;
      if (k >= 1) { s.alive = false; s.sp.visible = false; continue; }
      s.sp.position.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - dt * 1.2);
      if (s.kind === 'z') s.sp.position.x += Math.sin(s.life * 3) * dt * .3;
      const sz = s.size * (k < .2 ? k / .2 : 1) * (s.kind === 'z' ? .7 + k * .6 : 1);
      s.sp.scale.set(sz, sz, sz); s.sp.material.opacity = k > .65 ? (1 - k) / .35 : 1;
    }
  }

  function applyPose(c, t) {
    const M = c.M, P = c.pose;
    M.g.rotation.y = c.heading + P.spin;
    const lowY = P.low * .13 + P.sit * .07;
    M.body.position.y = .28 + P.jump + P.buzz - lowY + Math.abs(Math.sin(P.roll)) * -.04;
    M.body.rotation.set(0, P.bodyRY, P.roll);
    const a = -P.sit * .72 + P.lean;                       // 軀幹俯仰：負數＝前半身抬起
    M.trunk.rotation.x = a;
    // 前腳：保持垂直並伸長到地面
    const shoulderH = .3 - lowY - .42 * Math.sin(a) + P.buzz;
    const fs = clamp(shoulderH / .3, .25, 1.9);
    M.legsF.forEach((l, i) => { l.rotation.x = -a + (i ? P.lf1 : P.lf0); l.scale.y = fs; });
    M.legsB.forEach((l, i) => { l.rotation.x = -P.sit * 1.25 - P.low * 1.3 + (i ? P.lb1 : P.lb0); l.scale.y = 1 - P.low * .55 - P.sit * .25; });
    M.head.rotation.set(-a * .9 + P.headRX, P.headRY, P.headRZ);
    M.eyes.forEach((e) => { e.scale.y = Math.max(.1, P.eye); });
    M.mouth.scale.y = .015 + P.mouth * .075; M.mouth.position.y = -.1 - P.mouth * .02;
    M.ears.forEach((e, i) => { e.rotation.x = -P.ear * .9; e.rotation.z = (i ? -1 : 1) * P.ear * .5; });
    // 尾巴
    M.tailBase.rotation.x = lerp(-2.05, -.2, P.tailUp) - a;
    M.tail.forEach((s, i) => {
      if (i) s.rotation.x = P.tailCurl * (.2 + i * .06);
      s.rotation.z = Math.sin(t * P.wagSp - i * .7) * P.tailWag * (i ? 1 : .5);
    });
  }

  return {
    cats, pickables, update, pet, remote, scare, celebrate, puff,
    headOf(o) { return headPos(o.cat).add(new THREE.Vector3(0, .5 * (o.cat.data.scale || 1), 0)); },
    byId(id) { return cats.find((c) => c.data.id === id); },
    // 每隻貓在自己的島上找一塊空地當家
    setHomes(find) { for (const c of cats) { const s = find(c.data.island); if (s) c.home = { x: s.x, z: s.z }; } },
    cooldown(c) { return Math.max(0, Math.ceil(c.coolUntil - performance.now() / 1000)); },
    moodOf(c) { return c.mood; }, MOOD_MAX,
  };
}
