// 第 18 攤・丟球者（3D 版）：從投手背後看出去，按住球蓄力（力道條上下跑），左右拖瞄準，在綠色區放開，把球丟進遠方木板上的洞
// 判斷進不進洞仍用 400×600 的座標（和 2D 版一樣）；畫面用 Three.js 畫成 3D，力道條和文字畫在上層的 HUD
import * as THREE from 'three';
import { LIYU } from '../_kit/kit.js?v=20261119e';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 18, title: '丟球者', stall: '丟球者',
  how: ['按住畫面下方（球附近）：右邊的力道條會一直上下跑', '按著的時候左右拖，可以瞄準洞口（看紅色瞄準圈）', '力道條跑到綠色時放開，球就剛好落進洞裡', '電腦：按住空白鍵蓄力，← → 瞄準', '進 3 球升級：木板開始左右移動、越來越快；一輪 30 秒'],
  clear: '至少投進 1 球（和現場一樣）',
  time: 30, levelEvery: 3,
  green: [.6, .8],                         // 力道條的綠色區（0＝最下面、1＝最上面）
  credit: '第 18 攤 丟球者',
};
const BAR = { x: 344, y: 250, w: 34, h: 230 };
const MID = (CONFIG.green[0] + CONFIG.green[1]) / 2, TOL = (CONFIG.green[1] - CONFIG.green[0]) / 2 / MID;
let t, score, level, hole, hold, ball, msg, lastPow, aim, keys = {};
function start() { t = CONFIG.time; score = 0; level = 1; hole = { x: 200, dir: 1 }; hold = null; ball = null; msg = ''; lastPow = null; aim = 200; }
const powNow = () => { if (!hold) return 0; const k = hold.c % 2; return k < 1 ? k : 2 - k; };
const aimAt = (x) => Math.max(90, Math.min(310, 200 + (x - 200) * 1.6));
function begin() { if (!LIYU.running || ball || hold) return; hold = { c: 0 }; LIYU.sfx('tap'); }
function release() {
  if (!hold) return; const p = powNow(); hold = null; lastPow = p;
  ball = { t: 0, tx: aim, depth: p / MID, from: BALL0.clone(), spin: 0 }; ball.to = landPoint(ball.tx, ball.depth); LIYU.sfx('throw');
}
LIYU.on('down', (x, y) => { if (y > 330 && x < 330) begin(); });
LIYU.on('move', (x, y, e, held) => { if (hold && held) aim = aimAt(x); });
LIYU.on('up', release);
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) begin(); } keys[e.key] = true; });
addEventListener('keyup', (e) => { if (e.code === 'Space') release(); keys[e.key] = false; });
function judge() {
  const b = ball, lx = 200 + (b.tx - 200) * Math.min(1.3, b.depth);
  const inX = Math.abs(lx - hole.x) < 34 - level * 2, inPow = Math.abs(b.depth - 1) < TOL;
  b.hit = inX && inPow;
  if (b.hit) { score++; LIYU.sfx('hit'); msg = '🏀 進了！'; LIYU.clear(score); if (score % CONFIG.levelEvery === 0) { level++; LIYU.toast(`升級！第 ${level} 關`); } }
  else { LIYU.sfx('miss'); msg = !inPow ? (b.depth < 1 ? '太近了！等力道條再高一點' : '太遠了！早一點放開') : (lx < hole.x ? '偏左了，往右瞄一點' : '偏右了，往左瞄一點'); }
}

// ================================================================ 3D 畫面
const PX2X = 2.6 / 110;                    // 橫向：像素 → 單位（洞口在 120～280 像素 → 約 ±1.9 單位）
const BALL0 = new THREE.Vector3(0, .32, 3.6), HZ = -5.6;
let renderer = null;
const c3 = LIYU.layer3d((w, h, dpr) => { if (renderer) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); } });
renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: true }); { const r = c3.getBoundingClientRect(); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2)); renderer.setSize(r.width || W, r.height || H, false); }
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#cfe8fb'); scene.fog = new THREE.Fog('#cfe8fb', 18, 40);
const camera = new THREE.PerspectiveCamera(48, W / H, .1, 100); camera.position.set(0, 2.3, 7.4); camera.lookAt(0, .1, -3.2);
scene.add(new THREE.HemisphereLight('#ffffff', '#7a9a5a', 1.15));
const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(-4, 9, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 9, bottom: -12, near: 1, far: 30 }); scene.add(sun);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M('#9fcf7a')); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
for (let i = -6; i <= 6; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 60), M(i % 2 ? '#a9d784' : '#97c672')); s.rotation.x = -Math.PI / 2; s.position.set(i, .002, 0); s.receiveShadow = true; scene.add(s); }
const line = new THREE.Mesh(new THREE.PlaneGeometry(5, .1), new THREE.MeshBasicMaterial({ color: '#ffffff' })); line.rotation.x = -Math.PI / 2; line.position.set(0, .01, 3.05); scene.add(line);
// 背景：攤位的圍欄和三角旗
for (let i = -8; i <= 8; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.1, .12), M('#a8743f')); p.position.set(i * 1.2, .55, -13); p.castShadow = true; scene.add(p); }
const rail = new THREE.Mesh(new THREE.BoxGeometry(20, .12, .1), M('#a8743f')); rail.position.set(0, 1, -13); scene.add(rail);
const FLAG = ['#e8473f', '#ffd23a', '#2f7fd1', '#5ec26a', '#e8762b', '#8a5cd0'];
for (let i = 0; i < 18; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.22, .45, 3), M(FLAG[i % 6])); f.rotation.z = Math.PI; f.position.set(-9 + i * 1.06, 2.1 - Math.sin(i / 17 * Math.PI) * .4, -12.8); scene.add(f); }
// 洞口木板（像沙包板）：前低後高，洞在後半部
const board = new THREE.Group(); board.position.set(0, 0, HZ); scene.add(board);
const tiltG = new THREE.Group(); tiltG.position.set(0, .25, 0); tiltG.rotation.x = .2; board.add(tiltG);   // 後面翹起來
const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, 3.4), M('#f2c14e', { roughness: .6 })); plank.castShadow = plank.receiveShadow = true; tiltG.add(plank);
const edge = new THREE.Mesh(new THREE.BoxGeometry(2.7, .16, 3.5), M('#a8743f')); edge.position.y = -.05; tiltG.add(edge);
const HOLE_LOCAL = new THREE.Vector3(0, .062, -.75);
const holeM = new THREE.Mesh(new THREE.CircleGeometry(.42, 32), new THREE.MeshBasicMaterial({ color: '#2a1d12' })); holeM.rotation.x = -Math.PI / 2; holeM.position.copy(HOLE_LOCAL); tiltG.add(holeM);
const holeRim = new THREE.Mesh(new THREE.TorusGeometry(.43, .04, 8, 32), M('#7a4a22')); holeRim.rotation.x = Math.PI / 2; holeRim.position.copy(HOLE_LOCAL); tiltG.add(holeRim);
for (const x of [-1.15, 1.15]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, .9, .12), M('#7a4a22')); leg.position.set(x, -.25, -1.45); leg.rotation.x = -.2; tiltG.add(leg); }
// 木板上的鯉魚 Logo（和網站同一張圖）
{ const tx = new THREE.TextureLoader().load('../../assets/brand/koi-logo.png'); tx.colorSpace = THREE.SRGBColorSpace; const logo = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .4 })); logo.rotation.x = -Math.PI / 2; logo.position.set(0, .063, .7); tiltG.add(logo); }
const holeWorld = new THREE.Vector3();
function holePos() { board.updateMatrixWorld(true); return holeWorld.copy(HOLE_LOCAL).applyMatrix4(holeM.parent.matrixWorld); }
// 落點：瞄準方向 × 力道（力道 1＝剛好落在洞的距離）
function landPoint(txPx, depth) {
  const h = holePos(), tx = (txPx - 200) * PX2X, d = Math.max(.15, depth);
  const x = BALL0.x + (tx - BALL0.x) * d, z = BALL0.z + (h.z - BALL0.z) * d;
  return new THREE.Vector3(x, Math.abs(d - 1) < .2 ? h.y : .3, z);
}
// 球：紅色＋白色條紋（看得出在轉）
const ballG = new THREE.Group(); scene.add(ballG);
const ballM = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 16), M('#e8473f', { roughness: .45 })); ballM.castShadow = true; ballG.add(ballM);
const stripe = new THREE.Mesh(new THREE.TorusGeometry(.3, .03, 6, 32), M('#ffffff')); ballG.add(stripe);
// 瞄準：紅色瞄準圈＋一串小點畫出飛行路線
const aimRing = new THREE.Mesh(new THREE.RingGeometry(.3, .4, 32), new THREE.MeshBasicMaterial({ color: '#e8473f', transparent: true, opacity: .75, side: THREE.DoubleSide })); aimRing.rotation.x = -Math.PI / 2; scene.add(aimRing);
const dots = []; for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 4), new THREE.MeshBasicMaterial({ color: '#7a4a22', transparent: true, opacity: .55 })); scene.add(d); dots.push(d); }
const arc = (a, b, k, hgt) => new THREE.Vector3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * hgt, a.z + (b.z - a.z) * k);

function render3d(dt) {
  board.position.x = hole ? (hole.x - 200) * PX2X : 0;
  const showAim = LIYU.running && !ball;
  const target = landPoint(aim ?? 200, 1);
  aimRing.visible = showAim; aimRing.position.set(target.x, target.y + .02, target.z);
  dots.forEach((d, i) => { d.visible = showAim; d.position.copy(arc(BALL0, target, (i + 1) / 15, 1.3)); });
  if (ball) {
    ball.t += dt / .9; const k = Math.min(1, ball.t);
    if (k < 1) { ballG.position.copy(arc(ball.from, ball.to, k, 2.2 + ball.depth)); ballG.rotation.x -= dt * 12; }
    else {
      if (!ball.judged) { ball.judged = true; judge(); ball.after = 0; }
      ball.after += dt;
      if (ball.hit) { const h = holePos(); ballG.position.set(h.x, h.y - ball.after * 1.6, h.z); ballG.scale.setScalar(Math.max(.01, 1 - ball.after * 2)); }   // 落進洞裡
      else { ballG.position.z -= dt * 1.2; ballG.position.y = Math.max(.3, ball.to.y) + Math.abs(Math.sin(ball.after * 9)) * .25 * Math.max(0, 1 - ball.after * 2); ballG.rotation.x -= dt * 6; }
      if (ball.after > .7) { ball = null; ballG.scale.setScalar(1); }
    }
  }
  if (!ball) { ballG.position.copy(BALL0); if (hold) ballG.position.y = BALL0.y + .05 + Math.sin(performance.now() / 60) * .02; }
  renderer.render(scene, camera);
}

LIYU.loop((dt) => {
  LIYU.bg();
  if (hold) { hold.c += dt * (1.1 + level * .15); if (keys.ArrowLeft) aim = Math.max(90, aim - 160 * dt); if (keys.ArrowRight) aim = Math.min(310, aim + 160 * dt); }
  if (LIYU.running && level > 1) { hole.x += hole.dir * (40 + level * 22) * dt; if (hole.x > 280 || hole.x < 120) hole.dir *= -1; }
  render3d(dt);
  if (!hole) return;
  if (LIYU.running) { t -= dt; if (t <= 0 && !ball) { LIYU.finish({ score, lines: [`30 秒投進 ${score} 球`, `最高到第 ${level} 關`] }); return; } }
  // 力道條：按住時上下跑，綠色區放開最剛好
  const { x: bx, y: by, w: bw, h: bh } = BAR, py = (v) => by + bh - v * bh;
  LIYU.rrect(bx, by, bw, bh, 10, 'rgba(255,255,255,.92)', '#7a4a22', 3);
  LIYU.rrect(bx + 2, py(CONFIG.green[1]), bw - 4, (CONFIG.green[1] - CONFIG.green[0]) * bh, 4, '#7cc576');
  LIYU.text('太遠', bx + bw / 2, by + 16, { size: 12, color: '#b3263a' }); LIYU.text('剛好', bx - 22, py(MID), { size: 13, color: '#2f8a40' }); LIYU.text('太近', bx + bw / 2, by + bh - 14, { size: 12, color: '#7a4a22' });
  const pv = hold ? powNow() : lastPow;
  if (pv != null) LIYU.rrect(bx - 8, py(pv) - 4, bw + 16, 8, 4, hold ? '#e8473f' : 'rgba(232,71,63,.45)');
  LIYU.text('力道', bx + bw / 2, by + bh + 18, { size: 14, color: '#2a1d12' });
  LIYU.rrect(8, 8, 384, 40, 14, 'rgba(255,255,255,.75)');
  LIYU.text(`⏱ ${Math.max(0, Math.ceil(t))}`, 20, 28, { align: 'left' });
  LIYU.text(`進 ${score} 球・第 ${level} 關`, W - 20, 28, { align: 'right', size: 18 });
  if (msg) { LIYU.rrect(60, 58, 280, 36, 18, 'rgba(255,255,255,.85)'); LIYU.text(msg, 200, 77, { size: 18, color: '#b34a10' }); }
  if (!ball && !hold && LIYU.running) { LIYU.rrect(70, 556, 260, 34, 17, 'rgba(255,255,255,.85)'); LIYU.text(score === 0 && !msg ? '👇 按住這裡蓄力' : '👇 按住再丟一次', 200, 574, { size: 17, color: '#7a4a22' }); }
  if (hold) { LIYU.rrect(20, 556, 360, 34, 17, 'rgba(255,255,255,.9)'); LIYU.text('力道到綠色就放開！左右拖可以瞄準', 200, 574, { size: 16, color: '#b34a10' }); }
});
LIYU.peek = () => ({ pow: powNow(), hold: !!hold });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
