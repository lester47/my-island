// 🎆 煙火：花鯉魚幣在「煙火船」放煙火，全市集的人都看得到
// - 12 種花樣：菊花、牡丹、金柳、椰子樹、愛心、星星、笑臉、彩虹環、環中環、鯉魚、十字分裂、滿天星
// - 每顆火花都會拖出一條彩色的光線（尾巴越後面越淡），爆開時有閃光照亮海面
// - 用「種子＋網路時間」決定花樣，所以大家看到同一場煙火
import * as THREE from 'three';
import { TAU, rng } from './kit.js?v=20261126d';

export const FW_KINDS = [
  { id: 'mum', icon: '🌼', name: '菊花' },
  { id: 'peony', icon: '🌺', name: '雙色牡丹' },
  { id: 'willow', icon: '🌾', name: '金色垂柳' },
  { id: 'palm', icon: '🌴', name: '椰子樹' },
  { id: 'heart', icon: '💖', name: '愛心' },
  { id: 'star', icon: '⭐', name: '星星' },
  { id: 'smile', icon: '😊', name: '笑臉' },
  { id: 'ring', icon: '🌈', name: '彩虹環' },
  { id: 'double', icon: '🎯', name: '環中環' },
  { id: 'koi', icon: '🎏', name: '鯉魚' },
  { id: 'cross', icon: '✨', name: '十字分裂' },
  { id: 'glitter', icon: '🌟', name: '滿天星' },
];
const KIND_IDS = FW_KINDS.map((k) => k.id);
const PAL = ['#ff3355', '#ff8a1f', '#ffd21f', '#4dff6a', '#22d6ff', '#4d7bff', '#b45cff', '#ff4fd8', '#ffffff', '#7dfff0'];
const HN = 9;                    // 每顆火花記住 9 個舊位置 → 拖出一條線
const REC = .03;                 // 每 0.03 秒記一次位置

export function createFireworks(W, opts = {}) {
  const { scene } = W, low = !!opts.low, now = opts.now || (() => Date.now()), snd = opts.snd || null;
  const CAP = low ? 2600 : 5200;
  const site = new THREE.Vector3(opts.site?.x ?? 0, 0, opts.site?.z ?? -44);

  // ------------------------------------------------ 煙火船（發射台）
  const boat = new THREE.Group(); boat.position.copy(site); scene.add(boat);
  const sm = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .75, flatShading: true, ...o });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, .6, 2.2), sm('#7a3b2a')); hull.position.y = .15; hull.castShadow = true; boat.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, .1, 2.0), sm('#c8955a')); deck.position.y = .5; boat.add(deck);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(3.4, .14, .14), sm('#ffcc33')); st.position.set(0, .42, sx * 1.1); boat.add(st); }
  const tubeM = sm('#2b2b33', { metalness: .3 }), tubes = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .8, 10), tubeM); const x = -1.1 + (i % 3) * 1.1, z = i < 3 ? -.45 : .45;
    t.position.set(x, .95, z); t.rotation.z = (x > 0 ? -1 : x < 0 ? 1 : 0) * .12; t.castShadow = true; boat.add(t); tubes.push(t);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.17, .03, 6, 12), sm(PAL[i])); rim.rotation.x = Math.PI / 2; rim.position.set(x, 1.35, z); boat.add(rim);
  }
  // 旗子＋招牌
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.6, 6), sm('#eeeeee')); pole.position.set(1.55, 1.8, -.9); boat.add(pole);
  const flagC = document.createElement('canvas'); flagC.width = 256; flagC.height = 128; { const x = flagC.getContext('2d'); const g = x.createLinearGradient(0, 0, 256, 0); PAL.slice(0, 7).forEach((c, i) => g.addColorStop(i / 6, c)); x.fillStyle = g; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('煙火', 128, 66); }
  const flagT = new THREE.CanvasTexture(flagC); flagT.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .65), new THREE.MeshStandardMaterial({ map: flagT, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: flagT, emissiveIntensity: .15 }));
  flag.position.set(1.55 - .67, 2.75, -.9); boat.add(flag);
  boat.rotation.y = Math.atan2(-site.x, -site.z);       // 船頭對著服務台島
  const tubeTop = (i) => { const t = tubes[i % tubes.length]; boat.updateMatrixWorld(); return new THREE.Vector3(0, .42, 0).applyMatrix4(t.matrixWorld); };

  // ------------------------------------------------ 粒子池
  const P = {
    x: new Float32Array(CAP * 3), v: new Float32Array(CAP * 3), c: new Float32Array(CAP * 3), c2: new Float32Array(CAP * 3),
    age: new Float32Array(CAP), life: new Float32Array(CAP), drag: new Float32Array(CAP), grav: new Float32Array(CAP), size: new Float32Array(CAP),
    flag: new Uint8Array(CAP), rec: new Float32Array(CAP), hist: new Float32Array(CAP * HN * 3), hn: new Uint8Array(CAP), tl: new Float32Array(CAP),
  };
  let n = 0;
  // flag 位元：1 閃爍、2 會再分裂（十字）、4 是火箭（尾巴是金色火花）
  const col = new THREE.Color(), col2 = new THREE.Color();
  function spawn(x, y, z, vx, vy, vz, c, o = {}) {
    if (n >= CAP) return -1;
    const i = n++, i3 = i * 3;
    P.x[i3] = x; P.x[i3 + 1] = y; P.x[i3 + 2] = z; P.v[i3] = vx; P.v[i3 + 1] = vy; P.v[i3 + 2] = vz;
    col.set(c); P.c[i3] = col.r; P.c[i3 + 1] = col.g; P.c[i3 + 2] = col.b;
    col2.set(o.c2 || c); P.c2[i3] = col2.r; P.c2[i3 + 1] = col2.g; P.c2[i3 + 2] = col2.b;
    P.age[i] = 0; P.life[i] = o.life ?? 2; P.drag[i] = o.drag ?? 1.6; P.grav[i] = o.grav ?? 3.2; P.size[i] = o.size ?? .55;
    P.flag[i] = o.flag || 0; P.rec[i] = 0; P.hn[i] = 0; P.tl[i] = o.trail ?? 1;
    for (let k = 0; k < HN; k++) { const h = (i * HN + k) * 3; P.hist[h] = x; P.hist[h + 1] = y; P.hist[h + 2] = z; }
    return i;
  }
  function kill(i) {   // 把最後一顆搬到 i 的位置
    const j = --n; if (i === j) return;
    for (const a of ['x', 'v', 'c', 'c2']) { const A = P[a]; A[i * 3] = A[j * 3]; A[i * 3 + 1] = A[j * 3 + 1]; A[i * 3 + 2] = A[j * 3 + 2]; }
    for (const a of ['age', 'life', 'drag', 'grav', 'size', 'flag', 'rec', 'hn', 'tl']) P[a][i] = P[a][j];
    P.hist.copyWithin(i * HN * 3, j * HN * 3, (j + 1) * HN * 3);
  }

  // ------------------------------------------------ 畫：火花頭（發光圓點）＋拖尾線（線段）
  const headGeo = new THREE.BufferGeometry();
  const hPos = new Float32Array(CAP * 3), hCol = new Float32Array(CAP * 4), hSize = new Float32Array(CAP);
  headGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3).setUsage(THREE.DynamicDrawUsage));
  headGeo.setAttribute('rgba', new THREE.BufferAttribute(hCol, 4).setUsage(THREE.DynamicDrawUsage));
  headGeo.setAttribute('size', new THREE.BufferAttribute(hSize, 1).setUsage(THREE.DynamicDrawUsage));
  const headMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec4 rgba; attribute float size; uniform float uScale; varying vec4 vC; void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(size * uScale / -mv.z, 1.5, 64.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); float a = smoothstep(.5, .0, r); a = a * a + smoothstep(.18, .0, r) * .8; gl_FragColor = vec4(vC.rgb * vC.a * a, 1.0); }',
  });
  const heads = new THREE.Points(headGeo, headMat); heads.frustumCulled = false; heads.renderOrder = 5; scene.add(heads);
  const SEG = HN - 1;
  const trailGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(CAP * SEG * 2 * 3), tCol = new Float32Array(CAP * SEG * 2 * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3).setUsage(THREE.DynamicDrawUsage));
  const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const trails = new THREE.LineSegments(trailGeo, trailMat); trails.frustumCulled = false; trails.renderOrder = 4; scene.add(trails);
  // 爆開的閃光：一個大光暈＋一盞會很快變暗的燈（照亮海面和島）
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const flashes = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); s.visible = false; scene.add(s); flashes.push({ s, t: 9 }); }
  const light = new THREE.PointLight('#ffffff', 0, 90, 1.2); light.position.set(site.x, 30, site.z); scene.add(light);
  let lightK = 0;

  // ------------------------------------------------ 花樣
  const V = new THREE.Vector3(), U = new THREE.Vector3(), Rr = new THREE.Vector3(), F = new THREE.Vector3();
  const pick = (R) => PAL[Math.floor(R() * PAL.length)];
  const SP = 1.25;   // 離得比較遠：整體放大一點
  const sphereDir = (R) => { const u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u); return V.set(Math.cos(a) * s, u, Math.sin(a) * s); };
  // 平面圖案（愛心、星星…）要面對看的人：用鏡頭方向算出「右」和「上」
  function facing() { W.camera.getWorldDirection(F); F.y = 0; if (F.lengthSq() < 1e-4) F.set(0, 0, -1); F.normalize(); Rr.set(-F.z, 0, F.x); U.set(0, 1, 0); }
  function planar(o, pts, speed, c, opt) { facing(); for (const [px, py] of pts) spawn(o.x, o.y, o.z, (Rr.x * px) * speed, py * speed, (Rr.z * px) * speed, typeof c === 'function' ? c(px, py) : c, opt); }
  const burstFns = {
    mum(o, R) { const c = pick(R), N = low ? 90 : 160; for (let i = 0; i < N; i++) { sphereDir(R); const s = 10 + R() * 1.5; spawn(o.x, o.y, o.z, V.x * s, V.y * s, V.z * s, c, { life: 2.2 + R() * .4, c2: '#ffd27a', trail: 1.2 }); } },
    peony(o, R) { const a = pick(R), b = pick(R), N = low ? 100 : 180; for (let i = 0; i < N; i++) { sphereDir(R); const s = 9 + R() * 2; spawn(o.x, o.y, o.z, V.x * s, V.y * s, V.z * s, i % 2 ? a : b, { life: 1.8 + R() * .5, trail: .6, flag: R() < .3 ? 1 : 0 }); } },
    willow(o, R) { const N = low ? 80 : 140; for (let i = 0; i < N; i++) { sphereDir(R); const s = 7 + R() * 2; spawn(o.x, o.y, o.z, V.x * s, V.y * s + 1.5, V.z * s, '#ffcf5a', { life: 3.6 + R() * .8, drag: 2.4, grav: 1.6, c2: '#ff7a1a', trail: 2.2, size: .45, flag: R() < .25 ? 1 : 0 }); } o.crackle = true; },
    palm(o, R) { const c = pick(R), arms = 7; for (let k = 0; k < arms; k++) { const a = k / arms * TAU + R() * .3, up = .25 + R() * .45; for (let j = 0; j < (low ? 10 : 18); j++) { const s = 6 + j * .45 + R() * .3; spawn(o.x, o.y, o.z, Math.cos(a) * s * (1 - up * .5), up * s + 2, Math.sin(a) * s * (1 - up * .5), j % 3 ? '#ffd27a' : c, { life: 2.6, drag: 1.4, grav: 4, trail: 1.6, size: .6 }); } } },
    heart(o, R) { const c = R() < .5 ? '#ff4f8a' : '#ff3355', pts = []; const N = low ? 60 : 90; for (let i = 0; i < N; i++) { const t = i / N * TAU; pts.push([16 * Math.sin(t) ** 3 / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]); } planar(o, pts, 9, c, { life: 2.2, drag: 1.5, grav: 1.2, trail: .8, c2: '#ffb3d1' }); burstFns.sparkle(o, R, 30, '#ffffff'); },
    star(o, R) { const c = pick(R), pts = []; const N = low ? 70 : 110; for (let i = 0; i < N; i++) { const t = i / N, seg = Math.floor(t * 10), f = t * 10 - seg; const a0 = seg / 10 * TAU + Math.PI / 2, a1 = (seg + 1) / 10 * TAU + Math.PI / 2, r0 = seg % 2 ? .42 : 1, r1 = seg % 2 ? 1 : .42; const x = Math.cos(a0) * r0 * (1 - f) + Math.cos(a1) * r1 * f, y = Math.sin(a0) * r0 * (1 - f) + Math.sin(a1) * r1 * f; pts.push([x, y]); } planar(o, pts, 10, c, { life: 2.2, drag: 1.5, grav: 1.2, trail: .8, c2: '#ffffff' }); },
    smile(o, R) { const pts = []; const N = low ? 50 : 80; for (let i = 0; i < N; i++) { const t = i / N * TAU; pts.push([Math.cos(t), Math.sin(t)]); } planar(o, pts, 10, '#ffd21f', { life: 2.3, drag: 1.5, grav: 1.1, trail: .7 }); const in2 = []; for (let i = 0; i <= 22; i++) { const t = Math.PI * (1.15 + i / 22 * .7); in2.push([Math.cos(t) * .6, Math.sin(t) * .6]); } for (const ex of [-.35, .35]) for (let i = 0; i < 8; i++) { const t = i / 8 * TAU; in2.push([ex + Math.cos(t) * .1, .32 + Math.sin(t) * .12]); } planar(o, in2, 10, '#22d6ff', { life: 2.3, drag: 1.5, grav: 1.1, trail: .7 }); },
    ring(o, R) { const N = low ? 70 : 120, tilt = .5 + R() * .7, yaw = R() * TAU; for (let i = 0; i < N; i++) { const a = i / N * TAU; V.set(Math.cos(a), 0, Math.sin(a)).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); spawn(o.x, o.y, o.z, V.x * 11, V.y * 11, V.z * 11, PAL[Math.floor(i / N * 8)], { life: 2.2, trail: 1.1 }); } },
    double(o, R) { const a = pick(R), b = pick(R); for (let i = 0; i < (low ? 70 : 130); i++) { sphereDir(R); spawn(o.x, o.y, o.z, V.x * 12, V.y * 12, V.z * 12, a, { life: 2.3, trail: 1 }); } for (let i = 0; i < (low ? 40 : 70); i++) { sphereDir(R); spawn(o.x, o.y, o.z, V.x * 5.5, V.y * 5.5, V.z * 5.5, b, { life: 2.1, trail: .8, flag: 1 }); } },
    koi(o, R) {   // 一條錦鯉：白色身體輪廓（頭圓、尾巴細）＋大尾鰭＋背鰭、胸鰭＋紅色斑塊＋金色眼睛
      const body = [], red = [], gold = [], N = low ? 70 : 110;
      const half = (u) => .36 * Math.sqrt(Math.max(0, 1 - u * u)) * (u < 0 ? .55 + .45 * (1 + u) : 1);   // u：-1 尾端～1 頭
      for (let i = 0; i <= N / 2; i++) { const u = -1 + i / (N / 2) * 2; body.push([u * .8, half(u)], [u * .8, -half(u)]); }
      for (let i = 0; i < 30; i++) { const t = i / 29, a = (t - .5) * 1.5; body.push([-.8 - Math.cos(a) * .5 * (.55 + .45 * Math.abs(Math.sin(a * 2))), Math.sin(a) * .55]); }   // 尾鰭（扇形）
      for (let i = 0; i < 12; i++) { const t = i / 11; body.push([-.1 + t * .45, .36 + Math.sin(t * Math.PI) * .2]); }   // 背鰭
      for (let i = 0; i < 8; i++) { const t = i / 7; body.push([.3 - t * .25, -.34 - t * .22]); }   // 胸鰭
      for (const [cx, cy, rx, ry] of [[.35, .05, .2, .2], [-.15, .08, .17, .17], [.62, .05, .1, .12]]) for (let i = 0; i < 18; i++) { const t = i / 18 * TAU, r = Math.sqrt((i % 3 + 1) / 3); red.push([cx + Math.cos(t) * rx * r, cy + Math.sin(t) * ry * r]); }
      for (let i = 0; i < 8; i++) { const t = i / 8 * TAU; gold.push([.62 + Math.cos(t) * .05, -.08 + Math.sin(t) * .05]); }
      const opt = { life: 2.5, drag: 1.5, grav: .9, trail: .8 };
      planar(o, body, 10, '#ffffff', { ...opt, c2: '#ffe0e0' });
      planar(o, red, 10, '#ff2a3d', opt);
      planar(o, gold, 10, '#ffd21f', { ...opt, size: .7 });
    },
    cross(o, R) { const c = pick(R); for (let i = 0; i < (low ? 26 : 40); i++) { sphereDir(R); spawn(o.x, o.y, o.z, V.x * 9, V.y * 9, V.z * 9, c, { life: .9 + R() * .2, trail: 1.2, flag: 2, c2: pick(R), size: .7 }); } },
    glitter(o, R) { for (let i = 0; i < (low ? 120 : 220); i++) { sphereDir(R); const s = 4 + R() * 8; spawn(o.x, o.y, o.z, V.x * s, V.y * s, V.z * s, R() < .5 ? '#ffffff' : '#fff2a8', { life: 2.4 + R(), trail: .35, flag: 1, size: .5, grav: 2 }); } o.crackle = true; },
    sparkle(o, R, N = 40, c = '#ffffff') { for (let i = 0; i < N; i++) { sphereDir(R); const s = 2 + R() * 4; spawn(o.x, o.y, o.z, V.x * s, V.y * s, V.z * s, c, { life: 1.6 + R(), trail: .3, flag: 1, size: .4 }); } },
  };

  // ------------------------------------------------ 火箭（升空）→ 爆開
  const shells = [];   // { at(秒，網路時間), kind, seed, tube, x..., fired, burst }
  let listener = new THREE.Vector3();
  function boomSound(o, crackle) {
    if (!snd) return; const d = listener.distanceTo(o), vol = Math.max(.12, Math.min(1, 26 / (d + 6)));
    snd.boom({ delay: Math.min(.35, d / 340), vol, crackle });
  }
  function burst(o, kind, R) {
    o.crackle = false; const n0 = n; (burstFns[kind] || burstFns.mum)(o, R);
    for (let i = n0; i < n; i++) { P.v[i * 3] *= SP; P.v[i * 3 + 1] *= SP; P.v[i * 3 + 2] *= SP; P.size[i] *= 1.2; }
    const f = flashes.find((q) => q.t > .5) || flashes[0]; f.t = 0; f.s.position.copy(o); f.s.visible = true;
    const fc = col.set(PAL[Math.floor(R() * 8)]); f.s.material.color.copy(fc).lerp(col2.set('#ffffff'), .5);
    light.position.copy(o); light.color.copy(f.s.material.color); lightK = 1;
    boomSound(o, o.crackle);
  }
  function fireShell(s) {
    const p = tubeTop(s.tube), R = rng(s.seed);
    const h = 26 + R() * 10, side = (R() - .5) * 10, side2 = (R() - .5) * 6;
    s.p = p.clone(); s.v = new THREE.Vector3(side * .25, Math.sqrt(2 * 9.8 * (h - p.y)) * .98, side2 * .25); s.R = R;
    s.head = spawn(p.x, p.y, p.z, 0, 0, 0, '#ffe2a0', { life: 99, trail: 1.6, flag: 4, size: .7 });
    s.fired = true;
    if (snd) { const d = listener.distanceTo(p); if (d < 60) snd.whistle({ vol: Math.max(.2, 1 - d / 60), len: s.v.y / 9.8 * .9 }); }
  }

  // 放一發（或一整場）煙火；at：網路時間（毫秒）
  function launch(kind, seed, at = now()) {
    seed = (seed >>> 0) || 1;
    if (kind === 'show') {
      const R = rng(seed), out = [];
      for (let i = 0; i < 9; i++) out.push({ at: at + i * 900 + R() * 300, kind: KIND_IDS[Math.floor(R() * KIND_IDS.length)], seed: (seed * 31 + i * 977) >>> 0, tube: i });
      for (let i = 0; i < 4; i++) out.push({ at: at + 9 * 900 + 700 + i * 120, kind: ['peony', 'glitter', 'ring', 'willow'][i], seed: (seed * 17 + i * 131) >>> 0, tube: i + 1 });   // 最後一次齊放
      shells.push(...out); return out.length;
    }
    shells.push({ at, kind: KIND_IDS.includes(kind) ? kind : 'mum', seed, tube: seed % 6 }); return 1;
  }

  // ------------------------------------------------ 每一格
  const G = 9.8;
  function update(dt, night = 1) {
    dt = Math.min(dt, .05);
    listener.copy(W.camera.position);
    headMat.uniforms.uScale.value = W.renderer.domElement.height / (2 * Math.tan(W.camera.fov * Math.PI / 360));
    const tnow = now();
    // 火箭
    for (let k = shells.length - 1; k >= 0; k--) {
      const s = shells[k];
      if (!s.fired) { if (tnow >= s.at) { if (tnow - s.at > 4000) { shells.splice(k, 1); continue; } fireShell(s); } else continue; }
      s.v.y -= G * dt; s.p.addScaledVector(s.v, dt);
      // 火箭的頭跟著走；路上灑金色小火花
      if (s.head >= 0 && s.head < n && P.flag[s.head] & 4) { const h3 = s.head * 3; P.x[h3] = s.p.x; P.x[h3 + 1] = s.p.y; P.x[h3 + 2] = s.p.z; }
      if (Math.random() < (low ? .35 : .7)) spawn(s.p.x, s.p.y, s.p.z, (Math.random() - .5) * 1.2, -1 - Math.random() * 2, (Math.random() - .5) * 1.2, '#ffb347', { life: .45 + Math.random() * .3, trail: .25, size: .35 });
      if (s.v.y <= 1.2) {
        if (s.head >= 0 && s.head < n && P.flag[s.head] & 4) P.life[s.head] = 0;   // 火箭頭消失
        burst(s.p.clone(), s.kind, s.R); shells.splice(k, 1);
      }
    }
    // 粒子
    let w = 0;
    for (let i = 0; i < n;) {
      P.age[i] += dt;
      if (P.age[i] >= P.life[i]) {
        if (P.flag[i] & 2) {   // 十字分裂：死掉的地方再炸出 4 顆
          const i3 = i * 3; for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + Math.random() * .4; spawn(P.x[i3], P.x[i3 + 1], P.x[i3 + 2], Math.cos(a) * 5 + P.v[i3] * .3, (Math.random() - .3) * 4, Math.sin(a) * 5 + P.v[i3 + 2] * .3, '#ffffff', { life: .9, trail: .7, c2: '#ffd27a' }); }
          P.flag[i] &= ~2;
        }
        // 火箭頭找出它在哪：被搬移時要更新 shells 的索引
        for (const s of shells) if (s.head === i) s.head = -1;
        if (n - 1 !== i) for (const s of shells) if (s.head === n - 1) s.head = i;
        kill(i); continue;
      }
      const i3 = i * 3;
      if (!(P.flag[i] & 4)) {
        const dr = Math.exp(-P.drag[i] * dt);
        P.v[i3] *= dr; P.v[i3 + 1] = P.v[i3 + 1] * dr - P.grav[i] * dt; P.v[i3 + 2] *= dr;
        P.x[i3] += P.v[i3] * dt; P.x[i3 + 1] += P.v[i3 + 1] * dt; P.x[i3 + 2] += P.v[i3 + 2] * dt;
      }
      // 記錄位置（拖尾）
      P.rec[i] += dt;
      const hb = i * HN * 3;
      if (P.rec[i] >= REC * P.tl[i]) { P.rec[i] = 0; P.hist.copyWithin(hb + 3, hb, hb + (HN - 1) * 3); if (P.hn[i] < HN) P.hn[i]++; }
      P.hist[hb] = P.x[i3]; P.hist[hb + 1] = P.x[i3 + 1]; P.hist[hb + 2] = P.x[i3 + 2];
      // 顏色：慢慢從 c 變成 c2，最後 30% 淡出；閃爍的忽明忽暗
      const k = P.age[i] / P.life[i], fade = P.flag[i] & 4 ? 1 : k > .7 ? 1 - (k - .7) / .3 : 1;
      let br = fade * (P.flag[i] & 1 ? (Math.random() < .5 ? 1.4 : .25) : 1);
      const ck = Math.min(1, k * 1.3), r = P.c[i3] + (P.c2[i3] - P.c[i3]) * ck, g = P.c[i3 + 1] + (P.c2[i3 + 1] - P.c[i3 + 1]) * ck, b = P.c[i3 + 2] + (P.c2[i3 + 2] - P.c[i3 + 2]) * ck;
      const day = night < .5 ? 1.25 : 1;
      hPos[w * 3] = P.x[i3]; hPos[w * 3 + 1] = P.x[i3 + 1]; hPos[w * 3 + 2] = P.x[i3 + 2];
      hCol[w * 4] = r; hCol[w * 4 + 1] = g; hCol[w * 4 + 2] = b; hCol[w * 4 + 3] = br * 1.6 * day; hSize[w] = P.size[i] * (k < .06 ? 1.8 : 1);
      // 拖尾線段
      const hn = P.hn[i], tb = w * SEG * 6;
      for (let s = 0; s < SEG; s++) {
        const o = tb + s * 6;
        if (s >= hn - 1 || hn < 2) { for (let z = 0; z < 6; z++) { tPos[o + z] = 0; tCol[o + z] = 0; } continue; }
        const a = hb + s * 3, b2 = hb + (s + 1) * 3;
        tPos[o] = P.hist[a]; tPos[o + 1] = P.hist[a + 1]; tPos[o + 2] = P.hist[a + 2];
        tPos[o + 3] = P.hist[b2]; tPos[o + 4] = P.hist[b2 + 1]; tPos[o + 5] = P.hist[b2 + 2];
        const f0 = (1 - s / SEG) * fade * day, f1 = (1 - (s + 1) / SEG) * fade * day;
        tCol[o] = r * f0; tCol[o + 1] = g * f0; tCol[o + 2] = b * f0; tCol[o + 3] = r * f1; tCol[o + 4] = g * f1; tCol[o + 5] = b * f1;
      }
      w++; i++;
    }
    headGeo.setDrawRange(0, w); trailGeo.setDrawRange(0, w * SEG * 2);
    if (w) { for (const a of ['position', 'rgba', 'size']) headGeo.attributes[a].needsUpdate = true; trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true; }
    heads.visible = trails.visible = w > 0;
    // 閃光
    for (const f of flashes) { if (f.t > .5) continue; f.t += dt; const k = f.t / .5; f.s.material.opacity = (1 - k) * (night > .3 ? .9 : .5); f.s.scale.setScalar(10 + k * 14); if (f.t > .5) f.s.visible = false; }
    lightK = Math.max(0, lightK - dt * 2.2); light.intensity = lightK * lightK * (night > .3 ? 160 : 30);
  }
  return { launch, update, boat, site, kinds: FW_KINDS, busy: () => shells.length > 0, count: () => n };
}
