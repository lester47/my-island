// 🚁 無人機：三種玩法
// 1. 無人機燈光秀：花鯉魚幣，一群發光無人機在北邊夜空排出「115」、鯉魚、愛心、「市集」、星星、漩渦，再降落
//    （畫面只由「開始時間」決定，所以大家看到同一場秀）
// 2. 遙控無人機：從服務台旁的無人機基地起飛，用方向鍵／螢幕按鈕自己飛，可以空拍照相，電池 2 分鐘
// 3. 送貨無人機：平常有幾台載著包裹在島之間飛；打工「無人機快遞」＝自己開無人機把包裹送到指定的島
import * as THREE from 'three';
import { TAU, rng } from './kit.js?v=20261126k';
import { H } from './world.js?v=20261126k';

const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export function createDrones(W, opts = {}) {
  const { scene } = W, low = !!opts.low, now = opts.now || (() => Date.now());
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, flatShading: true, ...o });

  // ================================================================ 共用：一台無人機的模型
  const bodyM = m('#2b2f38', { metalness: .3 }), armM = m('#444b57'), propM = new THREE.MeshBasicMaterial({ color: '#cfd6dd', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false });
  const boxM = m('#c8955a'), tapeM = m('#e3c26a');
  function makeDrone(color, scale = 1, withBox = false) {
    const g = new THREE.Group(), props = [];
    const shell = m(color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.42, .13, .5), bodyM); g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .34), shell); top.position.y = .09; g.add(top);
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, .62), armM); arm.position.set(x * .21, .02, z * .21); arm.rotation.y = x * z * Math.PI / 4; g.add(arm);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .08, 8), shell); motor.position.set(x * .42, .06, z * .42); g.add(motor);
      const prop = new THREE.Mesh(new THREE.CircleGeometry(.24, 14), propM); prop.rotation.x = -Math.PI / 2; prop.position.set(x * .42, .11, z * .42); g.add(prop); props.push(prop);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.03, .14, .03), armM); leg.position.set(x * .16, -.12, z * .2); g.add(leg);
    }
    // 前燈（綠）、後燈（紅）：晚上看得出方向
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.04, 6, 4), new THREE.MeshBasicMaterial({ color: '#4dff6a' })); fl.position.set(0, .02, .27); g.add(fl);
    const bl = new THREE.Mesh(new THREE.SphereGeometry(.04, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3355' })); bl.position.set(0, .02, -.27); g.add(bl);
    let box = null;
    if (withBox) {
      box = new THREE.Group(); box.position.y = -.42; g.add(box);
      const b = new THREE.Mesh(new THREE.BoxGeometry(.34, .26, .34), boxM); box.add(b);
      const t = new THREE.Mesh(new THREE.BoxGeometry(.35, .27, .06), tapeM); box.add(t);
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .3, 3), armM); r.position.set(x * .12, .2, z * .12); box.add(r); }
    }
    g.scale.setScalar(scale);
    for (const o of [g, ...g.children]) o.castShadow = false;
    return { g, props, box, spin: (dt, k = 1) => { for (let i = 0; i < props.length; i++) props[i].rotation.z += dt * 40 * k * (i % 2 ? 1 : -1); } };
  }

  // ================================================================ 無人機基地（服務台島上）
  const base = opts.base ? new THREE.Vector3(opts.base.x, H, opts.base.z) : new THREE.Vector3(3, H, -6);
  const baseG = new THREE.Group(); baseG.position.copy(base); baseG.rotation.y = opts.base?.face ?? 0; scene.add(baseG);
  {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#2f3b48'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#22d6ff'; x.lineWidth = 14; x.strokeRect(10, 10, 236, 236);
    x.strokeStyle = '#ffffff'; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, 78, 0, TAU); x.stroke();
    x.fillStyle = '#ffffff'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('UAV', 128, 132);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.9, .08, 1.9), [m('#2f3b48'), m('#2f3b48'), new THREE.MeshStandardMaterial({ map: t, roughness: .8 }), m('#2f3b48'), m('#2f3b48'), m('#2f3b48')]); pad.position.y = .04; pad.receiveShadow = true; baseG.add(pad);
    // 小看板
    // 字太長會被切掉：畫布加寬，並依實際字寬自動縮小字級（字型晚載入時再畫一次）
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 168; const sx = sc.getContext('2d');
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    const paintSign = () => {
      sx.fillStyle = '#22d6ff'; sx.fillRect(0, 0, 512, 168); sx.strokeStyle = '#ffffff'; sx.lineWidth = 8; sx.strokeRect(8, 8, 496, 152);
      sx.fillStyle = '#0d2233'; sx.textAlign = 'center'; sx.textBaseline = 'middle';
      let fs = 84; const font = (n) => `900 ${n}px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`;
      sx.font = font(fs); while (sx.measureText('🚁 無人機基地').width > 460 && fs > 30) { fs -= 4; sx.font = font(fs); }
      sx.fillText('🚁 無人機基地', 256, 88); st.needsUpdate = true;
    };
    paintSign(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintSign);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.5, 6), m('#dddddd')); post.position.set(-1.15, .75, -.7); baseG.add(post);
    for (const ry of [0, Math.PI]) { const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .43), new THREE.MeshStandardMaterial({ map: st, emissive: '#ffffff', emissiveMap: st, emissiveIntensity: .25 })); sign.position.set(-1.15, 1.55, -.7 + (ry ? -.005 : .005)); sign.rotation.y = ry; baseG.add(sign); }   // 前後兩面都是正的字
  }
  // 停在基地上的一台（沒人在飛時看得到）
  const parked = makeDrone('#ff8a1f', 1.2); parked.g.position.copy(base).setY(H + .25); parked.g.rotation.y = opts.base?.face ?? 0; scene.add(parked.g);

  // ================================================================ 2. 遙控無人機
  const me = makeDrone('#ff8a1f', 1.2, true); me.g.visible = false; scene.add(me.g);
  const P = { on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, vy: 0, left: 0, keys: {}, pad: {}, mission: null, onEnd: null, onInfo: null, camP: new THREE.Vector3(), camT: new THREE.Vector3(), tilt: 0, roll: 0, fpv: false };
  const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'u', KeyE: 'u', ShiftLeft: 'd', ShiftRight: 'd', KeyQ: 'd', KeyR: 'u', PageUp: 'u', KeyF: 'd', PageDown: 'd' };
  const kd = (e) => { if (!P.on || (e.target && e.target.matches && e.target.matches('input,textarea'))) return; if (e.target.closest && e.target.closest('dialog[open]')) return; const k = KEYMAP[e.code]; if (k) { P.keys[k] = true; e.preventDefault(); } if (e.code === 'KeyP' && !e.repeat && opts.onShotKey) opts.onShotKey(); };
  const ku = (e) => { const k = KEYMAP[e.code]; if (k) P.keys[k] = false; };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku); addEventListener('blur', () => { P.keys = {}; });
  const groundAt = (x, z) => { const g = W.ground(x, z); return g == null ? 0 : g; };
  const LIM = { r: 50, top: 30, speed: 7.5, climb: 6, turn: 1.9, cruise: 6 };   // cruise：起飛後自動爬升到離地幾公尺

  // 送貨任務的目標標記：光柱＋地上光圈
  const beamM = new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beacon = new THREE.Group(); beacon.visible = false; scene.add(beacon);
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 16, 20, 1, true), beamM); c.position.y = 8; beacon.add(c);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.5, 32), new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; beacon.add(ring);
    const cc = document.createElement('canvas'); cc.width = 128; cc.height = 128; const x = cc.getContext('2d'); x.font = '96px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('📦', 64, 70);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cc), depthTest: false })); sp.scale.set(1.6, 1.6, 1); sp.position.y = 5; sp.renderOrder = 9; beacon.add(sp); beacon.userData.icon = sp; }
  const drops = [];   // 送到的包裹：掉到地上一會兒再消失

  function startPilot(o = {}) {
    P.on = true; P.left = o.secs ?? 120; P.mission = o.mission || null; P.onEnd = o.onEnd || null; P.onInfo = o.onInfo || null; P.keys = {}; P.pad = {};
    P.pos.copy(base).setY(H + .3); P.vel.set(0, 0, 0); P.vy = 0; P.yaw = opts.base?.face ?? 0; P.tilt = P.roll = 0;
    me.g.visible = true; parked.g.visible = false; me.box.visible = !!P.mission;
    const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    P.camP.copy(P.pos).addScaledVector(fwd, -4.5).add(new THREE.Vector3(0, 2, 0)); P.camT.copy(P.pos);
    P.auto = H + LIM.cruise;   // 起飛：先自動爬升，避開地面的攤位、樹和路燈
    if (P.mission) setTarget();
  }
  function setTarget() {
    const t = P.mission.targets[P.mission.i]; if (!t) { beacon.visible = false; return; }
    beacon.position.set(t.x, groundAt(t.x, t.z), t.z); beacon.visible = true; me.box.visible = true;
  }
  function stopPilot(why) {
    if (!P.on) return; P.on = false; P.keys = {}; P.pad = {};
    me.g.visible = false; parked.g.visible = true; beacon.visible = false;
    const cb = P.onEnd; P.onEnd = null; P.mission = null; cb && cb(why);
  }
  function pilotStep(dt) {
    if (!P.on) return;
    P.left -= dt;
    const k = P.keys, pd = P.pad, f = (k.f || pd.f ? 1 : 0) - (k.b || pd.b ? 1 : 0), turn = (k.l || pd.l ? 1 : 0) - (k.r || pd.r ? 1 : 0), up = (k.u || pd.u ? 1 : 0) - (k.d || pd.d ? 1 : 0);
    const lowBat = P.left < 0;
    P.yaw += turn * LIM.turn * dt;
    const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    // 電池用完：自動飛回基地降落
    let want = fwd.clone().multiplyScalar(f * LIM.speed), wantVy = up * LIM.climb;
    if (up) P.auto = null;
    else if (P.auto != null) { const dy = P.auto - P.pos.y; wantVy = Math.max(-LIM.climb, Math.min(LIM.climb, dy * 2)); if (Math.abs(dy) < .15) P.auto = null; }
    if (lowBat) { const to = base.clone().sub(P.pos); to.y = 0; const d = to.length(); want = d > .4 ? to.normalize().multiplyScalar(Math.min(LIM.speed, d * 1.5)) : new THREE.Vector3(); wantVy = d < 1.5 ? -2 : (H + 6 - P.pos.y); P.yaw += Math.atan2(Math.sin(Math.atan2(to.x, to.z) - P.yaw), Math.cos(Math.atan2(to.x, to.z) - P.yaw)) * Math.min(1, dt * 2) * (d > .4 ? 1 : 0); }
    const a = 1 - Math.exp(-dt * 3);
    P.vel.lerp(want, a); P.vy += (wantVy - P.vy) * a;
    P.pos.addScaledVector(P.vel, dt); P.pos.y += P.vy * dt;
    const r = Math.hypot(P.pos.x, P.pos.z); if (r > LIM.r) { P.pos.x *= LIM.r / r; P.pos.z *= LIM.r / r; P.vel.multiplyScalar(.5); }
    const gmin = groundAt(P.pos.x, P.pos.z) + .3; if (P.pos.y < gmin) { P.pos.y = gmin; if (P.vy < 0) P.vy = 0; }
    if (P.pos.y > LIM.top) { P.pos.y = LIM.top; if (P.vy > 0) P.vy = 0; }
    // 機身：往前飛會低頭、轉彎會側傾
    const lv = P.vel.dot(fwd) / LIM.speed; P.tilt += (lv * .3 - P.tilt) * a; P.roll += (-turn * .25 - P.roll) * a;
    me.g.position.copy(P.pos); me.g.rotation.set(P.tilt, P.yaw, P.roll, 'YXZ');
    me.spin(dt, 1 + Math.abs(lv));
    // 送貨：飛到光柱裡、而且夠低（離地 3 公尺內）就送達
    if (P.mission && beacon.visible) {
      const t = P.mission.targets[P.mission.i], dh = Math.hypot(P.pos.x - t.x, P.pos.z - t.z), alt = P.pos.y - groundAt(t.x, t.z);
      if (dh < 1.6 && alt < 3.2) {
        const b = me.box.clone(); b.position.copy(me.box.getWorldPosition(new THREE.Vector3())); b.userData.vy = 0; b.userData.t = 0; b.userData.gy = groundAt(t.x, t.z) + .18; scene.add(b); drops.push(b);
        P.mission.i++; P.mission.onDeliver && P.mission.onDeliver(P.mission.i, t);
        if (P.mission.i >= P.mission.targets.length) { me.box.visible = false; beacon.visible = false; const done = P.mission.onDone; P.mission = null; done && done(); }
        else setTarget();
      }
      beacon.userData.icon.position.y = 5 + Math.sin(performance.now() / 300) * .3;
    }
    if (P.left < -40 || (lowBat && P.pos.distanceTo(base) < .9 && P.pos.y < H + .9)) { stopPilot('battery'); return; }
    if (P.onInfo) { const t = P.mission && P.mission.targets[P.mission.i]; P.onInfo({ left: Math.max(0, Math.ceil(P.left)), alt: Math.max(0, P.pos.y - groundAt(P.pos.x, P.pos.z)), speed: P.vel.length(), dist: t ? Math.hypot(P.pos.x - t.x, P.pos.z - t.z) : null, target: t ? t.name : '', back: lowBat }); }
  }
  // 鏡頭：跟在無人機後上方（或 FPV：從機頭往前看）
  function pilotCam(cam, dt) {
    const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    if (P.fpv) { cam.position.copy(P.pos).addScaledVector(fwd, .4).add(new THREE.Vector3(0, -.05, 0)); cam.up.set(0, 1, 0); cam.lookAt(P.pos.clone().addScaledVector(fwd, 6).add(new THREE.Vector3(0, -1.6, 0))); return; }
    const a = 1 - Math.exp(-dt * 5);
    P.camP.lerp(P.pos.clone().addScaledVector(fwd, -4.6).add(new THREE.Vector3(0, 1.9, 0)), a);
    const gy = groundAt(P.camP.x, P.camP.z) + .6; if (P.camP.y < gy) P.camP.y = gy;
    P.camT.lerp(P.pos.clone().addScaledVector(fwd, 2.2).add(new THREE.Vector3(0, .2, 0)), Math.min(1, a * 1.6));
    cam.position.copy(P.camP); cam.up.set(0, 1, 0); cam.lookAt(P.camT);
  }

  // ================================================================ 3. 平常在島之間送貨的無人機
  const ISL = ['center', 'food', 'craft', 'puzzle', 'sport', 'recycle'].map((id) => W.islands[id]).filter(Boolean);
  const couriers = [];
  const routes = [[0, 1, 0, 3, 0, 5], [0, 2, 0, 4], [1, 2, 4, 5, 3]];
  routes.forEach((rt, k) => {
    const pts = rt.map((i, j) => { const I = ISL[i]; const a = j * 1.7 + k; return new THREE.Vector3(I.pos.x + Math.cos(a) * 2.5, H + 7.5 + k * 1.2 + (j % 2) * .8, I.pos.z + Math.sin(a) * 2.5); });
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const d = makeDrone(['#22d6ff', '#4dff6a', '#ff4fd8'][k], 1.1, true); scene.add(d.g);
    couriers.push({ d, curve, len: curve.getLength(), u: k / 3 });
  });

  // ================================================================ 1. 無人機燈光秀
  const NS = low ? 180 : 300;
  const site = new THREE.Vector3(opts.showSite?.x ?? 0, 0, opts.showSite?.z ?? -40);
  const SC = 13;          // 圖案半寬（公尺）
  const CY = H + 21;      // 圖案中心高度
  // 取樣：從 canvas 的字取點
  function textPts(str, fontPx = 120) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 220; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 600, 220); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `900 ${fontPx}px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`; x.fillText(str, 300, 116);
    const d = x.getImageData(0, 0, 600, 220).data, out = [];
    for (let y = 0; y < 220; y += 5) for (let xx = 0; xx < 600; xx += 5) if (d[(y * 600 + xx) * 4] > 128) out.push([(xx - 300) / 300, -(y - 110) / 300]);
    return out;
  }
  const fit = (pts, R) => { // 補到剛好 NS 點（不夠就重複、太多就平均挑）
    if (!pts.length) pts = [[0, 0]];
    const out = []; for (let i = 0; i < NS; i++) { const p = pts[Math.floor(i * pts.length / NS)]; out.push([p[0] + (R() - .5) * .004, p[1] + (R() - .5) * .004]); }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  };
  const curvePts = (fn, n = 400) => { const o = []; for (let i = 0; i < n; i++) o.push(fn(i / n)); return o; };
  const R0 = rng(115);
  const F = [];   // { pts:[[x,y]], col:(i,x,y,t)=>hex, z?:fn }
  F.push({ name: 'grid', pts: fit((() => { const o = []; const n = Math.ceil(Math.sqrt(NS * 2.2)); for (let i = 0; i < n; i++) for (let j = 0; j < n / 2.2; j++) o.push([(i / (n - 1) - .5) * 1.6, (j / (n / 2.2 - 1) - .5) * .7]); return o; })(), R0), col: () => '#ffffff' });
  F.push({ name: '115', pts: fit(textPts('115', 190), R0), col: (i, x) => (x < -.15 ? '#ffd21f' : x < .2 ? '#ff8a1f' : '#ff3355') });
  F.push({ name: 'koi', pts: fit([
    ...curvePts((t) => { const u = t * 2 - 1; const s = t < .5 ? 1 : -1; const uu = t < .5 ? u * 2 + 1 : (t - .5) * 4 - 1; return [uu * .55, s * .26 * Math.sqrt(Math.max(0, 1 - uu * uu)) * (uu < 0 ? .5 + .5 * (1 + uu) : 1)]; }, 260),
    ...curvePts((t) => { const L = [[-.52, .03], [-.86, .3], [-.76, 0], [-.86, -.3], [-.52, -.03]], q = t * 4, k = Math.min(3, Math.floor(q)), f = q - k; return [L[k][0] + (L[k + 1][0] - L[k][0]) * f, L[k][1] + (L[k + 1][1] - L[k][1]) * f]; }, 100),   // 分叉的尾鰭，接在身體後面
    ...curvePts((t) => [-.05 + t * .3, .25 + Math.sin(t * Math.PI) * .13], 50),
    ...curvePts((t) => { const a = t * TAU * 8, r = Math.sqrt(t); return [.18 + Math.cos(a) * .13 * r, .03 + Math.sin(a) * .1 * r]; }, 90),   // 紅斑：實心
    ...curvePts((t) => { const a = t * TAU * 6, r = Math.sqrt(t); return [-.2 + Math.cos(a) * .1 * r, .05 + Math.sin(a) * .08 * r]; }, 60),
    ...curvePts(() => [.42, .07], 6),   // 眼睛
  ], R0), col: (i, x, y) => (Math.hypot(x - .42, y - .07) < .02 ? '#ffd21f' : (Math.hypot(x - .18, y - .03) < .16 || Math.hypot(x + .2, y - .05) < .13) ? '#ff2a3d' : '#ffffff') });
  F.push({ name: 'heart', pts: fit(curvePts((t) => { const a = t * TAU; return [16 * Math.sin(a) ** 3 / 16 * .42, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * .42]; }), R0), col: () => '#ff4f8a' });
  F.push({ name: 'text', pts: fit(textPts('市集', 175), R0), col: (i, x) => `hsl(${Math.round((x + 1) * 160) % 360}, 95%, 62%)` });
  F.push({ name: 'star', pts: fit(curvePts((t) => { const seg = Math.floor(t * 10), f = t * 10 - seg, a0 = seg / 10 * TAU + Math.PI / 2, a1 = (seg + 1) / 10 * TAU + Math.PI / 2, r0 = seg % 2 ? .17 : .42, r1 = seg % 2 ? .42 : .17; return [Math.cos(a0) * r0 * (1 - f) + Math.cos(a1) * r1 * f, Math.sin(a0) * r0 * (1 - f) + Math.sin(a1) * r1 * f]; }), R0), col: () => '#ffd21f' });
  F.push({ name: 'spiral', spin: true, pts: fit(curvePts((t) => { const a = t * TAU * 3, r = .05 + t * .4; return [Math.cos(a) * r, Math.sin(a) * r]; }), R0), col: (i) => `hsl(${Math.round(i / NS * 360)}, 95%, 60%)` });
  // 每個陣型的顏色先算好
  const tmpC = new THREE.Color();
  for (const f of F) { f.c = new Float32Array(NS * 3); f.pts.forEach((p, i) => { tmpC.set(f.col(i, p[0], p[1])); f.c[i * 3] = tmpC.r; f.c[i * 3 + 1] = tmpC.g; f.c[i * 3 + 2] = tmpC.b; }); }
  // 起飛位置：海面上一片方陣
  const startP = []; { const n = Math.ceil(Math.sqrt(NS)); for (let i = 0; i < NS; i++) startP.push(new THREE.Vector3(site.x + ((i % n) / (n - 1) - .5) * 10, .6, site.z - 4 + (Math.floor(i / n) / (n - 1) - .5) * 6)); }
  const T_UP = 5, T_MORPH = 2.6, T_HOLD = 3.6, T_DOWN = 6, SHOW_LEN = T_UP + F.length * (T_MORPH + T_HOLD) + T_DOWN;
  const showGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(NS * 3), sCol = new Float32Array(NS * 4), sSize = new Float32Array(NS).fill(1);
  showGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  showGeo.setAttribute('rgba', new THREE.BufferAttribute(sCol, 4).setUsage(THREE.DynamicDrawUsage));
  showGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
  const showMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec4 rgba; attribute float size; uniform float uScale; varying vec4 vC; void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(size * .9 * uScale / -mv.z, 2.0, 40.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float r = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, r); a = a * a + smoothstep(.15, .0, r); gl_FragColor = vec4(vC.rgb * vC.a * a, 1.0); }',
  });
  const showPts = new THREE.Points(showGeo, showMat); showPts.frustumCulled = false; showPts.visible = false; showPts.renderOrder = 5; scene.add(showPts);
  const shows = [];   // 開始時間（毫秒，網路時間）
  function startShow(at = now()) { if (shows.some((s) => Math.abs(s - at) < 1000)) return false; shows.push(at); return true; }
  const fp = (f, i, t, out) => { let x = f.pts[i][0], y = f.pts[i][1]; if (f.spin) { const a = t * 1.4, c = Math.cos(a), s = Math.sin(a); [x, y] = [x * c - y * s, x * s + y * c]; } return out.set(site.x + x * SC * 2, CY + y * SC * 2, site.z + 2); };
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  function showStep(night) {
    const tn = now();
    for (let k = shows.length - 1; k >= 0; k--) if (tn - shows[k] > SHOW_LEN * 1000) shows.splice(k, 1);
    const at = shows.filter((s) => s <= tn).sort((a, b) => a - b)[0];
    if (at == null) { showPts.visible = false; return; }
    const t = (tn - at) / 1000; showPts.visible = true;
    showMat.uniforms.uScale.value = W.renderer.domElement.height / (2 * Math.tan(W.camera.fov * Math.PI / 360));
    const bright = night > .4 ? 1.5 : 2.2;
    for (let i = 0; i < NS; i++) {
      let r, g, b, al = bright;
      if (t < T_UP) { fp(F[0], i, 0, B); const k = ease(t / T_UP); A.copy(startP[i]).lerp(B, k); r = g = b = 1; al = bright * (.4 + .6 * k); }
      else if (t > SHOW_LEN - T_DOWN) { const fl = F[F.length - 1]; fp(fl, i, t, A); const k = ease((t - (SHOW_LEN - T_DOWN)) / T_DOWN); A.lerp(startP[i], k); r = fl.c[i * 3] * (1 - k) + k; g = fl.c[i * 3 + 1] * (1 - k) + k; b = fl.c[i * 3 + 2] * (1 - k) + k; al = bright * (1 - k * .6); }
      else {
        const u = t - T_UP, step = T_MORPH + T_HOLD, j = Math.floor(u / step), lt = u - j * step;
        const f1 = F[Math.min(j, F.length - 1)], f0 = F[Math.max(0, j - 1)];
        if (lt < T_MORPH && j > 0) { const k = ease(lt / T_MORPH); fp(f0, i, t, A); fp(f1, i, t, B); A.lerp(B, k); r = f0.c[i * 3] + (f1.c[i * 3] - f0.c[i * 3]) * k; g = f0.c[i * 3 + 1] + (f1.c[i * 3 + 1] - f0.c[i * 3 + 1]) * k; b = f0.c[i * 3 + 2] + (f1.c[i * 3 + 2] - f0.c[i * 3 + 2]) * k; }
        else { fp(f1, i, t, A); r = f1.c[i * 3]; g = f1.c[i * 3 + 1]; b = f1.c[i * 3 + 2]; if (f1.name === 'grid') { const w = .5 + .5 * Math.sin(t * 3 + A.x * .4); r = g = b = 1; al = bright * (.6 + .4 * w); } }
      }
      A.y += Math.sin(t * 2 + i) * .04;   // 微微飄
      sPos[i * 3] = A.x; sPos[i * 3 + 1] = A.y; sPos[i * 3 + 2] = A.z;
      sCol[i * 4] = r; sCol[i * 4 + 1] = g; sCol[i * 4 + 2] = b; sCol[i * 4 + 3] = al;
    }
    showGeo.attributes.position.needsUpdate = true; showGeo.attributes.rgba.needsUpdate = true;
  }

  // ================================================================ 每一格
  function update(dt, night = 0) {
    dt = Math.min(dt, .05);
    pilotStep(dt);
    parked.spin(0);
    for (const c of couriers) {
      c.u = (c.u + dt * 3.2 / c.len) % 1;
      const p = c.curve.getPointAt(c.u), q = c.curve.getPointAt((c.u + .004) % 1);
      c.d.g.position.copy(p); c.d.g.rotation.set(.12, Math.atan2(q.x - p.x, q.z - p.z), 0, 'YXZ'); c.d.spin(dt);
    }
    for (let k = drops.length - 1; k >= 0; k--) { const b = drops[k]; b.userData.t += dt; if (b.position.y > b.userData.gy) { b.userData.vy -= 9.8 * dt; b.position.y = Math.max(b.userData.gy, b.position.y + b.userData.vy * dt); } if (b.userData.t > 4) { scene.remove(b); drops.splice(k, 1); } }
    showStep(night);
  }
  return {
    update, startShow, showLen: SHOW_LEN, showing: () => { const tn = now(); return shows.some((s) => tn >= s - 2000 && tn - s < SHOW_LEN * 1000); }, base, showSite: site,
    pilot: { start: startPilot, stop: stopPilot, cam: pilotCam, state: P, get on() { return P.on; } },
    couriers: () => couriers.map((c) => c.d.g.position.clone()),
    avoid: [base, base.clone().add(new THREE.Vector3(1, 0, 0)), base.clone().add(new THREE.Vector3(-1, 0, 0))],
  };
}
