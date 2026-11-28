// 🏊 循環海水浴場：循環挖寶島外側的沙灘＋圍起來的游泳區
// 從島頂走木階梯下沙灘，走進水裡就自動變成游泳（W.ground 在水裡回傳「腳的高度」，越往外越深）
// 浮球繩圍起來，游不出去；晚上救生員下班，暫停開放（在水裡的人會被送回沙灘）
import * as THREE from 'three';
import { H, shapeR, LAYOUT } from './world.js?v=20261128a';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true, ...o });

export const SWIM_FEET = -.78;   // 深水區腳的高度：眼睛（腳＋1.05）剛好在水面上
const SEA_Y = -.05;

export function createSwim(W, opts = {}) {
  const id = opts.island || 'recycle', I = W.islands[id], L = LAYOUT[id];
  const ang = (opts.angle ?? 55) * Math.PI / 180;
  const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), side = new THREE.Vector3(-dir.z, 0, dir.x);
  const low = !!opts.low, scene = W.scene;
  const RS = (th) => shapeR(th, L.seed) * L.R;                    // 這個方向的海岸線基準半徑
  const RA = RS(ang);                                              // 中軸的基準半徑
  const HW = 3.5;                                                  // 游泳區半寬（左右各 3.5）
  const SHORE = 1.185, DEEP = 1.9, OUT = 7.2;                      // 水邊（倍率）、走幾公尺變深水、往外游多遠
  const U1 = RA * SHORE + OUT;                                     // 外側浮球繩（沿中軸的距離）
  const ST0 = RA * .915, ST1 = RA * 1.15, STW = .62;               // 木階梯：從島頂到沙灘
  const sandAt = (rr) => {                                         // 沙灘的高度（跟 world.js 的地形環一樣）
    const P = [[1.035, .66], [1.08, .58], [1.16, .36], [1.22, .12]];
    if (rr <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (rr <= P[i][0]) { const k = (rr - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k; }
    return P[P.length - 1][1];
  };
  const local = (x, z) => { const dx = x - I.pos.x, dz = z - I.pos.z; return { u: dx * dir.x + dz * dir.z, l: dx * side.x + dz * side.z, r: Math.hypot(dx, dz), th: Math.atan2(dz, dx) }; };
  const toW = (u, l, y = 0) => new THREE.Vector3(I.pos.x + dir.x * u + side.x * l, y, I.pos.z + dir.z * u + side.z * l);
  let open = true;

  // 可走面：階梯 → 沙灘 → 淺水 → 深水（腳的高度）
  // 回傳 { y, depth }；不在範圍內回傳 null
  function sample(x, z) {
    const q = local(x, z);
    if (q.u < ST0 - .1 || q.u > U1 - .25 || Math.abs(q.l) > HW - .2) return null;
    if (Math.abs(q.l) < STW && q.u <= ST1) { const k = clamp((q.u - ST0) / (ST1 - ST0), 0, 1); return { y: H + (sandAt(ST1 / RA) - H) * k, depth: 0 }; }
    const rs = RS(q.th), rr = q.r / rs;
    if (rr < 1.04) return null;                                    // 岩壁：只能走階梯
    if (rr <= SHORE) return { y: sandAt(rr), depth: 0 };
    if (!open) return null;                                        // 晚上暫停開放：不能下水
    const d = (rr - SHORE) * rs, k = clamp(d / DEEP, 0, 1);
    return { y: sandAt(SHORE) + (SWIM_FEET - sandAt(SHORE)) * k, depth: k };
  }
  W.surfaces.push((x, z) => { const s = sample(x, z); return s ? s.y : null; });
  // 是不是在水裡游（深度過半就算）
  const swimAt = (x, z) => { const s = sample(x, z); return !!(s && s.depth > .45); };
  const wetAt = (x, z) => { const s = sample(x, z); return !!(s && s.depth > 0); };

  const root = new THREE.Group(); scene.add(root);
  const wood = m('#b98352'), woodD = m('#8d5d35'), woodL = m('#d4a571'), white = m('#fbf7ee');
  const add = (geo, mat, p, rotY = 0, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.copy(p); o.rotation.y = rotY; o.castShadow = cast && !low; o.receiveShadow = true; root.add(o); return o; };
  const yaw = Math.atan2(dir.x, dir.z);                            // 面向海

  // ---- 木階梯（10 階）＋扶手
  {
    const n = 10, y1 = sandAt(ST1 / RA);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, u = ST0 + (ST1 - ST0) * t, y = H + (y1 - H) * t;
      add(new THREE.BoxGeometry(STW * 2 + .1, .12, (ST1 - ST0) / n + .02), i % 2 ? wood : woodL, toW(u, 0, y - .06), yaw);
      add(new THREE.BoxGeometry(STW * 2 - .1, Math.max(.1, y - y1 + .3), .16), woodD, toW(u, 0, (y + y1) / 2 - .3), yaw, false);
    }
    for (const sl of [-STW - .02, STW + .02]) {
      for (let i = 0; i <= 2; i++) { const t = i / 2, u = ST0 + (ST1 - ST0) * t, y = H + (y1 - H) * t; add(new THREE.BoxGeometry(.09, .7, .09), woodD, toW(u, sl, y + .35), yaw); }
      const len = Math.hypot(ST1 - ST0, H - y1), rail = add(new THREE.BoxGeometry(.07, .07, len), wood, toW((ST0 + ST1) / 2, sl, (H + y1) / 2 + .68), yaw);
      rail.rotation.order = 'YXZ'; rail.rotation.x = Math.atan2(H - y1, ST1 - ST0);
    }
  }

  // ---- 入口拱門招牌「🏊 循環海水浴場」（立在階梯頂端）
  const paintBoard = (cv, draw) => { const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const go = () => { draw(cv.getContext('2d')); tex.needsUpdate = true; }; go(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); return tex; };
  const FONT = (n) => `900 ${n}px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans CJK TC', sans-serif`;
  const fitText = (x, s, max, n) => { x.font = FONT(n); while (x.measureText(s).width > max && n > 20) { n -= 3; x.font = FONT(n); } };
  {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 150;
    const tex = paintBoard(cv, (x) => {
      x.fillStyle = '#1f8fd6'; x.fillRect(0, 0, 640, 150); x.strokeStyle = '#ffffff'; x.lineWidth = 10; x.strokeRect(6, 6, 628, 138);
      for (let i = 0; i < 640; i += 40) { x.fillStyle = i % 80 ? '#ffffff' : '#ff5a4f'; x.fillRect(i, 128, 40, 16); }
      x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, '🏊 循環海水浴場', 590, 74); x.fillText('🏊 循環海水浴場', 320, 66);
    });
    const u = ST0 + .05;
    for (const sl of [-STW - .15, STW + .15]) add(new THREE.CylinderGeometry(.06, .07, 2.6, 8), white, toW(u, sl, H + 1.3), 0);
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: .7, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .15 });
    for (const ry of [0, Math.PI]) { const b = add(new THREE.PlaneGeometry(1.9, .45), bm, toW(u + (ry ? .005 : -.005), 0, H + 2.4), yaw + Math.PI + ry, false); b.castShadow = false; }
  }

  // ---- 安全告示牌（沙灘上，階梯旁）
  {
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 300;
    const tex = paintBoard(cv, (x) => {
      x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 384, 300); x.strokeStyle = '#e0412f'; x.lineWidth = 12; x.strokeRect(6, 6, 372, 288);
      x.fillStyle = '#e0412f'; x.fillRect(6, 6, 372, 70); x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, '⚠️ 游泳安全', 340, 46); x.fillText('⚠️ 游泳安全', 192, 43);
      x.fillStyle = '#23303d'; x.textAlign = 'left';
      const L2 = ['1. 要有大人陪同', '2. 只在有救生員的地方游', '3. 不游出浮球繩', '4. 天黑不下水'];
      L2.forEach((s, i) => { fitText(x, s, 340, 34); x.fillText(s, 24, 112 + i * 48); });
    });
    const at = (u, l) => { const p = toW(u, l); const q = local(p.x, p.z); return toW(u, l, sandAt(q.r / RS(q.th))); };
    const p = at(RA * 1.1, -STW - 1.05);
    add(new THREE.CylinderGeometry(.04, .05, 1.5, 6), woodD, p.clone().setY(p.y + .75), 0);
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: .8 });
    const b = add(new THREE.PlaneGeometry(.95, .74), bm, p.clone().setY(p.y + 1.35), yaw + Math.PI, false);
    const back = add(new THREE.PlaneGeometry(.95, .74), woodL, p.clone().setY(p.y + 1.35).addScaledVector(dir, .01), yaw, false); back.castShadow = false;
    W.blockers.push({ x: p.x, z: p.z, r: .12 });
    // 救生員高椅（階梯另一邊）
    const c = at(RA * 1.1, STW + 1.3), cy = c.y;
    for (const [a, b2] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) add(new THREE.BoxGeometry(.08, 1.7, .08), white, c.clone().addScaledVector(side, a).addScaledVector(dir, b2).setY(cy + .85), yaw);
    add(new THREE.BoxGeometry(.75, .08, .75), m('#e0412f'), c.clone().setY(cy + 1.72), yaw);
    add(new THREE.BoxGeometry(.75, .5, .08), m('#e0412f'), c.clone().addScaledVector(dir, -.34).setY(cy + 2.0), yaw);
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(.6, .05, .05), white, c.clone().addScaledVector(dir, .34).setY(cy + .3 + k * .38), yaw);
    const um = add(new THREE.ConeGeometry(.75, .35, 8), m('#ffcf33'), c.clone().setY(cy + 2.75), 0); um.castShadow = true;
    add(new THREE.CylinderGeometry(.025, .025, 1.1, 5), white, c.clone().setY(cy + 2.2), 0);
    // 救生員（白天坐在椅子上，晚上下班）
    const guard = new THREE.Group(); guard.position.copy(c).setY(cy + 1.76); guard.rotation.y = yaw; root.add(guard);
    const skin = m('#f0c39a'), shirt = m('#e0412f');
    const body = new THREE.Mesh(new THREE.BoxGeometry(.32, .38, .2), shirt); body.position.y = .22; guard.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), skin); head.position.y = .55; guard.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.135, 10, 6, 0, TAU, 0, Math.PI / 2), m('#ffffff')); cap.position.y = .57; guard.add(cap);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.11, .1, .36), skin); leg.position.set(s * .08, .06, .18); guard.add(leg); const sh = new THREE.Mesh(new THREE.BoxGeometry(.1, .36, .1), skin); sh.position.set(s * .08, -.1, .36); guard.add(sh); }
    const whistle = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), m('#ffd23a')); whistle.position.set(0, .35, .11); guard.add(whistle);
    W.blockers.push({ x: c.x, z: c.z, r: .45 });
    root.userData.guard = guard;
    // 救生圈架
    const r0 = at(RA * 1.12, -STW - 2.3);
    add(new THREE.BoxGeometry(.08, 1.2, .08), woodD, r0.clone().setY(r0.y + .6), yaw);
    const ring = add(new THREE.TorusGeometry(.28, .09, 8, 18), m('#ff5a4f'), r0.clone().setY(r0.y + .8).addScaledVector(dir, .06), yaw);
    for (let k = 0; k < 4; k++) { const st = add(new THREE.BoxGeometry(.1, .1, .19), white, r0.clone().setY(r0.y + .8 + Math.sin(k * TAU / 4) * .28).addScaledVector(side, Math.cos(k * TAU / 4) * .28).addScaledVector(dir, .06), yaw); st.rotation.order = 'YXZ'; }
    ring.castShadow = !low; W.blockers.push({ x: r0.x, z: r0.z, r: .15 });
  }

  // ---- 浮球繩：兩側＋外側，紅白相間，跟著浪上下
  const buoys = [], ropePts = [];
  {
    const shoreU = (l) => { for (let u = RA * .9; u < U1; u += .05) { const p = toW(u, l), q = local(p.x, p.z); if (q.r / RS(q.th) >= SHORE + .02) return u; } return RA * SHORE; };
    const path = [];
    const a0 = shoreU(-HW), a1 = shoreU(HW);
    for (let u = a0; u < U1; u += .55) path.push([u, -HW]);
    for (let l = -HW; l < HW; l += .55) path.push([U1, l]);
    for (let u = U1; u >= a1; u -= .55) path.push([u, HW]);
    const geo = new THREE.SphereGeometry(.16, 10, 8), red = m('#ff4b3e', { roughness: .5 }), wh = m('#ffffff', { roughness: .5 });
    path.forEach(([u, l], i) => { const b = new THREE.Mesh(geo, i % 2 ? wh : red); b.position.copy(toW(u, l, .02)); b.castShadow = false; root.add(b); buoys.push({ b, ph: i * .7 }); ropePts.push(b.position); });
    const rg = new THREE.BufferGeometry().setFromPoints(ropePts.map((p) => p.clone()));
    const rope = new THREE.Line(rg, new THREE.LineBasicMaterial({ color: '#f4efe2' })); root.add(rope); root.userData.rope = rope;
    // 外側角落兩根大浮標（橘色、比較高）
    for (const l of [-HW, HW]) { const p = toW(U1, l); const f = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, .7, 10), m('#ff8a1f')); f.position.copy(p).setY(.25); root.add(f); buoys.push({ b: f, ph: l, big: true }); }
  }
  // ---- 漂在水上的救生圈、充氣小鴨
  const floats = [];
  {
    const mk = (u, l, kind) => {
      const g = new THREE.Group(); g.position.copy(toW(u, l, 0)); root.add(g);
      if (kind === 'ring') { const t = new THREE.Mesh(new THREE.TorusGeometry(.32, .1, 8, 20), m(['#ff5a4f', '#3fb6ff', '#ffcf33'][floats.length % 3])); t.rotation.x = Math.PI / 2; g.add(t); }
      else { const y = m('#ffd23a'); const b = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 10), y); b.scale.set(1, .7, 1.25); b.position.y = .08; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(.18, 10, 8), y); h.position.set(0, .38, .28); g.add(h); const bk = new THREE.Mesh(new THREE.ConeGeometry(.07, .16, 6), m('#ff8a1f')); bk.rotation.x = Math.PI / 2; bk.position.set(0, .36, .46); g.add(bk); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 5), m('#222222')); e.position.set(s * .09, .44, .41); g.add(e); } }
      floats.push({ g, u, l, ph: floats.length * 1.9 });
    };
    mk(RA * SHORE + 3.2, -1.6, 'ring'); mk(RA * SHORE + 5.0, 1.8, 'duck'); mk(RA * SHORE + 2.4, 2.2, 'ring');
  }

  // ---- 游泳時的水波紋
  const rings = [], ringGeo = new THREE.RingGeometry(.3, .4, 24); ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); r.visible = false; r.renderOrder = 2; root.add(r); rings.push({ r, t: 9 }); }
  let ringI = 0, ringCd = 0;
  const ripple = (x, z) => { const R = rings[ringI++ % rings.length]; R.t = 0; R.r.position.set(x, SEA_Y + .06, z); R.r.visible = true; };

  // ---- 潛水時的水中藍色畫面
  const under = document.createElement('div');
  under.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;background:radial-gradient(ellipse at 50% 30%,rgba(80,190,235,.35),rgba(10,80,140,.62));opacity:0;transition:opacity .25s';
  document.body.appendChild(under);

  // 泳衣（每個人物進水時套上一層，起水時拿掉）：在 players.js 裡呼叫 W.swimPose
  // 游泳的動作：深水區人物往前趴、雙手輪流划、腳打水；沒在動就直立踩水，只露出頭
  W.swimPose = (P, pos, yaw, t, moving) => {
    const s = sample(pos.x, pos.z); if (!s || s.depth <= .45) return false;
    const g = P.g; g.rotation.order = 'YXZ'; g.rotation.y = yaw;
    if (moving) {
      g.rotation.x = 1.3; g.position.set(pos.x - Math.sin(yaw) * .45, SEA_Y - .12 + Math.sin(t * 7) * .02, pos.z - Math.cos(yaw) * .45);
      P.arms[0].rotation.set(-(t * 6) % TAU, 0, 0); P.arms[1].rotation.set(-(t * 6 + Math.PI) % TAU, 0, 0);
      P.legs[0].rotation.x = Math.sin(t * 13) * .35; P.legs[1].rotation.x = -Math.sin(t * 13) * .35;
    } else {
      g.rotation.x = .08; g.position.set(pos.x, SWIM_FEET + .3 + Math.sin(t * 2.2) * .04, pos.z);   // 只露出頭和肩膀
      P.arms[0].rotation.set(-.3, 0, -.9 + Math.sin(t * 3) * .35); P.arms[1].rotation.set(-.3, 0, .9 - Math.sin(t * 3) * .35);
      P.legs[0].rotation.x = Math.sin(t * 3) * .4; P.legs[1].rotation.x = -Math.sin(t * 3) * .4;
    }
    return true;
  };
  W.swimAt = swimAt; W.wetAt = wetAt;

  let wasSwim = false, closedToast = 0;
  function update(dt, t, night, me, camera, toast) {
    const nowOpen = night < .5;
    if (nowOpen !== open) {
      open = nowOpen;
      root.userData.guard.visible = open;
      // 天黑了還在水裡：送回沙灘
      if (!open && me) {
        const q = local(me.pos.x, me.pos.z);
        if (q.u > ST1 && Math.abs(q.l) < HW && q.r / RS(q.th) > SHORE) { const p = toW(RA * 1.12, clamp(q.l, -HW + .6, HW - .6)); const pq = local(p.x, p.z); me.pos.set(p.x, sandAt(pq.r / RS(pq.th)), p.z); closedToast = performance.now(); toast && toast('🌙 天黑了，救生員下班，海水浴場暫停開放，明天再來游！'); }
      }
    }
    // 晚上走到水邊：提醒一下（不能下水）
    if (!open && me) { const q = local(me.pos.x, me.pos.z); if (Math.abs(q.l) < HW && q.u > ST1 && q.r / RS(q.th) > SHORE - .03 && performance.now() - closedToast > 6000) { closedToast = performance.now(); toast && toast('🌙 天黑了，救生員下班，海水浴場暫停開放'); } }
    for (const k of buoys) k.b.position.y = (k.big ? .25 : .02) + Math.sin(t * 1.6 + k.ph) * .04;
    const rope = root.userData.rope; if (rope) { const a = rope.geometry.attributes.position; for (let i = 0; i < ropePts.length; i++) a.setY(i, ropePts[i].y + .06); a.needsUpdate = true; }
    for (const f of floats) { f.g.position.y = SEA_Y + .1 + Math.sin(t * 1.4 + f.ph) * .05; f.g.rotation.y = f.ph + Math.sin(t * .3 + f.ph) * .6; f.g.rotation.z = Math.sin(t * 1.1 + f.ph) * .08; }
    // 水波紋：自己在水裡移動時一圈一圈
    const swim = !!(me && swimAt(me.pos.x, me.pos.z));
    if (swim && me.moving) { ringCd -= dt; if (ringCd <= 0) { ringCd = .28; ripple(me.pos.x, me.pos.z); } }
    else if (me && wetAt(me.pos.x, me.pos.z) && me.moving) { ringCd -= dt; if (ringCd <= 0) { ringCd = .45; ripple(me.pos.x, me.pos.z); } }
    for (const R of rings) { if (R.t > 1.4) { R.r.visible = false; continue; } R.t += dt; const k = R.t / 1.4; R.r.scale.setScalar(1 + k * 2.2); R.r.material.opacity = .38 * (1 - k); }
    if (swim && !wasSwim && toast) toast('🏊 下水囉！方向鍵游泳，「蹲」可以潛到水裡，「跳」拍水往上');
    wasSwim = swim;
    under.style.opacity = camera && camera.position.y < SEA_Y && sample(camera.position.x, camera.position.z) ? '1' : '0';
  }
  return { update, swimAt, wetAt, sample, root, entry: ang, isOpen: () => open, spot: () => toW(RA * 1.12, 0, sandAt(1.12)) };
}
