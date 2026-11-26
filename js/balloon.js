// 彩虹熱氣球：停在服務台島西南邊海上的圓形起降坪（木棧道走過去，像直升機停機坪），像鯉魚號一樣可以搭乘——
// 停靠時從籃子前面的門走進去，時間到就升空，繞五座島飛一圈再降落回起降場。
// 時程用「網路時間」排班（所有裝置看到的熱氣球都在同一個位置），一起搭的人會在同一個籃子裡。
import * as THREE from 'three';
import { TAU, clamp, batchStatic } from './kit.js?v=20261126m';
import { H } from './world.js?v=20261126m';

export const BALLOON_CAP = 4;                    // 籃子最多 4 位登入者
const DOCK = 30, ASC = 10, DESC = 12, ALT = 13, SPEED = 3.2;   // 停靠秒數、升空、降落、飛行高度、巡航速度
const PAD_R = 2.7, WK_W = 1.8;                 // 停機坪半徑、木棧道寬
const IN = .6, FLOOR = .1, HALF = .82;           // 籃子內可走範圍（半寬）、地板高度、籃子外框半寬

export function createBalloon(W, opts) {
  const { scene } = W, now = opts.now || (() => Date.now());
  // 起降坪位置：opts.pier = { island, angle(度) } → 從島邊往外拉一條棧道到海上的圓坪；沒有 pier 就用 opts.pad 放在島上
  let pad, pier = null, dir = new THREE.Vector3(0, 0, 1);
  if (opts.pier) {
    const I = W.islands[opts.pier.island || 'center'], ang = opts.pier.angle * Math.PI / 180, edge = I.top(ang);
    dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const a = I.pos.clone().addScaledVector(dir, edge - 1.1).setY(H);
    pad = I.pos.clone().addScaledVector(dir, edge + (opts.pier.out ?? 2.2) + PAD_R + .55).setY(H);
    pier = { a, len: a.distanceTo(pad) - PAD_R - .3 };
    // 漫遊時可以走：圓坪＋棧道
    const PRw = PAD_R + .45, L = pier.len + .4;
    W.surfaces.push((x, z) => {
      if (Math.hypot(x - pad.x, z - pad.z) < PRw) return H;
      const dx = x - a.x, dz = z - a.z, u = dx * dir.x + dz * dir.z, v = -dx * dir.z + dz * dir.x;
      return u > -.2 && u < L && Math.abs(v) < WK_W / 2 - .12 ? H : null;
    });
  } else pad = new THREE.Vector3(opts.pad.x, H, opts.pad.z);
  const top = pad.clone().setY(H + ALT);

  // ------------------------------------------------ 航線：從起降場上空往外飛到湖面上，繞五座島一圈，再回到起降場上空
  const a0 = Math.atan2(pad.z, pad.x), RAD = 23;
  const ring = (a, r, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  const pts = [top.clone(), ring(a0 - .25, 12, H + ALT + .6)];
  for (let i = 0; i <= 12; i++) pts.push(ring(a0 + i / 12 * TAU, RAD, H + ALT + 1.4 + Math.sin(i * 1.7) * 1.6));
  pts.push(ring(a0 + .25, 12, H + ALT + .6), top.clone());
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), CRUISE = Math.round(curve.getLength() / SPEED);   // 取整數秒，整趟時間也是整數
  const CYCLE = DOCK + ASC + CRUISE + DESC;

  // ------------------------------------------------ 模型
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true, ...o });
  const box = (p, mat, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  const g = new THREE.Group(); g.position.copy(pad); scene.add(g);
  const YAW = opts.pier ? Math.atan2(-dir.x, -dir.z) : 0; g.rotation.y = YAW;   // 籃子的門（+z）朝著棧道
  const wick = m('#b8803f'), trim = m('#6b4423'), rope = m('#5a3a1a');
  // 籃子：地板＋四面矮牆（前面 +z 留一個門），牆頂到腰，站在裡面往下看得到島
  box(g, trim, HALF * 2, .12, HALF * 2, 0, .04, 0);
  const WH = .6, WT = .08, wy = .1 + WH / 2, doorW = .72, sideW = (HALF * 2 - doorW) / 2;
  box(g, wick, HALF * 2, WH, WT, 0, wy, -HALF);
  box(g, wick, WT, WH, HALF * 2, -HALF, wy, 0);
  box(g, wick, WT, WH, HALF * 2, HALF, wy, 0);
  box(g, wick, sideW, WH, WT, -HALF + sideW / 2, wy, HALF);
  box(g, wick, sideW, WH, WT, HALF - sideW / 2, wy, HALF);
  for (const [x, z, w, d] of [[0, -HALF, HALF * 2 + .1, .14], [-HALF, 0, .14, HALF * 2 + .1], [HALF, 0, .14, HALF * 2 + .1], [-HALF + sideW / 2, HALF, sideW, .14], [HALF - sideW / 2, HALF, sideW, .14]]) box(g, trim, w, .08, d, x, .1 + WH, z);
  // 沙包：掛在籃子外側
  const sand = m('#d8c28a');
  for (const [x, z] of [[-HALF - .1, -.4], [-HALF - .1, .4], [HALF + .1, -.4], [HALF + .1, .4], [-.4, -HALF - .1], [.4, -HALF - .1]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), sand); s.scale.y = 1.25; s.position.set(x, .42, z); s.castShadow = true; g.add(s); }
  // 繩子：籃子四角拉到燃燒器框
  const BY = 2.05, line = (a, b) => { const d = b.clone().sub(a), o = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, d.length(), 4), rope); o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(o); };
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) line(new THREE.Vector3(x * HALF, .74, z * HALF), new THREE.Vector3(x * .42, BY, z * .42));
  box(g, m('#3a3a3a', { metalness: .4, roughness: .5 }), .9, .06, .9, 0, BY, 0);
  box(g, m('#555555', { metalness: .5, roughness: .4 }), .22, .22, .22, 0, BY + .12, 0);
  // 火焰：飛行時亮、閃動
  const flameMat = new THREE.MeshStandardMaterial({ color: '#ffb23a', emissive: '#ff7a1a', emissiveIntensity: 2.2, transparent: true, opacity: .9, depthWrite: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.16, .55, 8), flameMat); flame.position.set(0, BY + .5, 0); g.add(flame);
  // 球皮：彩虹 12 片，底下接一圈裙邊
  const env = new THREE.Group(); env.position.y = 5.0; g.add(env);
  const RAINBOW = ['#ff4d6d', '#ff8a3d', '#ffd23a', '#5ed37a', '#3fa7ff', '#7a6cff'];
  // 🌙 晚上球皮會從裡面亮起來（燃燒器的火光透出來）：發光顏色＝球皮本身的顏色
  const envMats = RAINBOW.map((c) => { const mm = m(c, { roughness: .7, emissive: c, emissiveIntensity: 0 }); mm.userData.dynamic = true; return mm; });
  for (let k = 0; k < 12; k++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(.5, 6, 12, k / 12 * TAU, TAU / 12), envMats[k % 6]);
    seg.scale.set(4.8, 5.3, 4.8); seg.castShadow = true; env.add(seg);
  }
  const skirtM = m('#ffd23a', { side: THREE.DoubleSide, emissive: '#ffa630', emissiveIntensity: 0 }); skirtM.userData.dynamic = true;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.15, .5, .7, 12, 1, true), skirtM); skirt.position.y = 2.45 - 5.0 + 0.05; env.add(skirt);
  box(env, m('#ffffff'), .5, .14, .5, 0, 2.62, 0);   // 頂部的白色排氣蓋
  // 起降坪：從島邊拉出一條木棧道，盡頭是一個圓形平台（像直升機停機坪）：
  //   深色圓坪＋黃色外圈＋白色內圈＋中間一顆大大的熱氣球記號，邊緣一圈小燈，平台四周有欄杆（棧道那邊留開口）
  const padG = new THREE.Group(); padG.position.copy(pad); scene.add(padG);
  const wood = m('#a07448'), woodD = m('#6e4b2c');
  if (pier) {
    const PR = PAD_R + .55;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, .3, 40), wood); deck.position.y = -.15; deck.receiveShadow = true; deck.castShadow = true; padG.add(deck);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(PR, .07, 6, 48), woodD); rim.rotation.x = Math.PI / 2; rim.position.y = -.02; padG.add(rim);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const c = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, 3, 7), woodD); c.position.set(Math.cos(a) * (PR - .35), -1.6, Math.sin(a) * (PR - .35)); padG.add(c); }
    // 欄杆：圓坪外圈，朝島的方向留 2 公尺開口
    const back = Math.atan2(-dir.z, -dir.x), rail = m('#f2efe6');
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * TAU, da = Math.atan2(Math.sin(a - back), Math.cos(a - back)); if (Math.abs(da) < .42) continue;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .7, 5), rail); c.position.set(Math.cos(a) * (PR - .08), .35, Math.sin(a) * (PR - .08)); padG.add(c);
      const a2 = a + TAU / 28, da2 = Math.atan2(Math.sin(a2 - back), Math.cos(a2 - back)); if (Math.abs(da2) < .42) continue;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, 2 * (PR - .08) * Math.sin(TAU / 56) + .02), rail); const am = a + TAU / 56;
      seg.position.set(Math.cos(am) * (PR - .08) * Math.cos(TAU / 56), .7, Math.sin(am) * (PR - .08) * Math.cos(TAU / 56)); seg.rotation.y = -am; padG.add(seg);
    }
    // 木棧道：從島邊（踩在島上 1 公尺）到圓坪
    const L = pier.len, wk = new THREE.Group(); wk.position.copy(pier.a); wk.rotation.y = Math.atan2(dir.x, dir.z); scene.add(wk);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(WK_W, .2, L), wood); plank.position.set(0, -.1, L / 2); plank.receiveShadow = true; plank.castShadow = true; wk.add(plank);
    for (let k = 0; k < Math.floor(L / .5); k++) box(wk, woodD, WK_W + .02, .02, .05, 0, .005, k * .5 + .25);
    for (let k = 1; k < L / 1.6; k++) for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.09, .1, 3, 6), woodD); c.position.set(sx * (WK_W / 2 - .1), -1.5, k * 1.6); wk.add(c); }
    for (const sx of [-1, 1]) { box(wk, rail, .06, .06, L - 1.2, sx * (WK_W / 2 - .05), .7, (L - 1.2) / 2 + 1.2); for (let z = 1.2; z <= L + .01; z += .9) box(wk, rail, .05, .7, .05, sx * (WK_W / 2 - .05), .35, z); }
    batchStatic(wk, []);
  }
  // 停機坪的地面圖案（canvas）
  const padTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), C2 = 256;
    x.fillStyle = '#3d4a55'; x.beginPath(); x.arc(C2, C2, 256, 0, TAU); x.fill();
    x.strokeStyle = '#ffcc33'; x.lineWidth = 26; x.beginPath(); x.arc(C2, C2, 236, 0, TAU); x.stroke();
    x.setLineDash([30, 22]); x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.beginPath(); x.arc(C2, C2, 205, 0, TAU); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#ffffff'; x.lineWidth = 16; x.beginPath(); x.arc(C2, C2, 165, 0, TAU); x.stroke();
    // 中間的熱氣球記號：球皮＋繩子＋籃子
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(C2, C2 - 28, 74, 84, 0, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(C2 - 62, C2 + 10); x.lineTo(C2 - 26, C2 + 80); x.lineTo(C2 + 26, C2 + 80); x.lineTo(C2 + 62, C2 + 10); x.fill();
    x.fillRect(C2 - 26, C2 + 92, 52, 38);
    x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.beginPath(); x.moveTo(C2 - 24, C2 + 80); x.lineTo(C2 - 22, C2 + 94); x.moveTo(C2 + 24, C2 + 80); x.lineTo(C2 + 22, C2 + 94); x.stroke();
    x.fillStyle = '#ff5a6e'; x.beginPath(); x.ellipse(C2, C2 - 28, 22, 84, 0, 0, TAU); x.fill();
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(PAD_R, 48), new THREE.MeshStandardMaterial({ map: padTex, roughness: .85 }));
  disc.rotation.x = -Math.PI / 2; disc.rotation.z = Math.atan2(dir.x, dir.z) + Math.PI; disc.position.y = .03; disc.receiveShadow = true; padG.add(disc);
  // 邊緣一圈小燈（晚上會亮，main 每一格依天黑程度調亮度）
  const edgeLampM = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcc33', emissiveIntensity: .2 });
  const edgeL = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 8, 6), edgeLampM, 20);
  { const M = new THREE.Matrix4(); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; edgeL.setMatrixAt(i, M.makeTranslation(Math.cos(a) * (PAD_R + .12), .07, Math.sin(a) * (PAD_R + .12))); } }
  padG.add(edgeL);
  // 燈號柱：放在棧道口右手邊
  const sideV = new THREE.Vector3(dir.z, 0, -dir.x), postP = dir.clone().multiplyScalar(-(PAD_R - .1)).addScaledVector(sideV, 1.0);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 1.3, 6), trim); post.position.set(postP.x, .65, postP.z); post.castShadow = true; padG.add(post);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#4caf50', emissive: '#2e9e3a', emissiveIntensity: 1.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), lampMat); lamp.position.set(postP.x, 1.38, postP.z); padG.add(lamp);
  // 籃子的門：停靠時往外打開，起飛前關上（鉸鏈在門口左邊）
  const door = new THREE.Group(); door.position.set(-doorW / 2, 0, HALF); g.add(door);
  box(door, wick, doorW - .04, WH - .04, WT, doorW / 2, wy, 0);
  box(door, trim, doorW - .04, .07, .12, doorW / 2, .1 + WH - .02, 0);
  box(door, trim, .07, WH - .1, .1, doorW - .08, wy, .02);   // 門把那一側的框
  const DOOR_OPEN = -1.75; door.rotation.y = DOOR_OPEN;
  // ✨ 小燈裝飾：籃子外圈一圈彩色燈（會跑馬）、籃子裡面一圈暖白燈、四條繩子上的燈串、裙邊和球皮腰帶各一圈
  const glowVC = (mm) => { mm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'); }; mm.customProgramCacheKey = () => 'glowVC-balloon'; return mm; };
  const bulbM = glowVC(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .15, roughness: .4 }));
  const bulbGeo = new THREE.SphereGeometry(.035, 6, 5), M4 = new THREE.Matrix4(), bc = new THREE.Color();
  const circ = (n, fn) => { const pts = []; for (let i = 0; i < n; i++) pts.push(fn(i / n)); return pts; };
  const rim = (off, y, step) => { const pts = [], L = (off * 2); const per = Math.max(2, Math.round(L / step)); for (const [ax, az, dx, dz] of [[-1, -1, 1, 0], [1, -1, 0, 1], [1, 1, -1, 0], [-1, 1, 0, -1]]) for (let i = 0; i < per; i++) { const t = i / per * L; pts.push(new THREE.Vector3(ax * off + dx * t, y, az * off + dz * t)); } return pts; };
  const outPts = rim(HALF + .085, .1 + WH + .02, .16), inPts = rim(HALF - .07, .1 + WH - .1, .2);
  const ropePts = []; for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let i = 1; i <= 5; i++) { const k = i / 6; ropePts.push(new THREE.Vector3(x * HALF, .74, z * HALF).lerp(new THREE.Vector3(x * .42, BY, z * .42), k)); }
  const mkBulbs = (parent, pts, col) => { const im = new THREE.InstancedMesh(bulbGeo, bulbM, pts.length); pts.forEach((p, i) => { im.setMatrixAt(i, M4.makeTranslation(p.x, p.y, p.z)); im.setColorAt(i, bc.set(typeof col === 'function' ? col(i) : col)); }); parent.add(im); return im; };
  const outBulbs = mkBulbs(g, outPts, (i) => RAINBOW[i % 6]);
  mkBulbs(g, inPts, '#fff1c4');
  mkBulbs(g, ropePts, (i) => (i % 2 ? '#ffd23a' : '#ffffff'));
  mkBulbs(env, circ(16, (t) => new THREE.Vector3(Math.cos(t * TAU) * .52, 2.45 - 5.0 - .3, Math.sin(t * TAU) * .52)), '#ffe6a0');      // 裙邊
  const beltR = 2.42; mkBulbs(env, circ(36, (t) => new THREE.Vector3(Math.cos(t * TAU) * beltR, 0, Math.sin(t * TAU) * beltR)), (i) => (i % 3 === 0 ? '#ffffff' : '#ffe08a'));   // 球皮腰帶
  // 球皮外的柔和光暈（晚上才看得到）
  const haloC = document.createElement('canvas'); haloC.width = haloC.height = 128; { const x = haloC.getContext('2d'), gr = x.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(255,200,140,.9)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloC), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(8.5, 9.5, 1); halo.visible = false; env.add(halo);
  let chaseT = 0, glowN = -1;
  batchStatic(g, [flame, env, door]); batchStatic(door, []); batchStatic(env, []); batchStatic(padG, [lamp, edgeL]);
  if (opts.low) for (const c of env.children) c.castShadow = false;

  // ------------------------------------------------ 時程
  const ease = (k) => k * k * (3 - 2 * k);
  // 巡航：起步和收尾各 8% 加減速，中間等速
  const R = .08, ramp = (u) => (u < R ? u * u / (2 * R * (1 - R)) : u > 1 - R ? 1 - (1 - u) ** 2 / (2 * R * (1 - R)) : (u - R / 2) / (1 - R));
  function at(sec) {
    const tc = ((sec % CYCLE) + CYCLE) % CYCLE;
    if (tc < DOCK) return { phase: 'dock', pos: pad.clone(), left: DOCK - tc, eta: 0 };
    if (tc < DOCK + ASC) { const k = (tc - DOCK) / ASC; return { phase: 'up', pos: pad.clone().lerp(top, ease(k)), left: 0, eta: CYCLE - tc }; }
    if (tc < DOCK + ASC + CRUISE) { const u = (tc - DOCK - ASC) / CRUISE; return { phase: 'fly', pos: curve.getPointAt(clamp(ramp(u), 0, 1)), left: 0, eta: CYCLE - tc, u }; }
    const k = (tc - DOCK - ASC - CRUISE) / DESC; return { phase: 'down', pos: top.clone().lerp(pad, ease(k)), left: 0, eta: CYCLE - tc };
  }
  let cur = at(now() / 1000);
  const prev = g.position.clone();
  function update(t, dt, moving) {
    prev.copy(g.position);
    cur = at(now() / 1000);
    g.position.copy(cur.pos);
    if (cur.phase === 'fly' && moving) g.position.y += Math.sin(t * .7) * .12;
    // 球皮微微擺動（籃子不轉，站在裡面不會晃）
    env.rotation.z = moving && cur.phase !== 'dock' ? Math.sin(t * .6) * .03 : 0; env.rotation.x = moving && cur.phase !== 'dock' ? Math.sin(t * .45 + 1) * .025 : 0;
    const burn = cur.phase === 'up' || (cur.phase === 'fly' && Math.sin(t * .8) > .3);
    // 🌙 夜間：球皮從裡面亮、燈泡亮、外圈彩燈跑馬
    const n = W.state ? W.state.n : 0;
    const fl = moving ? .06 * Math.sin(t * 13) + .04 * Math.sin(t * 29) : 0;
    const gi = n * ((burn ? .62 : .4) + fl);
    if (Math.abs(gi - glowN) > .005) { glowN = gi; for (const mm of envMats) mm.emissiveIntensity = gi; skirtM.emissiveIntensity = n * (burn ? 1.6 : .9); bulbM.emissiveIntensity = .15 + n * 2.6; halo.visible = n > .05; halo.material.opacity = n * (burn ? .4 : .28); }
    if (n > .05 && moving && t - chaseT > .12) { chaseT = t; const sh = Math.floor(t * 8); for (let i = 0; i < outPts.length; i++) outBulbs.setColorAt(i, bc.set(RAINBOW[(i + sh) % 6])); outBulbs.instanceColor.needsUpdate = true; }
    flame.visible = cur.phase !== 'dock';
    // 門：停靠中而且還有 2 秒以上才起飛 → 打開；其他時間關上（起飛前 2 秒開始關）
    const want = cur.phase === 'dock' && cur.left > 2 ? DOOR_OPEN : 0;
    door.rotation.y += (want - door.rotation.y) * Math.min(1, dt * (moving ? 5 : 60));
    const f = burn ? 1 + (moving ? Math.sin(t * 31) * .18 : 0) : .45; flame.scale.set(f * .9, f, f * .9);
    const c = cur.phase !== 'dock' ? '#e8473f' : cur.left < 6 ? '#ffc23a' : '#4caf50';
    if (lamp.userData.c !== c) { lamp.userData.c = c; lampMat.color.set(c); lampMat.emissive.set(c); }
    g.updateMatrixWorld(true);
    W.balloonMove = { from: prev.clone(), d: g.position.clone().sub(prev) };
  }

  // ------------------------------------------------ 給漫遊用：籃子地板、是否在籃子裡
  function floorAt(x, z, p = g.position) { return Math.hypot(x - p.x, z - p.z) < IN * 1.1 ? p.y + FLOOR : null; }
  function inBasket(v, p = g.position) { const f = floorAt(v.x, v.z, p); return f != null && Math.abs(v.y - f) < .9; }
  const docked = () => cur.phase === 'dock';
  const doorOpen = () => cur.phase === 'dock' && cur.left > 2;   // 門開著才能進出籃子
  // 停靠時籃子地板誰都能踩；飛起來以後只有在籃子裡的人（自己）才踩得到，不會影響地上的人
  (W.over = W.over || []).push((x, z) => { const f = floorAt(x, z); return f != null && (docked() || W.balloonRiding) ? f : null; });
  // 其他登入者在籃子裡：網路位置有延遲，直接排在籃子裡的四個位置（依 id 固定）
  // 位置高在半空（地面上沒有那麼高的地方）一定是搭熱氣球的人：網路位置舊了也一律排進籃子，不會飄在天上
  function riderSpot(p, id) {
    if (!p) return null;
    const c = g.position, fy = c.y + FLOOR, inAir = (p.y ?? 0) > H + 2.5;
    if (docked() && !inAir) return null;
    if (!inAir && (Math.hypot(p.x - c.x, p.z - c.z) > 2.2 || Math.abs((p.y ?? 0) - fy) > 2.5)) return null;
    let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const k = h % 4; return new THREE.Vector3(c.x + (k & 1 ? .32 : -.32), fy, c.z + (k & 2 ? .32 : -.32));
  }
  return {
    g, pad, floorAt, inBasket, riderSpot, docked, cap: BALLOON_CAP, door, doorOpen,
    anchor: () => g.position,
    // 站進籃子：面向外側（湖和群島那一邊）
    boardSpot: () => ({ pos: new THREE.Vector3(g.position.x + dir.x * .1, g.position.y + FLOOR, g.position.z + dir.z * .1), yaw: Math.atan2(dir.x, dir.z) }),
    // 下了熱氣球（或飛行中離開漫遊）放回起降場門口
    landSpot: () => ({ x: pad.x - dir.x * 2.1, y: H, z: pad.z - dir.z * 2.1 }),
    dir, edgeLampM,
    avoid: [pad, pad.clone().add(new THREE.Vector3(1.6, 0, 0)), pad.clone().add(new THREE.Vector3(-1.6, 0, 0)), pad.clone().add(new THREE.Vector3(0, 0, 1.6)), pad.clone().add(new THREE.Vector3(0, 0, -1.6))],
    status: () => ({ phase: cur.phase, docked: docked(), left: Math.ceil(cur.left), eta: Math.ceil(cur.eta), cycle: Math.round(CYCLE) }),
    update,
  };
}
