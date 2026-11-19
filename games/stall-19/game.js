// 第 19 攤・三二一發射！／戰鬥陀螺（3D 版）：倒數後按住「發射」貯力，在綠色區放開；陀螺在碗形擂台裡互撞，先停下或被撞出場的輸
// 物理在 400×600 的平面上算（和 2D 版一樣），畫面用 Three.js 畫成 3D；力道條、文字畫在上層的 HUD
import * as THREE from 'three';
import { LIYU } from '../_kit/kit.js?v=20261119a';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 19, title: '三二一發射！戰鬥陀螺', stall: '三二一發射！／戰鬥陀螺',
  how: ['3D 擂台！倒數 3、2、1 後，按住下方「發射」貯力', '力道條在綠色區放開最強', '對戰中點擂台，可以把你的陀螺往那個方向推一下（每場 3 次）', '你的陀螺比對手轉得久就贏；被撞出擂台就輸', '連贏 3 個對手就是陀螺王！'],
  clear: '讓自己的陀螺比對手轉得更久（贏 1 場，和現場一樣）',
  pushes: 3,
  rivals: [                                                               // 對手：名字、顏色、發射力道、重量
    { name: '小旋風', color: '#7cc576', power: .62, mass: .9 },
    { name: '火焰王', color: '#e8473f', power: .78, mass: 1.05 },
    { name: '黑鐵龍', color: '#3a3a4a', power: .86, mass: 1.1 },
  ],
  credit: '第 19 攤 三二一發射！／戰鬥陀螺',
};
const AX = 200, AY = 300, AR = 165, TR = 24, BTN = { x: 200, y: 545, w: 200, h: 60 };
let phase, cd, charge, holding, me, cpu, rival, wins, pushes, msg, endT;
function start() { wins = 0; rival = 0; newMatch(); }
function newMatch() { phase = 'count'; cd = 3.2; charge = 0; holding = false; me = cpu = null; pushes = CONFIG.pushes; msg = ''; endT = 0; }
const mkTop = (x, y, vx, vy, spin, mass, color, mine) => ({ x, y, vx, vy, spin, mass, color, mine, ang: 0, out: 0 });
function launch(pow) {
  const R = CONFIG.rivals[rival], cp = R.power * (.9 + Math.random() * .2);
  me = mkTop(AX - 110, AY + 60, 180 + pow * 40, -60 - Math.random() * 60, .5 + pow * .5, 1, '#e8762b', true);      // 力道主要決定轉速
  cpu = mkTop(AX + 110, AY - 60, -(180 + cp * 40), 60 + Math.random() * 60, .5 + cp * .5, R.mass, R.color, false);
  phase = 'battle'; LIYU.sfx('throw'); msg = pow > .85 ? '💥 完美發射！' : pow > .6 ? '不錯的發射！' : '發射力道有點弱…';
}
// 力道條：按住時在 0～1 之間來回跑；綠色區 0.8～0.95
const powNow = () => { const k = (charge % 2); return k < 1 ? k : 2 - k; };
LIYU.on('down', (x, y) => {
  if (!LIYU.running) return;
  if (phase === 'ready' && Math.abs(x - BTN.x) < BTN.w / 2 && Math.abs(y - BTN.y) < BTN.h / 2) { holding = true; charge = 0; LIYU.sfx('tap'); return; }
  if (phase === 'battle' && me && pushes > 0 && y > 90 && y < 500) {
    const q = toArena(x, y); if (!q) return;
    const dx = q.x - me.x, dy = q.y - me.y, d = Math.hypot(dx, dy) || 1; me.vx += dx / d * 150; me.vy += dy / d * 150; pushes--; LIYU.sfx('tap');
  }
});
LIYU.on('up', () => { if (holding && phase === 'ready') { holding = false; launch(powNow()); } });

function physics(dt) {
  for (const t of [me, cpu]) {
    if (t.out) continue;
    const dx = t.x - AX, dy = t.y - AY;
    t.vx += -dx * 1.6 * dt; t.vy += -dy * 1.6 * dt;                         // 碗形擂台：往中間滑
    t.vx *= Math.pow(.55, dt); t.vy *= Math.pow(.55, dt);
    t.x += t.vx * dt; t.y += t.vy * dt;
    t.spin -= dt * (.06 + Math.hypot(t.vx, t.vy) / 7000);                  // 慢慢變慢
    t.ang += t.spin * dt * 40;
    if (Math.hypot(t.x - AX, t.y - AY) > AR - 4) { t.out = 1; t.spin = 0; LIYU.sfx('miss'); }
  }
  const dx = cpu.x - me.x, dy = cpu.y - me.y, d = Math.hypot(dx, dy);
  if (d < TR * 2 && d > 0 && !me.out && !cpu.out) {
    const nx = dx / d, ny = dy / d, rv = (me.vx - cpu.vx) * nx + (me.vy - cpu.vy) * ny;
    const push = (TR * 2 - d) / 2; me.x -= nx * push; me.y -= ny * push; cpu.x += nx * push; cpu.y += ny * push;
    if (rv > 0) {
      const kick = 1.7 * rv / (me.mass + cpu.mass) + 60;                    // 互相彈開（重的比較不會被彈）
      me.vx -= nx * kick * cpu.mass; me.vy -= ny * kick * cpu.mass; cpu.vx += nx * kick * me.mass; cpu.vy += ny * kick * me.mass;
      const hitE = Math.min(.16, rv / 2400 + .03);                           // 轉速損失：轉得慢的那個吃虧
      me.spin -= hitE * cpu.spin / (me.spin + cpu.spin + .01) * (1.1 / me.mass); cpu.spin -= hitE * me.spin / (me.spin + cpu.spin + .01) * (1.1 / cpu.mass);
      LIYU.sfx('bump'); sparks((me.x + cpu.x) / 2, (me.y + cpu.y) / 2, Math.min(28, 8 + rv / 20));
    }
  }
}
function result(win) {
  phase = 'end'; endT = 1.6;
  if (win) { wins++; LIYU.sfx('win'); msg = `🏆 你贏了 ${CONFIG.rivals[rival].name}！`; LIYU.clear(wins); }
  else { msg = `${CONFIG.rivals[rival].name} 贏了…`; LIYU.sfx('lose'); }
  setTimeout(() => {
    if (!LIYU.running) return;
    if (win && rival < CONFIG.rivals.length - 1) { rival++; newMatch(); LIYU.toast(`下一個對手：${CONFIG.rivals[rival].name}`); }
    else LIYU.finish({ score: wins, lines: [win ? '👑 連贏 3 場，你是陀螺王！' : `連贏 ${wins} 場`, `最後的對手：${CONFIG.rivals[rival].name}`] });
  }, 1800);
}
// ================================================================ 3D 畫面
const K = .025;                                                        // 1 像素 = 0.025 單位（陀螺半徑 24px → 0.6）
let renderer = null;
const c3 = LIYU.layer3d((w, h, dpr) => { if (renderer) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); } });
renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: true }); { const r = c3.getBoundingClientRect(); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2)); renderer.setSize(r.width || W, r.height || H, false); }
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f5ead6');
const camera = new THREE.PerspectiveCamera(50, W / H, .1, 100); camera.position.set(0, 9.6, 12.6); camera.lookAt(0, -1.1, .3);
scene.add(new THREE.HemisphereLight('#fff6e6', '#8a7356', 1.1));
const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(4, 10, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); scene.add(sun);
const RW = AR * K;                                                       // 擂台半徑（單位）
const bowlY = (r) => -.42 * (1 - Math.min(1, (r / RW) ** 2));         // 碗形：中間低、邊緣高
// 地板、擂台（碗）、木框
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#d9b98a', roughness: .9 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.7; floor.receiveShadow = true; scene.add(floor);
const prof = []; for (let i = 0; i <= 24; i++) { const r = RW * i / 24; prof.push(new THREE.Vector2(r, bowlY(r))); } prof.push(new THREE.Vector2(RW + .08, .12), new THREE.Vector2(RW + .4, .12), new THREE.Vector2(RW + .5, -.7));
const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshStandardMaterial({ color: '#c9d3dd', metalness: .35, roughness: .35, side: THREE.DoubleSide })); bowl.receiveShadow = true; scene.add(bowl);
const rim = new THREE.Mesh(new THREE.TorusGeometry(RW + .25, .2, 12, 64), new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: .7 })); rim.rotation.x = Math.PI / 2; rim.position.y = .14; rim.castShadow = true; scene.add(rim);
for (const r of [1.2, 2.4, 3.6]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, .015, 4, 64), new THREE.MeshBasicMaterial({ color: '#9aa6b2' })); m.rotation.x = Math.PI / 2; m.position.y = bowlY(r) + .005; scene.add(m); }
// 陀螺：車床造型的本體＋金屬攻擊環＋上面的放射花紋（轉起來看得出轉速）
const metal = new THREE.MeshStandardMaterial({ color: '#d8dde3', metalness: .8, roughness: .25 });
function rayTex(color) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 64, i * Math.PI / 4, (i + 1) * Math.PI / 4); g.fillStyle = i % 2 ? '#ffffff' : color; g.fill(); }
  g.beginPath(); g.arc(64, 64, 18, 0, Math.PI * 2); g.fillStyle = '#2a1d12'; g.fill();
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function makeTop3D(color) {
  const g = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(); g.add(tilt); tilt.add(spin); scene.add(g); g.scale.setScalar(1.25);
  const pts = [[0, 0], [.08, .05], [.3, .18], [.56, .28], [.62, .34], [.58, .4], [.32, .45], [.13, .49], [.1, .76], [.14, .8], [0, .83]].map(([x, y]) => new THREE.Vector2(x, y));
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .1 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), bodyMat); body.castShadow = true; spin.add(body);
  const discMat = new THREE.MeshStandardMaterial({ map: rayTex(color), roughness: .5 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(.5, 32), discMat); disc.rotation.x = -Math.PI / 2; disc.position.y = .455; spin.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .05, 8, 32), metal); ring.rotation.x = Math.PI / 2; ring.position.y = .3; ring.castShadow = true; spin.add(ring);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, b = new THREE.Mesh(new THREE.BoxGeometry(.3, .09, .16), metal); b.position.set(Math.cos(a) * .62, .3, Math.sin(a) * .62); b.rotation.y = -a + .4; b.castShadow = true; spin.add(b); }
  return { g, tilt, spin, bodyMat, discMat, color, prec: Math.random() * 6, lie: 0 };
}
const T3 = { me: makeTop3D('#e8762b'), cpu: makeTop3D(CONFIG.rivals[0].color) };
function recolor(o, color) { if (o.color === color) return; o.color = color; o.bodyMat.color.set(color); o.discMat.map.dispose(); o.discMat.map = rayTex(color); o.discMat.needsUpdate = true; }
// 碰撞火花
const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffd23a' }), SP = [];
for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 4), sparkMat); m.visible = false; scene.add(m); SP.push({ m, life: 0, v: new THREE.Vector3() }); }
function sparks(px, py, n) { let k = 0; for (const s of SP) { if (s.life > 0 || k >= n) continue; k++; s.life = .35 + Math.random() * .3; s.m.visible = true; s.m.position.set((px - AX) * K, .35, (py - AY) * K); s.v.set((Math.random() - .5) * 7, 2 + Math.random() * 4, (Math.random() - .5) * 7); } }
// 點畫面 → 擂台上的位置（像素座標）
const ray = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), .2), hitP = new THREE.Vector3();
function toArena(x, y) { ray.setFromCamera(LIYU.ndc(x, y), camera); if (!ray.ray.intersectPlane(floorPlane, hitP)) return null; return { x: AX + hitP.x / K, y: AY + hitP.z / K }; }
// 把物理狀態放到 3D 陀螺上
function place(o, t, dt, idle) {
  if (!t) { o.g.position.set(idle.x, bowlY(Math.hypot(idle.x, idle.z)), idle.z); o.spin.rotation.y += dt * 2; o.tilt.rotation.set(.12, 0, 0); return; }
  const X = (t.x - AX) * K, Z = (t.y - AY) * K, r = Math.hypot(X, Z);
  if (t.out) {                                                           // 被撞出場：飛出去掉到地上
    o.lie = Math.min(1, o.lie + dt * 2.5); const out = r > 0 ? RW + .9 + o.lie * .8 : 0;
    o.g.position.set(r ? X / r * out : X, -.7 + .25 * (1 - o.lie) + .1, r ? Z / r * out : Z); o.tilt.rotation.set(1.35 * o.lie, 0, .3 * o.lie); return;
  }
  o.g.position.set(X, bowlY(r), Z);
  o.spin.rotation.y += Math.max(0, t.spin) * dt * 45;
  if (t.spin <= 0) { o.lie = Math.min(1, o.lie + dt * 2); o.tilt.rotation.set(1.25 * o.lie, 0, 0); return; }   // 停下來倒在擂台上
  o.lie = 0; o.prec += dt * (4 + (1 - t.spin) * 6);
  const wob = t.spin < .3 ? (.3 - t.spin) * 1.5 : .03;                   // 轉速慢了就開始搖晃
  o.tilt.rotation.set(Math.cos(o.prec) * wob, 0, Math.sin(o.prec) * wob);
}
function render3d(dt) {
  if (phase !== 'battle' && phase !== 'end') { T3.me.lie = T3.cpu.lie = 0; }
  if (rival != null) recolor(T3.cpu, CONFIG.rivals[rival].color);
  const show = phase === 'battle' || phase === 'end';
  place(T3.me, show ? me : null, dt, { x: -2.6, z: 1.3 }); place(T3.cpu, show ? cpu : null, dt, { x: 2.6, z: -1.3 });
  for (const s of SP) { if (s.life <= 0) continue; s.life -= dt; s.v.y -= 14 * dt; s.m.position.addScaledVector(s.v, dt); if (s.life <= 0) s.m.visible = false; }
  renderer.render(scene, camera);
}
function spinBar(x, label, t, color) {
  LIYU.text(label, x, 50, { size: 15, color });
  LIYU.rrect(x - 60, 62, 120, 14, 7, '#fff', '#7a4a22', 2);
  if (t) LIYU.rrect(x - 59, 63, 118 * Math.max(0, Math.min(1, t.spin)), 12, 6, color);
}
LIYU.loop((dt) => {
  LIYU.bg();
  render3d(dt);
  if (!phase) return;
  const R = CONFIG.rivals[rival];
  spinBar(90, '你的陀螺', me, '#e8762b'); spinBar(310, R.name, cpu, R.color);
  if (LIYU.running) {
    if (phase === 'count') { cd -= dt; LIYU.text(cd > 0 ? String(Math.ceil(cd)) : '發射！', AX, AY, { size: 90, color: '#b34a10' }); if (cd <= -.3) phase = 'ready'; }
    else if (phase === 'battle') {
      physics(dt);
      if (me.spin <= 0 || cpu.spin <= 0) result(cpu.spin <= 0 && me.spin > 0);
    }
  }
  if (phase === 'ready') {
    if (holding) charge += dt * 1.6;
    const p = powNow();
    LIYU.rrect(60, 470, 280, 22, 11, '#fff', '#7a4a22', 2); LIYU.rrect(60 + 280 * .8, 471, 280 * .15, 20, 4, '#7cc576');
    LIYU.rrect(60 + 280 * p - 4, 464, 8, 34, 4, '#e8473f');
    LIYU.rrect(BTN.x - BTN.w / 2, BTN.y - BTN.h / 2, BTN.w, BTN.h, 30, holding ? '#b34a10' : '#e8762b');
    LIYU.text(holding ? '在綠色區放開！' : '按住 發射', BTN.x, BTN.y + 1, { size: 22, color: '#fff' });
  }
  if (phase === 'battle') LIYU.text(`點擂台推一下：剩 ${pushes} 次`, 200, 520, { size: 17, color: '#7a4a22' });
  if (msg && phase !== 'count') LIYU.text(msg, 200, 580, { size: 19, color: '#b34a10' });
  LIYU.text(`連勝 ${wins}`, 16, 22, { align: 'left', size: 15 }); LIYU.text(`對手 ${rival + 1}/3`, W - 16, 22, { align: 'right', size: 15 });
});
LIYU.peek = () => ({ phase, me, cpu, wins, pow: powNow() });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
