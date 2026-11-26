// 🎢 鯉魚雲霄飛車（第一版）：軌道繞一圈，經過五座主題島的外緣上空。
// 車站在「趣味遊戲島」外側海上的木平台；出站後爬坡（最高不超過 10 公尺，避開在上空繞島的熱氣球），
// 大俯衝、海面波浪段，再依序飛過循環挖寶島、手作體驗二島、美食補給島、手作體驗一島，回到車站。
// 時程用「網路時間」排班（所有裝置看到同一班車）：停站 25 秒 → 跑一圈 → 回站。
import * as THREE from 'three';
import { TAU, clamp } from './kit.js?v=20261126t';
import { H } from './world.js?v=20261126t';

export const COASTER_CAP = 8;                 // 4 節車廂 × 每節 2 人
const DOCK = 25;                              // 停站秒數
const CARS = 4, CAR_GAP = 1.75;               // 車廂數、車廂間距（沿軌道）
const SEAT_X = .3;                            // 座位左右位置
const ORDER = ['sport', 'recycle', 'puzzle', 'food', 'craft'];   // 逆時針經過的順序（車站在 sport）

export function createCoaster(W, opts) {
  const { scene } = W, now = opts.now || (() => Date.now()), low = !!opts.low;
  const root = new THREE.Group(); scene.add(root);
  // 🌙 夜間燈光：白天看起來和原本一樣；天黑後這些材質會發光（都是發光材質，不用真的光源，手機也跑得動）
  const NIGHT = [];                                        // { m, max }：天黑時 emissiveIntensity 變成 max
  const night = (m, max, color) => { if (color) m.emissive = new THREE.Color(color); m.emissiveIntensity = 0; NIGHT.push({ m, max }); return m; };
  // 有頂點顏色的魚身：發光的顏色跟著魚身自己的顏色（紅斑發紅光、白底發暖白光），像被投射燈打亮
  const glowVC = (m) => { m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'); }; m.customProgramCacheKey = () => 'glowVC'; return m; };
  const beams = [];                                        // 投射燈的光柱（會慢慢換顏色）
  let fishSkin = null; const WHITE_C = new THREE.Color('#ffffff'), washC = new THREE.Color();
  const I = (id) => W.islands[id];
  const UP = new THREE.Vector3(0, 1, 0);
  const uOf = (C) => new THREE.Vector3(C.x, 0, C.z).normalize();
  const tOf = (u) => new THREE.Vector3(-u.z, 0, u.x);
  const at = (C, u, t, du, dt, y) => C.clone().addScaledVector(u, du).addScaledVector(t, dt).setY(y);
  const polar = (deg, r, y) => new THREE.Vector3(Math.cos(deg * Math.PI / 180) * r, y, Math.sin(deg * Math.PI / 180) * r);
  const angOf = (id) => Math.atan2(I(id).pos.z, I(id).pos.x) * 180 / Math.PI;

  // ------------------------------------------------ 路線（控制點：x, 高度 y, z）
  const S = I('sport'), Cs = S.pos.clone().setY(0), us = uOf(Cs), ts = tOf(us);
  const STY = H + .2, STD = 9, SH = -6;                         // 車站軌道高度、車站離島中心多遠、往旁邊挪（讓出島上原本的小碼頭和小船）
  const isle = (id, y = H + 4.5, du = 3.4) => { const C = I(id).pos.clone().setY(0), u = uOf(C), t = tOf(u); return [at(C, u, t, du, -5, y), at(C, u, t, du + .5, 0, y + .35), at(C, u, t, du, 5, y)]; };
  const a = Object.fromEntries(ORDER.map((id) => [id, (angOf(id) + 360) % 360]));
  const mid = (a1, a2, f) => { let d = a2 - a1; if (d < 0) d += 360; return a1 + d * f; };
  // 🌀 大迴圈：在大俯衝的底部，直徑 5.6 公尺（最高 8.6 公尺，比坡頂低，衝得上去）；出口往旁邊錯開一點，軌道才不會打結
  const LB = polar(mid(a.sport, a.recycle, .70), 31, 3.0), LR = 2.8;
  const toRecycle = (() => { const C = I('recycle').pos.clone().setY(0), u = uOf(C), t = tOf(u); return at(C, u, t, 3.4, -5, H + 4.5); })();
  const LF = toRecycle.clone().sub(polar(mid(a.sport, a.recycle, .58), 31, 3.2)).setY(0).normalize(), LS = new THREE.Vector3().crossVectors(LF, UP).normalize();
  const LOOP = [];
  for (let k = 1; k < 16; k++) { const th = k / 16 * TAU; LOOP.push(LB.clone().addScaledVector(LF, LR * Math.sin(th) + (k < 8 ? 0 : .0)).addScaledVector(UP, LR * (1 - Math.cos(th))).addScaledVector(LS, 1.3 * (k / 16 - .5))); }
  LOOP.unshift(LB.clone().addScaledVector(LF, -1.6).addScaledVector(LS, -.75));
  LOOP.push(LB.clone().addScaledVector(LF, 1.8).addScaledVector(LS, .75));
  const pts = [
    at(Cs, us, ts, STD, SH - 2, STY), at(Cs, us, ts, STD, SH + 4, STY),           // 車站（起點）
    at(Cs, us, ts, STD + .3, SH + 10, STY + 1.6),                                  // 開始爬坡（從小碼頭上方經過）
    polar(mid(a.sport, a.recycle, .45), 33, 9.6),                                  // 坡頂（10 公尺以下）
    polar(mid(a.sport, a.recycle, .58), 31, 3.2),                                  // 大俯衝到海面
    ...LOOP,                                                                       // 🌀 360 度大迴圈
    ...isle('recycle'),
    polar(mid(a.recycle, a.puzzle, .28), 31, 5.6),                                 // 海灣上空（高過鴨子船）
    polar(mid(a.recycle, a.puzzle, .5), 33, 8.4),                                  // 駝峰
    polar(mid(a.recycle, a.puzzle, .74), 30.5, 5.6),
    ...isle('puzzle', H + 5.3, 1.6),                                              // 手作體驗二島：往島中心靠、拉高，離西側鯉魚號碼頭遠一點
    polar(mid(a.puzzle, a.food, .3), 31, 4.2),
    polar(mid(a.puzzle, a.food, .52), 33, 7.6),
    polar(mid(a.puzzle, a.food, .76), 30.5, 4.4),
    ...isle('food'),
    polar(mid(a.food, a.craft, .3), 31.5, 4.8),
    polar(mid(a.food, a.craft, .55), 32.5, 3.4),                                   // 貼著海面
    polar(mid(a.food, a.craft, .78), 31, 5.2),
    ...isle('craft'),
    polar(mid(a.craft, a.sport, .3), 32.5, 7.2),
    polar(mid(a.craft, a.sport, .6), 34, 4.6),
    at(Cs, us, ts, STD + .4, SH - 11, STY + 1.2),                                  // 減速進站
    at(Cs, us, ts, STD, SH - 6.5, STY),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', .5);
  const L = curve.getLength();
  const N = Math.ceil(L / .35);
  // 每一小段的位置、切線、右手方向：一般路段保持水平（不側傾）；迴圈裡用「平行移動」的方向，車廂才會跟著翻過去
  const P = [], T = [], RX = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1).normalize();
    P.push(p); T.push(t); RX.push(new THREE.Vector3().crossVectors(UP, t).normalize());
  }
  {
    const inLoop = (p) => Math.hypot(p.x - LB.x, p.z - LB.z) < LR + 1.6 && p.y > 2.6;
    let i0 = -1, i1 = -1; for (let i = 0; i <= N; i++) if (inLoop(P[i])) { if (i0 < 0) i0 = i; i1 = i; }
    if (i0 > 0) {
      const q = new THREE.Quaternion(); let r = RX[i0 - 1].clone();
      for (let i = i0; i <= i1 + 1 && i <= N; i++) { q.setFromUnitVectors(T[i - 1], T[i]); r.applyQuaternion(q); r.addScaledVector(T[i], -r.dot(T[i])).normalize(); RX[i] = r.clone(); }
      // 出迴圈後慢慢回到水平
      for (let k = 1; k <= 14 && i1 + 1 + k <= N; k++) { const i = i1 + 1 + k, lv = new THREE.Vector3().crossVectors(UP, T[i]).normalize(); const pr = RX[i1 + 1].clone(); pr.addScaledVector(T[i], -pr.dot(T[i])).normalize(); RX[i] = pr.lerp(lv, k / 14).normalize(); }
    }
  }
  const sample = (s) => { s = ((s % L) + L) % L; const f = s / L * N, i = Math.floor(f), k = f - i, j = Math.min(N, i + 1); const t = T[i].clone().lerp(T[j], k).normalize(), r = RX[i].clone().lerp(RX[j], k); r.addScaledVector(t, -r.dot(t)).normalize(); return { p: P[i].clone().lerp(P[j], k), t, r }; };

  // ------------------------------------------------ 時刻表：用能量守恆算速度（爬坡用鏈條、進站煞車），先算好整趟的「時間 → 位置」
  const yAt = (s) => sample(s).p.y;
  let topS = 0, topY = -1; for (let s = 0; s < L * .3; s += .5) { const y = yAt(s); if (y > topY) { topY = y; topS = s; } }
  // 爬坡：鏈條拉著走，坡越陡越慢（緩坡約 3 m/s、最陡約 1.3 m/s）
  // 過了坡頂：照物理法則——重力沿軌道方向加速（下坡變快、上坡變慢），再扣掉輪子摩擦和空氣阻力；太慢時軌道上的輪胎助推器頂一下
  const G = 9.8, LIFT_MAX = 3.0, LIFT_MIN = 1.3, MU = .004, DRAG = .0008, BRAKE_S = L - 14, MINV = 2.6, VMAX = 17;   // 真實重力；摩擦、空氣阻力小一點，整趟不會停下來（最高約 12 m/s）
  const liftV = (s) => { const g = Math.max(0, sample(s).t.y); return LIFT_MAX - (LIFT_MAX - LIFT_MIN) * Math.min(1, g / .5); };
  const times = [0], dist = [0], speeds = [0];
  { let s = 0, v = 0, t = 0; const dt = .02;
    while (s < L) {
      if (s < 3) v = Math.min(liftV(3), v + 1.2 * dt);                                  // 出站，慢慢加速
      else if (s < topS) { const w = liftV(s); v += Math.sign(w - v) * Math.min(Math.abs(w - v), 1.1 * dt); }   // 鏈條爬坡：喀啦喀啦
      else if (s < BRAKE_S) { const ty = sample(s).t.y; v += (-G * ty - MU * G - DRAG * v * v) * dt; v = Math.min(VMAX, Math.max(MINV, v)); }
      else v = Math.max(.9, Math.min(v, 1.2 + (L - s) * .45));                           // 煞車進站
      s += v * dt; t += dt; times.push(t); dist.push(Math.min(s, L)); speeds.push(v);
    } }
  const RIDE = times[times.length - 1], CYCLE = DOCK + RIDE;
  const vAtTime = (tr) => { if (tr <= 0 || tr >= times[times.length - 1]) return 0; const i = Math.min(speeds.length - 1, Math.round(tr / .02)); return speeds[i]; };
  const sAtTime = (tr) => { if (tr <= 0) return 0; if (tr >= RIDE) return L; let lo = 0, hi = times.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] < tr) lo = m; else hi = m; } const k = (tr - times[lo]) / Math.max(1e-6, times[hi] - times[lo]); return dist[lo] + (dist[hi] - dist[lo]) * k; };

  // ------------------------------------------------ 軌道：兩條紅色鋼軌、白色枕木、中間的支撐管、白色支柱
  const railM = new THREE.MeshStandardMaterial({ color: '#e4532c', roughness: .45, metalness: .3 });
  const spineM = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: .5, metalness: .2 });
  const tieM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .7 });
  const postM = new THREE.MeshStandardMaterial({ color: '#f3f0e6', roughness: .7 });
  const UPL = (i) => new THREE.Vector3().crossVectors(T[i], RX[i]);     // 軌道自己的「上方」（迴圈裡會倒過來）
  const offCurve = (dx, dy) => new THREE.CatmullRomCurve3(P.slice(0, N).map((p, i) => p.clone().addScaledVector(RX[i], dx).addScaledVector(UPL(i), dy)), true);
  const segs = Math.min(1400, N);
  night(railM, .35, '#ff5a2a'); night(spineM, .55, '#ffc83a');
  for (const dx of [-.36, .36]) { const m = new THREE.Mesh(new THREE.TubeGeometry(offCurve(dx, 0), segs, .055, 6, true), railM); m.castShadow = !low; root.add(m); }
  { const m = new THREE.Mesh(new THREE.TubeGeometry(offCurve(0, -.22), segs, .1, 6, true), spineM); m.castShadow = !low; root.add(m); }
  const step = low ? 1.2 : .7, nTies = Math.floor(L / step);
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(.95, .06, .14), tieM, nTies);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V1 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  const basis = (t, r) => { const y = new THREE.Vector3().crossVectors(t, r); return new THREE.Matrix4().makeBasis(r, y, t); };
  for (let k = 0; k < nTies; k++) { const sp = sample(k * step); Q.setFromRotationMatrix(basis(sp.t, sp.r)); V1.copy(sp.p).addScaledVector(new THREE.Vector3().crossVectors(sp.t, sp.r), -.08); ties.setMatrixAt(k, M4.compose(V1, Q, ONE)); }
  ties.receiveShadow = true; root.add(ties);
  // 🌈 軌道兩側一串彩色小燈：天黑才亮，顏色一路往前跑（迴圈也一圈亮起來）
  const CH_STEP = 1.35, nChase = Math.floor(L / CH_STEP) * 2;
  const chase = new THREE.InstancedMesh(new THREE.SphereGeometry(.075, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), nChase);
  for (let k = 0; k < nChase; k++) { const sp = sample(Math.floor(k / 2) * CH_STEP), up = new THREE.Vector3().crossVectors(sp.t, sp.r); V1.copy(sp.p).addScaledVector(sp.r, (k % 2 ? 1 : -1) * .5).addScaledVector(up, -.12); chase.setMatrixAt(k, M4.compose(V1, Q.identity(), ONE)); chase.setColorAt(k, new THREE.Color('#ffd23a')); }
  chase.visible = false; root.add(chase);
  const chaseCol = new THREE.Color();
  // 支柱：每 5 公尺一根，落在島上或海裡；車站和島上擋路的地方不放
  const posts = [];
  const stationC = at(Cs, us, ts, STD, SH, 0);
  for (let s = 2.5; s < L; s += low ? 7 : 5) {
    const p = sample(s).p; if (p.y < 1.6) continue;
    if (Math.hypot(p.x - LB.x, p.z - LB.z) < LR + 1.8) continue;                 // 迴圈裡不放支柱（另外做迴圈的支架）
    if (Math.hypot(p.x - stationC.x, p.z - stationC.z) < 8.5) continue;
    const g = W.ground(p.x, p.z);
    let base = 0;
    if (g != null) { const isl = Object.values(W.islands).find((q) => Math.hypot(p.x - q.pos.x, p.z - q.pos.z) < q.R * 1.05); if (isl && isl.walk && isl.walk.clear && isl.walk.clear(p.x - isl.pos.x, p.z - isl.pos.z) < .45) continue; base = g; }
    posts.push({ x: p.x, z: p.z, y0: base - (g == null ? .3 : 0), y1: p.y - .3 });
  }
  // 迴圈的支架：兩側各一根高柱、頂上一根橫樑；底下兩根短柱撐住迴圈底部
  const loopPost = {};   // 兩根高柱在 posts 裡的位置（拍大迴圈照時暫時收起來，才不會擋在圓圈正中間）
  for (const sd of [-1, 1]) {
    const b = LB.clone().addScaledVector(LS, sd * 1.95);
    loopPost[sd] = posts.length; posts.push({ x: b.x, z: b.z, y0: -.3, y1: LB.y + LR * 2 + .55 });
    const f = LB.clone().addScaledVector(LS, sd * .3).addScaledVector(LF, sd * .2);
    posts.push({ x: f.x, z: f.z, y0: -.3, y1: LB.y - .3 });
  }
  { const bar = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 3.9, 8), postM); bar.position.copy(LB).setY(LB.y + LR * 2 + .55); bar.quaternion.setFromUnitVectors(UP, LS); root.add(bar);
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .35, 6), postM); hang.position.copy(LB).setY(LB.y + LR * 2 + .4); root.add(hang); }
  const postGeo = new THREE.CylinderGeometry(.09, .12, 1, 8);
  const pm = new THREE.InstancedMesh(postGeo, postM, posts.length);
  posts.forEach((q, k) => { const h = q.y1 - q.y0; pm.setMatrixAt(k, M4.compose(V1.set(q.x, q.y0 + h / 2, q.z), Q.identity(), new THREE.Vector3(1, h, 1))); });
  pm.castShadow = !low; root.add(pm);
  const loopPostHide = (sd, hide) => { const q = posts[loopPost[sd]], h = q.y1 - q.y0; pm.setMatrixAt(loopPost[sd], M4.compose(V1.set(q.x, q.y0 + h / 2, q.z), Q.identity(), new THREE.Vector3(hide ? 0 : 1, hide ? 0 : h, hide ? 0 : 1))); pm.instanceMatrix.needsUpdate = true; };

  const fishWaving = [];
  // ------------------------------------------------ 🐟 鯉魚山洞：美食補給島和手作體驗一島之間，貼著海面那段鑽進一條「大鯉魚」的身體
  //   魚身（紅白錦鯉：白底、紅斑、頭頂紅冠、魚鱗、鰓線、背鰭、胸鰭、腹鰭、尾鰭）整條包住軌道：火車從張開的嘴巴進去、從尾鰭中間出來
  //   只有魚肚子下面的支撐（岩石底座、石柱）用別的材料
  const caveC = polar(mid(a.food, a.craft, .55), 32.5, 3.4);
  let caveS = 0, cbest = 1e9; for (let i = 0; i <= N; i++) { const d = P[i].distanceToSquared(caveC); if (d < cbest) { cbest = d; caveS = i / N * L; } }
  const CAVE0 = caveS - 6, CAVE1 = caveS + 6;
  {
    const fish = new THREE.Group(); root.add(fish);
    const LEN = CAVE1 - CAVE0, RING = 26, STEP = .3;
    const sm = (x) => x * x * (3 - 2 * x);
    const prof = (t) => (t < .1 ? .82 + sm(t / .1) * .2 : t < .4 ? 1.02 + sm((t - .1) / .3) * .38 : t < .62 ? 1.4 - sm((t - .4) / .22) * .2 : 1.2 - sm((t - .62) / .38) * .62);   // 魚身粗細：圓鈍的頭→中段圓滾滾最胖→往尾巴收成細細的尾柄
    const tall = (t) => 1 + .12 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - .1) / .6)));   // 中段的背和肚子再高一點（錦鯉是圓胖的身體）
    const WX = 2.0, HY = 2.25, CY = .95;                         // 半寬、半高、中心比軌道高多少（軌道在魚肚子下半部）
    const WHITE = new THREE.Color('#fff8f0'), RED = new THREE.Color('#e8401c'), RED2 = new THREE.Color('#ff6a2a'), GILL = new THREE.Color('#f0c9b8');
    const red = (t, ang) => {                                    // 紅斑：頭頂紅冠＋背上幾塊不規則的紅斑（肚子保持白色）
      const top = Math.cos(ang);                                 // 1＝背、-1＝肚子
      if (t < .14 && top > .35) return RED;
      if (top < -.1) return null;
      const n = Math.sin(t * 15 + ang * 2.2) + Math.sin(t * 7.3 - ang * 3.1 + 1.7) + top * .6;
      return n > 1.05 ? (n > 1.6 ? RED : RED2) : null;
    };
    const frame = (s0) => { const sp = sample(s0); return { ...sp, up: new THREE.Vector3().crossVectors(sp.t, sp.r) }; };
    const ringPt = (fr, f, ang, k = 1, ht = 1) => fr.p.clone().addScaledVector(fr.r, Math.sin(ang) * WX * f * k).addScaledVector(fr.up, CY * f + Math.cos(ang) * HY * f * k * ht);
    // 魚皮（外面）和肚子裡（裡面）：沿著軌道一圈一圈的環
    const outPos = [], outCol = [], inPos = [], idx = [];
    const rings = Math.round(LEN / STEP);
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, fr = frame(CAVE0 + t * LEN), f = prof(t);
      for (let j = 0; j < RING; j++) {
        const ang = j / RING * TAU;
        const ht = tall(t);
        const po = ringPt(fr, f, ang, 1, ht); outPos.push(po.x, po.y, po.z);   // 魚皮表面平順（不做一圈一圈的起伏，才不會像毛毛蟲）
        const pi = ringPt(fr, f, ang, .9, ht); inPos.push(pi.x, pi.y, pi.z);
        const gill = Math.abs(t - .2) < .018 && Math.cos(ang) > -.6;     // 鰓線
        const c = gill ? GILL : (red(t, ang) || WHITE);
        const shade = .95 + .05 * (((i + (j >> 1)) % 3) === 0 ? 1 : 0);   // 魚鱗：淡淡的斜紋
        outCol.push(c.r * shade, c.g * shade, c.b * shade);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < RING; j++) { const a0 = i * RING + j, a1 = i * RING + (j + 1) % RING, b0 = a0 + RING, b1 = a1 + RING; idx.push(a0, b0, a1, a1, b0, b1); }
    const mk = (pos, col, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = !low; m.receiveShadow = true; fish.add(m); return m; };
    fishSkin = night(glowVC(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, flatShading: true, side: THREE.FrontSide })), .42, '#ffffff');
    mk(outPos, outCol, fishSkin);   // 晚上魚身被投射燈打亮（燈光顏色會慢慢變）
    const bellyM = new THREE.MeshStandardMaterial({ color: '#b5654a', emissive: '#5a2414', emissiveIntensity: .5, roughness: .9, flatShading: true, side: THREE.BackSide }); NIGHT.push({ m: bellyM, max: 1.3, min: .5 });
    mk(inPos, null, bellyM);   // 肚子裡：暖暖的紅色
    // 肚子裡的小燈：兩邊輪流
    for (let s0 = CAVE0 + 1; s0 < CAVE1 - .5; s0 += 1.4) {
      const fr = frame(s0), sd = Math.round(s0 / 1.4) % 2 ? 1 : -1;
      const lm = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff1b0', emissive: '#ffcc55', emissiveIntensity: 3 }));
      lm.position.copy(fr.p).addScaledVector(fr.r, sd * 1.25).addScaledVector(fr.up, 1.5); fish.add(lm);
    }
    const orange = new THREE.MeshStandardMaterial({ color: '#ff6a2a', roughness: .55, flatShading: true, side: THREE.DoubleSide });
    const finM = night(new THREE.MeshStandardMaterial({ color: '#ffa36b', roughness: .5, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: .9 }), .7, '#ff8a4a');   // 魚鰭：半透明的橘色（晚上發光）
    const finEdge = new THREE.MeshStandardMaterial({ color: '#fff3e6', roughness: .5, side: THREE.DoubleSide });
    const waving = fishWaving;                                   // 會擺動的鰭
    const white = new THREE.MeshStandardMaterial({ color: '#fff7ee', roughness: .6, flatShading: true });
    const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: .3 });
    const finShape = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) sh.lineTo(q[0], q[1]); return new THREE.ShapeGeometry(sh); };
    const place = (geo, mat, fr, dx, dy, ry = 0, rz = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.copy(fr.p).addScaledVector(fr.r, dx).addScaledVector(fr.up, dy); m.quaternion.setFromRotationMatrix(basis(fr.t, fr.r)); m.rotateY(ry); m.rotateZ(rz); m.rotateX(rx); m.castShadow = !low; fish.add(m); return m; };
    // 嘴巴：張開的圓嘴唇（火車從這裡鑽進去），兩對鬍鬚
    const f0 = frame(CAVE0), fm = prof(0);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(WX * fm * .92, .32, 8, 22), orange); lip.position.copy(f0.p).addScaledVector(f0.up, CY * fm); lip.quaternion.setFromRotationMatrix(basis(f0.t, f0.r)); lip.scale.set(1, HY / WX, 1); fish.add(lip);
    for (const sd of [-1, 1]) for (const [dy, len, tilt] of [[-.2, 1.6, .5], [.35, 1.1, .2]]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(.07, .025, len, 6), orange);
      wh.position.copy(f0.p).addScaledVector(f0.r, sd * (WX * fm * .95)).addScaledVector(f0.up, CY * fm + dy).addScaledVector(f0.t, -len * .35);
      wh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f0.t.clone().multiplyScalar(-1).addScaledVector(f0.r, sd * .6).addScaledVector(f0.up, -tilt).normalize()); fish.add(wh);
    }
    // 眼睛：頭的兩側
    const fe = frame(CAVE0 + LEN * .07), fE = prof(.07);
    for (const sd of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 10), white); e.position.copy(fe.p).addScaledVector(fe.r, sd * WX * fE * .92).addScaledVector(fe.up, CY * fE + HY * fE * .38); fish.add(e);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 8), black); pu.position.copy(e.position).addScaledVector(fe.r, sd * .26).addScaledVector(fe.t, -.06); fish.add(pu);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), white); hl.position.copy(pu.position).addScaledVector(fe.r, sd * .2).addScaledVector(fe.up, .1); fish.add(hl);
    }
    // 背鰭：從背上長出來，一長條
    { const L0 = LEN * .32, L1 = LEN * .72, fr = frame(CAVE0 + (L0 + L1) / 2), f = prof(.52), half = (L1 - L0) / 2;
      const g = finShape([[-half, 0], [-half * .6, 2.1], [half * .1, 1.8], [half, .3], [half, 0]]);
      place(g, finM, fr, 0, CY * f + HY * f * .95, -Math.PI / 2);
      for (let k = 0; k < 5; k++) { const x0 = -half * .8 + k * half * .38; const ray = finShape([[x0, 0], [x0 + .12, 0], [x0 - half * .18 + .1, 1.85 - k * .25], [x0 - half * .18, 1.85 - k * .25]]); const m = place(ray, orange, fr, 0, CY * f + HY * f * .95, -Math.PI / 2); m.translateZ(.012); }   // 鰭上的紋路
    }
    // 胸鰭（頭後面兩側）、腹鰭（肚子兩側）：斜斜往後張開
    for (const [tt, sz, dy, spread] of [[.2, 2.3, -.5, .9], [.55, 1.5, -.9, .7]]) for (const sd of [-1, 1]) {
      const fr = frame(CAVE0 + LEN * tt), f = prof(tt);
      const g = finShape([[0, 0], [-sz * .15, sz], [-sz, sz * .8], [-sz * .75, .1]]);
      const m = place(g, finM, fr, sd * WX * f * .96, CY * f + HY * f * dy, sd > 0 ? 0 : Math.PI, 0, 0);
      m.rotateX(sd * spread); m.rotateY(sd * .4); waving.push({ m, base: m.quaternion.clone(), axis: 'x', amp: .18 * sd, sp: 2.2, ph: tt * 3 });
    }
    // 尾鰭：直立的燕尾，上下兩片，火車從中間出來
    { const fr = frame(CAVE1 - .3), f = prof(1);
      const tail = new THREE.Group(); tail.position.copy(fr.p).addScaledVector(fr.up, CY * f); tail.quaternion.setFromRotationMatrix(basis(fr.t, fr.r)); tail.rotateY(-Math.PI / 2); fish.add(tail);
      const lobe = (sgn, y0) => {
        const g = finShape([[0, 0], [1.4, sgn * 1.2], [3.0, sgn * 3.0], [3.4, sgn * 2.6], [2.2, sgn * .9], [1.0, 0]]);
        const m = new THREE.Mesh(g, finM); m.position.y = y0; m.castShadow = !low; tail.add(m);
        for (let k = 0; k < 4; k++) { const r0 = .5 + k * .45; const ray = finShape([[r0, 0], [r0 + .14, 0], [r0 + 1.6 + k * .3, sgn * (2.2 + k * .2)], [r0 + 1.45 + k * .3, sgn * (2.25 + k * .2)]]); const rm = new THREE.Mesh(ray, k % 2 ? orange : finEdge); rm.position.set(0, y0, .012); tail.add(rm); }
      };
      lobe(1, HY * f * .5); lobe(-1, -HY * f * .62);
      waving.push({ m: tail, base: tail.quaternion.clone(), axis: 'y', amp: .16, sp: 1.6, ph: 0 });
    }
    // 下半部的支撐：魚肚子底下的岩石底座＋兩根石柱（從海裡撐上來）
    const rockM = new THREE.MeshStandardMaterial({ color: '#7d6e63', roughness: .95, flatShading: true });
    const rock2 = new THREE.MeshStandardMaterial({ color: '#94857a', roughness: .95, flatShading: true });
    const ICO = new THREE.IcosahedronGeometry(1, 0);
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < (low ? 7 : 14); k++) {
      const tt = .08 + k / (low ? 7 : 14) * .84, fr = frame(CAVE0 + LEN * tt), f = prof(tt);
      const belly = fr.p.y + CY * f - HY * f;
      const r0 = new THREE.Mesh(ICO, rnd() < .5 ? rockM : rock2);
      r0.position.copy(fr.p).addScaledVector(fr.r, (rnd() - .5) * 1.6).setY(Math.max(.2, belly * .45)); r0.scale.set(1.2 + rnd() * .6, Math.max(.8, belly * .55), 1 + rnd() * .5); r0.rotation.set(rnd(), rnd() * 3, 0); r0.castShadow = !low; fish.add(r0);
    }
    // 🔦 四盞投射燈：架在岩石底座上往上打亮魚身，晚上看得到光柱（金→粉紅→天藍慢慢變）
    for (const [tt, sd] of [[.22, 1], [.22, -1], [.68, 1], [.68, -1]]) {
      const fr = frame(CAVE0 + LEN * tt), f = prof(tt), belly = fr.p.y + CY * f - HY * f;
      const base = fr.p.clone().addScaledVector(fr.r, sd * (WX * f + .9)).setY(Math.max(.6, belly - .4));
      const aim = fr.p.clone().addScaledVector(fr.up, CY * f).addScaledVector(fr.r, sd * WX * f * .6);
      const lampH = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, .35, 10), new THREE.MeshStandardMaterial({ color: '#333', roughness: .4, metalness: .5 })); lampH.position.copy(base); lampH.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim.clone().sub(base).normalize()); fish.add(lampH);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.17, 14), night(new THREE.MeshStandardMaterial({ color: '#fff7d6' }), 3, '#fff2b0')); lens.position.copy(base).addScaledVector(aim.clone().sub(base).normalize(), .18); lens.lookAt(aim); fish.add(lens);
      const dir = aim.clone().sub(base), len = dir.length();
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.25, .14, len, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.position.copy(base).addScaledVector(dir, .5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); beam.visible = false; fish.add(beam); beams.push({ m: beam, ph: tt * 4 + sd });
    }
    for (const tt of [.3, .7]) { const fr = frame(CAVE0 + LEN * tt), f = prof(tt), belly = fr.p.y + CY * f - HY * f;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, belly + .3, 8), rock2); col.position.copy(fr.p).setY((belly - .3) / 2); col.castShadow = !low; fish.add(col); }
  }
  // 鯉魚旗隨風飄：沿著旗子的長度做波浪（越往尾巴擺越大）
  let flagT = 0;
  const flagWave = (t) => {
    if (low && t - flagT < .1) return; flagT = t;
    if (flags.wheel) flags.wheel.rotation.y = t * 3;
    for (const f of flags) {
      const pos = f.geo.attributes.position, b = f.base;
      for (let i = 0; i < pos.count; i++) {
        const y = b[i * 3 + 1], k = -y / f.len;                       // 0＝嘴巴、1＝尾巴
        const w = Math.sin(t * 3.2 + f.ph - k * 5) * .09 * k * f.len, w2 = Math.cos(t * 2.3 + f.ph - k * 4) * .05 * k * f.len;
        pos.array[i * 3] = b[i * 3] + w; pos.array[i * 3 + 2] = b[i * 3 + 2] + w2;
      }
      pos.needsUpdate = true;
    }
  };
  const fishWave = (t) => { for (const w of fishWaving) { w.m.quaternion.copy(w.base); if (w.axis === 'x') w.m.rotateX(Math.sin(t * w.sp + w.ph) * w.amp); else w.m.rotateY(Math.sin(t * w.sp + w.ph) * w.amp); } };
  const inCave = (s0) => s0 > CAVE0 && s0 < CAVE1;

  // ------------------------------------------------ 📸 俯衝照：大俯衝最陡的地方旁邊有一台照相機，車子衝下來時喀擦一張
  let photoS = topS + 2, steep = 0; for (let s0 = topS; s0 < topS + 22; s0 += .25) { const ty = sample(s0).t.y; if (ty < steep) { steep = ty; photoS = s0; } }
  const ph = sample(photoS), phUp = new THREE.Vector3().crossVectors(ph.t, ph.r);
  const photoCamPos = ph.p.clone().addScaledVector(ph.r, -7.5).addScaledVector(ph.t, 2.5).setY(Math.max(1.5, ph.p.y - .4));
  const photoTarget = ph.p.clone().addScaledVector(ph.t, -1.2).addScaledVector(phUp, .6);
  { // 照相機的小柱子＋鏡頭
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, photoCamPos.y + .3, 6), postM); pole.position.copy(photoCamPos).setY((photoCamPos.y - .5) / 2); root.add(pole);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.45, .32, .35), new THREE.MeshStandardMaterial({ color: '#333' })); body.position.copy(photoCamPos).setY(photoCamPos.y - .2); body.lookAt(photoTarget); root.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, .2, 12), new THREE.MeshStandardMaterial({ color: '#1a1a1a' })); lens.position.set(0, 0, .25); lens.rotation.x = Math.PI / 2; body.add(lens);
  }

  // ------------------------------------------------ 📸 大迴圈照：照相機在迴圈中心點的正側邊、對著圓心，整個圓圈框住車子；車子在最高點頭下腳上時拍
  let loopS = -1, loopY = -1;
  for (let s0 = 0; s0 < L; s0 += .2) { const q = sample(s0).p; if (Math.hypot(q.x - LB.x, q.z - LB.z) < LR + 1.6 && q.y > loopY) { loopY = q.y; loopS = s0; } }
  // 尖叫的重點時段：坡頂 → 大俯衝最低點 → 迴圈最高點 → 出迴圈
  let diveBottomS = topS, dbY = 99; for (let s0 = topS; s0 < loopS - 6; s0 += .2) { const y = sample(s0).p.y; if (y < dbY) { dbY = y; diveBottomS = s0; } }
  let loopExitS = loopS; for (let s0 = loopS; s0 < loopS + 20; s0 += .2) { const q = sample(s0).p; if (Math.hypot(q.x - LB.x, q.z - LB.z) < LR + 1.6 && q.y > 2.6) loopExitS = s0; else break; }
  const loopTop = sample(loopS).p, loopC = LB.clone().addScaledVector(UP, LR);
  loopC.addScaledVector(LS, loopTop.clone().sub(loopC).dot(LS));          // 圓心和最高點在同一個側面位置
  const loopSide = loopC.clone().setY(0).dot(LS) >= 0 ? 1 : -1;           // 站在離市集比較遠的那一側，往市集方向拍（背景是島）
  const loopCamPos = loopC.clone().addScaledVector(LS, loopSide * 10.5).addScaledVector(LF, -3.8).addScaledVector(UP, -1.6);   // 再低一點往上拍：倒過來的乘客頭朝圓心，從下面看得到臉   // 稍微偏向車子迎面來的方向（最高點往 −LF 跑），看得到臉
  const loopTarget = loopC.clone().addScaledVector(UP, .5);
  { // 迴圈照相機：柱子從海面撐上來＋機身＋鏡頭
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, loopCamPos.y + .3, 6), postM); pole.position.copy(loopCamPos).setY((loopCamPos.y - .5) / 2); root.add(pole);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.45, .32, .35), new THREE.MeshStandardMaterial({ color: '#333' })); body.position.copy(loopCamPos).setY(loopCamPos.y - .2); body.lookAt(loopTarget); root.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, .2, 12), new THREE.MeshStandardMaterial({ color: '#1a1a1a' })); lens.position.set(0, 0, .25); lens.rotation.x = Math.PI / 2; body.add(lens);
  }

  // ------------------------------------------------ 車站：海上的木平台（和島面一樣高）＋屋頂＋招牌＋燈號
  const wood = new THREE.MeshStandardMaterial({ color: '#c98a4a', roughness: .85, flatShading: true });
  const st = new THREE.Group(); st.position.copy(stationC); st.rotation.y = Math.atan2(ts.x, ts.z); root.add(st);
  // 站內座標：+z 沿著軌道（行進方向）、-x 往島（平台在島和軌道之間）
  const box = (mat, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = !low; o.receiveShadow = true; st.add(o); return o; };
  const sideSign = Math.sign(new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, st.rotation.y).dot(us)) || 1;   // 站內 +x 指向島外還是島內
  const inX = -sideSign;                                                                                    // 往島的方向（站內 x）
  const PW = 2.6, PLEN = 13;
  box(wood, PW, .16, PLEN, inX * (PW / 2 + .62), H - .08, 0);
  const WK = 3.8;                                                   // 平台接回島上的木棧道
  box(wood, WK, .16, 2, inX * (PW + .62 + WK / 2), H - .1, 0);
  for (const z of [-.9, .9]) box(wood, .14, H + .3, .14, inX * (PW + .62 + WK * .5), (H - .3) / 2, z);
  for (const z of [-6, -2, 2, 6]) for (const x of [inX * .7, inX * (PW + .55)]) box(wood, .16, H + .4, .16, x, (H - .4) / 2, z);
  const roofM = new THREE.MeshStandardMaterial({ color: '#2f7fd1', roughness: .7 });
  for (const z of [-5.5, 5.5]) for (const x of [inX * (PW + .5), -inX * .95]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.6, 8), postM); p.position.set(x, H + 1.3, z); st.add(p); }
  box(roofM, PW + 2.2, .12, PLEN - 1, inX * (PW / 2 - .1), H + 2.65, 0);
  // ---- 🐟 站名招牌（照設計圖）：圓角膠囊形的厚招牌（米白底、橘紅色發光邊框、角落藍色浪花）＋下方橘金色副標牌，
  //      招牌上方一條躍出水面的 3D 鯉魚和水花；底下是圓角底座、兩根短柱和一圈暖色小燈。兩面都看得到。
  const STATION_NAME = opts.stationName || '鯉躍龍門站';
  const SUBTITLE = opts.stationSub || '鯉魚雲霄飛車';
  const FONT = "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const paint = () => { x.clearRect(0, 0, w, h); draw(x, w, h); t.needsUpdate = true; }; paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; };
  const rrect = (x, X, Y, W, Hh, R) => { x.beginPath(); x.roundRect(X, Y, W, Hh, R); };
  const waves = (x, cx, cy, flip) => {                     // 藍色浪花（角落）
    x.save(); x.translate(cx, cy); x.scale(flip ? -1 : 1, 1);
    const g = x.createLinearGradient(0, -60, 0, 60); g.addColorStop(0, '#7cc8f0'); g.addColorStop(1, '#2f7fd1'); x.fillStyle = g;
    x.beginPath(); x.moveTo(-10, 70); x.bezierCurveTo(-20, 0, 40, -60, 110, -40); x.bezierCurveTo(60, -40, 40, 0, 80, 20); x.bezierCurveTo(110, 40, 150, 20, 170, 0); x.bezierCurveTo(170, 50, 120, 80, 60, 80); x.closePath(); x.fill();
    x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(100, -38); x.bezierCurveTo(70, -30, 60, -5, 78, 12); x.bezierCurveTo(60, -10, 75, -32, 100, -38); x.fill();
    x.restore();
  };
  const faceTex = canvasTex(1400, 560, (x, w, h) => {
    rrect(x, 30, 30, w - 60, h - 60, 250); x.fillStyle = '#e8501c'; x.fill();                       // 橘紅色外框
    const g = x.createLinearGradient(0, 70, 0, h - 70); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#f6e6cc');
    rrect(x, 70, 70, w - 140, h - 140, 210); x.fillStyle = g; x.fill();                                 // 米白色底
    rrect(x, 88, 88, w - 176, h - 176, 194); x.strokeStyle = '#f2a25c'; x.lineWidth = 6; x.stroke();     // 內側細線
    waves(x, 90, h - 120, false); waves(x, w - 90, h - 120, true);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 210px ${FONT}`;
    x.fillStyle = 'rgba(120,60,20,.18)'; x.fillText(STATION_NAME, w / 2 + 6, h / 2 - 22);           // 淡淡的陰影
    x.fillStyle = '#4a2410'; x.fillText(STATION_NAME, w / 2, h / 2 - 28);
  });
  const subTex = canvasTex(800, 180, (x, w, h) => {
    rrect(x, 8, 8, w - 16, h - 16, 80); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffb347'); g.addColorStop(1, '#f08a1c'); x.fillStyle = g; x.fill();
    x.strokeStyle = '#ffe08a'; x.lineWidth = 8; x.stroke();
    rrect(x, 30, 30, w - 60, h - 60, 60); x.fillStyle = '#fff3dc'; x.fill();
    for (const cx of [70, w - 70]) { x.fillStyle = '#e0a020'; x.beginPath(); x.arc(cx, h / 2, 14, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#4a2410'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 84px ${FONT}`; x.fillText(SUBTITLE, w / 2, h / 2 + 4);
  });
  const sign = new THREE.Group(); st.add(sign);
  const SCX = inX * (PW / 2 - .1);
  sign.position.set(SCX, H + 2.72, 0); sign.rotation.y = Math.PI / 2;                                  // 招牌面向海（+x），背面面向島
  const SW = 5.4, SHh = 2.16, SR = 1.0, DEP = .32;
  const pill = (w, h, r) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0); sh.lineTo(w / 2, h / 2 - r); sh.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2); sh.lineTo(-w / 2 + r, h / 2); sh.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI); sh.lineTo(-w / 2, -h / 2 + r); sh.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5); return sh; };
  const glowM = new THREE.MeshStandardMaterial({ color: '#ff7a2a', emissive: '#ff6a1a', emissiveIntensity: .9, roughness: .4 });
  const frameM = new THREE.MeshStandardMaterial({ color: '#e8501c', roughness: .45, metalness: .1 });
  const creamM = new THREE.MeshStandardMaterial({ color: '#f6e6cc', roughness: .6 });
  { // 厚厚的招牌本體（側邊是橘紅色，外圈一條發光的邊）
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(pill(SW, SHh, SR), { depth: DEP, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 3, curveSegments: 18 }), frameM);
    body.position.set(0, 1.25, -DEP / 2); body.castShadow = !low; sign.add(body);
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(pill(SW + .16, SHh + .16, SR + .08), { depth: .08, bevelEnabled: false, curveSegments: 18 }), glowM); rim.position.set(0, 1.25, -.04); sign.add(rim);
    for (const sd of [1, -1]) {                                                                         // 正面、背面的圖
      const fm = new THREE.MeshStandardMaterial({ map: faceTex, emissiveMap: faceTex, transparent: true, alphaTest: .3, roughness: .55 }); night(fm, .75, '#ffffff');   // 晚上招牌亮起來
      const f = new THREE.Mesh(new THREE.PlaneGeometry(SW, SW * 560 / 1400), fm);
      f.position.set(0, 1.25, sd * (DEP / 2 + .065)); if (sd < 0) f.rotation.y = Math.PI; sign.add(f);
      // 副標牌：下方中間凸出來一塊
      const pb = new THREE.Mesh(new THREE.ExtrudeGeometry(pill(2.5, .58, .29), { depth: .1, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2, curveSegments: 12 }), new THREE.MeshStandardMaterial({ color: '#f08a1c', roughness: .4, metalness: .2 }));
      pb.position.set(0, .3, sd * (DEP / 2 + .06) - (sd < 0 ? .1 : 0)); sign.add(pb);
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5 * 180 / 800), new THREE.MeshStandardMaterial({ map: subTex, transparent: true, alphaTest: .3, roughness: .5 }));
      sp.position.set(0, .3, sd * (DEP / 2 + .2)); if (sd < 0) sp.rotation.y = Math.PI; sign.add(sp);
    }
    // 底座：圓角平台＋兩根短柱＋一圈暖色小燈
    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(pill(SW + .4, 1.1, .5), { depth: .14, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, curveSegments: 12 }), creamM);
    base.rotation.x = -Math.PI / 2; base.position.set(0, .02, .55); sign.add(base);
    const rimB = new THREE.Mesh(new THREE.ExtrudeGeometry(pill(SW + .48, 1.18, .54), { depth: .05, bevelEnabled: false, curveSegments: 12 }), glowM); rimB.rotation.x = -Math.PI / 2; rimB.position.set(0, .03, .59); sign.add(rimB);
    for (const x0 of [-1.7, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .3, 14), creamM); p.position.set(x0, .3, 0); sign.add(p); }
    const bulbM = new THREE.MeshStandardMaterial({ color: '#fff4c8', emissive: '#ffc44a', emissiveIntensity: 2.4 });
    for (let k = 0; k < 7; k++) for (const sd of [1, -1]) { const b0 = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), bulbM); b0.position.set(-SW / 2 + .5 + k * (SW - 1) / 6, .19, sd * .5); sign.add(b0); }
  }
  // ---- 躍出水面的 3D 鯉魚（招牌上方）：橘紅色魚鱗、白斑、大眼睛、張開的嘴、鬍鬚、大大的扇形尾鰭，四周有水花
  const KOI_Y = 2.3;                                                     // 魚肚子壓在招牌上緣（招牌頂端約 2.33）
  const leapKoi = new THREE.Group(); leapKoi.position.set(-.1, KOI_Y, 0); leapKoi.scale.setScalar(1.12); sign.add(leapKoi);   // 鯉魚和招牌連在一起：從招牌上緣的浪花躍出來
  {
    // 魚身：沿著一條拱起來的弧線，一圈一圈做出來（頭在左上、尾巴在右邊往上翹）
    const spine = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.55, .25, 0), new THREE.Vector3(-.9, .55, 0), new THREE.Vector3(0, .5, 0), new THREE.Vector3(.85, .25, 0), new THREE.Vector3(1.4, .35, 0)]);
    const NR = 30, NA = 20, pos = [], col = [], idx = [];
    const rad = (t) => (t < .12 ? .18 + Math.sqrt(t / .12) * .27 : t < .45 ? .45 + Math.sin((t - .12) / .33 * Math.PI / 2) * .05 : .5 - Math.pow((t - .45) / .55, 1.4) * .4);
    const TOP = new THREE.Color('#ff4a1c'), SIDE = new THREE.Color('#ff8a3a'), BELLY = new THREE.Color('#ffe7cf'), SPOT = new THREE.Color('#fff6ec');
    for (let i = 0; i <= NR; i++) {
      const t = i / NR, p = spine.getPointAt(t), tg = spine.getTangentAt(t), nz = new THREE.Vector3(0, 0, 1), ny = new THREE.Vector3().crossVectors(nz, tg).normalize(), r = rad(t);
      for (let j = 0; j < NA; j++) {
        const a0 = j / NA * TAU, cy = Math.cos(a0), cz = Math.sin(a0);
        const q = p.clone().addScaledVector(ny, cy * r * 1.08).addScaledVector(nz, cz * r * .86); pos.push(q.x, q.y, q.z);
        let c = cy > .2 ? TOP.clone().lerp(SIDE, 1 - (cy - .2) / .8) : cy > -.45 ? SIDE.clone().lerp(BELLY, (.2 - cy) / .65) : BELLY.clone();
        if (t < .16 && cy > .3 && Math.abs(cz) < .55) c = SPOT.clone();                                  // 頭頂白斑
        if (t > .16 && t < .86 && cy > -.35) { const sc = Math.sin(t * 46 + (Math.floor(t * 46 / Math.PI) % 2) * 1.6 + a0 * 4); if (sc > .35) c.multiplyScalar(.8); else if (sc < -.8) c.lerp(SPOT, .25); }   // 魚鱗：一片一片的深淺
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a0 = i * NA + j, a1 = i * NA + (j + 1) % NA, b0 = a0 + NA, b1 = a1 + NA; idx.push(a0, a1, b0, a1, b1, b0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const bodyK = new THREE.Mesh(geo, night(glowVC(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .05, side: THREE.DoubleSide })), .6, '#ffffff')); bodyK.castShadow = !low; leapKoi.add(bodyK);
    const head = spine.getPointAt(0);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.12, .055, 8, 14), new THREE.MeshStandardMaterial({ color: '#ff9a6a', roughness: .5 })); mouth.position.copy(head).add(new THREE.Vector3(-.05, -.02, 0)); mouth.rotation.y = Math.PI / 2; leapKoi.add(mouth);
    for (const sd of [1, -1]) {
      const ep = spine.getPointAt(.07).add(new THREE.Vector3(.02, .16, sd * .3));
      const e = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .3 })); e.position.copy(ep); leapKoi.add(e);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8), new THREE.MeshStandardMaterial({ color: '#111111', roughness: .2 })); pu.position.copy(ep).add(new THREE.Vector3(-.03, 0, sd * .06)); leapKoi.add(pu);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(.028, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.copy(pu.position).add(new THREE.Vector3(-.03, .04, sd * .05)); leapKoi.add(hl);
      // 鬍鬚：從嘴邊捲起來
      const wc = new THREE.CatmullRomCurve3([head.clone().add(new THREE.Vector3(.02, .05, sd * .1)), head.clone().add(new THREE.Vector3(-.2, .3, sd * .16)), head.clone().add(new THREE.Vector3(-.05, .52, sd * .2)), head.clone().add(new THREE.Vector3(.1, .45, sd * .22))]);
      const wh = new THREE.Mesh(new THREE.TubeGeometry(wc, 16, .018, 5), new THREE.MeshStandardMaterial({ color: '#ffd8a8', roughness: .4 })); leapKoi.add(wh);
    }
    // 魚鰭：背鰭、胸鰭、腹鰭、扇形尾鰭（半透明、有紋路）
    const finTex = canvasTex(256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ff7a3a'); g.addColorStop(1, '#ffd9a8'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 5; for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, k * h / 8); x.stroke(); } });
    const finM = new THREE.MeshStandardMaterial({ map: finTex, side: THREE.DoubleSide, transparent: true, opacity: .92, roughness: .4 });
    const fin = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) sh.lineTo(q[0], q[1]); const g = new THREE.ShapeGeometry(sh); g.computeBoundingBox(); const bb = g.boundingBox, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (g.attributes.position.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (g.attributes.position.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1)); return new THREE.Mesh(g, finM); };
    const dorsal = fin([[-.55, 0], [-.35, .42], [.05, .55], [.45, .3], [.6, 0]]); dorsal.position.set(-.35, .98, 0); leapKoi.add(dorsal);
    for (const sd of [1, -1]) { const pf = fin([[0, 0], [.15, -.45], [.55, -.55], [.4, -.1]]); pf.position.set(-.95, .2, sd * .3); pf.rotation.set(sd * .6, 0, -.3); leapKoi.add(pf);
      const vf = fin([[0, 0], [.1, -.3], [.4, -.35], [.3, -.05]]); vf.position.set(.1, .1, sd * .25); vf.rotation.set(sd * .5, 0, -.2); leapKoi.add(vf); }
    const tail = fin([[0, 0], [.5, .75], [1.05, .95], [.8, .35], [.95, 0], [.8, -.35], [1.0, -.8], [.45, -.55]]); tail.position.copy(spine.getPointAt(1)).add(new THREE.Vector3(-.05, 0, 0)); tail.rotation.z = .35; leapKoi.add(tail);
    leapKoi.userData.tail = tail;
    // 水花：藍白色的水滴
    const dropM = new THREE.MeshStandardMaterial({ color: '#dff3ff', emissive: '#7cc8f0', emissiveIntensity: .35, roughness: .2, transparent: true, opacity: .9 });
    for (const [x0, y0, z0, s0, rz] of [[-1.9, .2, .25, .16, .6], [-2.15, .55, -.2, .11, .9], [-1.75, -.2, -.3, .1, .3], [1.85, .9, .2, .14, -.5], [2.15, .6, -.25, .1, -.8], [1.6, 1.15, -.1, .08, -.3], [.4, -.35, .4, .09, .2], [-.5, -.4, -.4, .08, -.2]]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), dropM); d.position.set(x0, y0, z0); d.scale.set(s0 * .7, s0 * 1.4, s0 * .7); d.rotation.z = rz; leapKoi.add(d);
    }
    if (low) leapKoi.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  }
  // 招牌上緣的一道藍色浪花：把鯉魚和招牌連在一起（鯉魚從浪裡躍出來）
  {
    const crest = new THREE.Shape();
    crest.moveTo(-2.1, 0); crest.bezierCurveTo(-1.7, .35, -1.2, .55, -.7, .42); crest.bezierCurveTo(-.4, .62, .1, .7, .45, .5);
    crest.bezierCurveTo(.8, .66, 1.3, .6, 1.65, .32); crest.bezierCurveTo(1.85, .45, 2.1, .3, 2.2, 0); crest.lineTo(-2.1, 0);
    const waveM = new THREE.MeshStandardMaterial({ color: '#3f9ae0', roughness: .35, metalness: .05 });
    const foamM = new THREE.MeshStandardMaterial({ color: '#e8f6ff', roughness: .3 });
    const wv = new THREE.Mesh(new THREE.ExtrudeGeometry(crest, { depth: .5, bevelEnabled: true, bevelThickness: .08, bevelSize: .06, bevelSegments: 3, curveSegments: 14 }), waveM);
    wv.position.set(-.05, 2.12, -.25); wv.castShadow = !low; sign.add(wv);
    for (const [x0, y0, r0] of [[-1.5, 2.5, .16], [-.75, 2.62, .14], [.1, 2.7, .17], [.95, 2.66, .14], [1.75, 2.45, .12]]) for (const z0 of [-.3, .3]) {   // 浪頭的白色泡沫
      const f = new THREE.Mesh(new THREE.SphereGeometry(r0, 10, 8), foamM); f.position.set(x0, y0, z0); f.scale.y = .7; sign.add(f);
    }
  }
  // 屋簷一排暖色小燈（屋頂邊緣）
  { const bulbM = new THREE.MeshStandardMaterial({ color: '#fff4c8', emissive: '#ffc44a', emissiveIntensity: 2.2 });
    for (let k = 0; k < 8; k++) for (const x0 of [inX * (PW + 1.0), -inX * .9]) { const b0 = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .03, 10), bulbM); b0.position.set(x0, H + 2.72, -PLEN / 2 + 1.2 + k * (PLEN - 2.4) / 7); st.add(b0); } }
  // ---- 🎏 鯉魚旗：車站一端立一根旗桿（金球＋箭車），上面是五色吹流，接著黑、紅、藍、綠、小紅鯉魚，隨風飄
  const koiTex = (body, belly, face) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    // 由上（嘴巴）往下（尾巴）：白色的臉、眼睛、鰓、魚鱗、尾巴
    x.fillStyle = body; x.fillRect(0, 0, 256, 512);                 // 整圈都是魚身的顏色（像真的鯉魚旗，從哪一面看都是彩色的）
    x.fillStyle = belly; x.fillRect(0, 0, 18, 512); x.fillRect(238, 0, 18, 512);   // 肚子只有細細一條
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 92);                             // 白色的臉
    x.fillStyle = face; for (const ex of [64, 192]) { x.beginPath(); x.ellipse(ex, 46, 52, 44, 0, 0, Math.PI * 2); x.fill(); }   // 眼睛周圍的顏色
    for (const ex of [64, 192]) {                                    // 兩隻大眼睛（左右兩面）
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex, 58, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f2b51c'; x.beginPath(); x.arc(ex, 58, 22, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1a3a8a'; x.beginPath(); x.arc(ex, 58, 15, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.arc(ex, 58, 8, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = '#f2b51c'; x.lineWidth = 6; x.beginPath(); x.moveTo(0, 104); for (let u = 0; u <= 256; u += 16) x.lineTo(u, 104 + Math.sin(u / 256 * Math.PI * 4) * 8); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 3;     // 魚鱗
    for (let yy = 130; yy < 430; yy += 26) for (let xx = ((yy / 26) % 2) * 16; xx < 256; xx += 32) { x.beginPath(); x.arc(xx, yy, 16, Math.PI * .15, Math.PI * .85); x.stroke(); }
    const g = x.createLinearGradient(0, 430, 0, 512); g.addColorStop(0, body); g.addColorStop(1, '#ffffff'); x.fillStyle = g; x.fillRect(0, 430, 256, 82);
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 4; for (let u = 8; u < 256; u += 20) { x.beginPath(); x.moveTo(u, 440); x.lineTo(u + 4, 510); x.stroke(); }
    t.needsUpdate = true; return t;
  };
  const stripeTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); ['#e4332c', '#3fb5d8', '#f0c419', '#2f7fd1', '#ffffff'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 52, 0, 52, 64); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const flags = [];          // 會飄動的旗子：{ geo, base, len }
  const windsock = (len, r0, r1, mat, segs = 14) => {
    // 一條圓筒：嘴巴（y=0）張開、往後（-y）越來越細；之後轉成水平，順著風飄
    const geo = new THREE.CylinderGeometry(r1, r0, len, 14, segs, true); geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.castShadow = !low;
    flags.push({ geo, base: Float32Array.from(geo.attributes.position.array), len, ph: Math.random() * 6 });
    return m;
  };
  const pole = new THREE.Group(); pole.position.set(inX * (PW + .25), H, PLEN / 2 - .35); st.add(pole);   // 立在月台出口那一端的角落，鯉魚旗往海上飄
  const PH0 = 6.4;                                              // 旗桿高（從月台算起）
  { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, PH0 + .3, 8), new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: .5 })); p.position.y = (PH0 - .3) / 2; p.castShadow = !low; pole.add(p);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshStandardMaterial({ color: '#f2c230', metalness: .6, roughness: .3 })); ball.position.y = PH0 + .15; pole.add(ball);
    const wheel = new THREE.Group(); wheel.position.y = PH0 - .15; pole.add(wheel); wheel.userData.spin = true; flags.wheel = wheel;   // 箭車：會轉
    for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .55), new THREE.MeshStandardMaterial({ color: k % 2 ? '#e4332c' : '#f2c230' })); sp.rotation.y = k / 8 * Math.PI; wheel.add(sp); }
  }
  const KOI = [
    { len: 1.6, r: .22, mat: new THREE.MeshStandardMaterial({ map: stripeTex, side: THREE.DoubleSide, roughness: .8 }), y: PH0 - .5 },                 // 五色吹流
    { len: 2.6, r: .36, tex: ['#1d1d22', '#f3f3f3', '#1d1d22'], y: PH0 - 1.5 },   // 黑鯉（爸爸）
    { len: 2.2, r: .31, tex: ['#e8341c', '#ffe5e0', '#e8341c'], y: PH0 - 2.5 },   // 紅鯉（媽媽）
    { len: 1.8, r: .26, tex: ['#1f5fd6', '#e6efff', '#1f5fd6'], y: PH0 - 3.35 },  // 藍鯉
    { len: 1.5, r: .22, tex: ['#2f9a4a', '#e6f6ea', '#2f9a4a'], y: PH0 - 4.05 },  // 綠鯉
    { len: 1.1, r: .17, tex: ['#ff5a3a', '#fff0ea', '#ff5a3a'], y: PH0 - 4.6 },   // 小紅鯉
  ];
  for (const k of KOI) {
    const mat = k.mat || new THREE.MeshStandardMaterial({ map: koiTex(...k.tex), side: THREE.DoubleSide, roughness: .8 }); mat.emissiveMap = mat.map; night(mat, .55, '#ffffff');   // 晚上鯉魚旗也亮
    const holder = new THREE.Group(); holder.position.set(.08, k.y, 0); holder.rotation.z = Math.PI / 2 - .12; pole.add(holder);   // 往 +x 方向（順風）飄、尾巴稍微下垂
    holder.rotation.y = 0;
    const sock = windsock(k.len, k.r, k.r * .55, mat); holder.add(sock);
    if (!k.mat) { const ring = new THREE.Mesh(new THREE.TorusGeometry(k.r, .025, 6, 16), new THREE.MeshStandardMaterial({ color: '#ffffff' })); ring.rotation.x = Math.PI / 2; holder.add(ring); }
    const line = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .14, 4), postM); line.position.set(-.07, 0, 0); line.rotation.z = Math.PI / 2; holder.add(line);
  }
  pole.rotation.y = -Math.PI / 2;           // 旗子順著軌道方向（往車站外）飄，在月台外側，不會擋到列車
  // ---- 屋簷下一串小鯉魚旗（車站裝飾）
  {
    const n = 9, z0 = -PLEN / 2 + 1, z1 = PLEN / 2 - 1.2, xE = inX * (PW + .5), yE = H + 2.55;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, z1 - z0, 4), postM); string.rotation.x = Math.PI / 2; string.position.set(xE, yE, (z0 + z1) / 2); st.add(string);
    const minis = [['#1d1d22', '#f3f3f3', '#1d1d22'], ['#e8341c', '#ffe5e0', '#e8341c'], ['#1f5fd6', '#e6efff', '#1f5fd6'], ['#2f9a4a', '#e6f6ea', '#2f9a4a']].map((c) => new THREE.MeshStandardMaterial({ map: koiTex(...c), side: THREE.DoubleSide, roughness: .8 }));
    for (let k = 0; k < n; k++) {
      const h = new THREE.Group(); h.position.set(xE, yE - .02, z0 + (z1 - z0) * k / (n - 1)); st.add(h);
      h.add(windsock(.62, .1, .055, minis[k % minis.length], 6));
    }
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: '#4caf50', emissive: '#2e9e3a', emissiveIntensity: 1.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), lampMat); lamp.position.set(inX * (PW + .5), H + 2.3, 5.5); st.add(lamp);
  // 平台踩得到（站內座標換算）
  const inv = new THREE.Matrix4(); st.updateMatrixWorld(true); inv.copy(st.matrixWorld).invert();
  const lp = new THREE.Vector3();
  W.surfaces.push((x, z) => { lp.set(x, 0, z).applyMatrix4(inv); const xi = lp.x * inX; return (xi > .58 && xi < PW + .7 && Math.abs(lp.z) < PLEN / 2) || (xi >= PW + .6 && xi < PW + .62 + WK && Math.abs(lp.z) < 1) ? H : null; });   // 平台＋木棧道接到島上
  const exitSpot = st.localToWorld(new THREE.Vector3(inX * (PW * .55 + .6), 0, 0)).setY(H);
  const landSpot = st.localToWorld(new THREE.Vector3(inX * (PW + .62 + WK), 0, 0)).setY(H);   // 木棧道接上島的那一端

  // ------------------------------------------------ 🎫 搭乘按鈕：木棧道入口旁的售票機＋頭上的大按鈕牌，點一下就上車（沒停站就掛號等下一班）
  //   按鈕牌的字和顏色由 main.js 依狀態設定（setKiosk）；離鏡頭越遠，按鈕牌畫得越大，鳥瞰也點得到。
  const kiosk = new THREE.Group(); kiosk.position.set(inX * (PW + .25), 0, -(PLEN / 2 - .9)); st.add(kiosk);   // 月台入口那一端靠島的角落（離中間的大招牌遠一點，鳥瞰才不會被擋住）
  const kTxt = { a: '🎢 點我上車', b: '', c: '#2e9e3a' };
  const kCv = document.createElement('canvas'); kCv.width = 512; kCv.height = 176;
  const kTex = new THREE.CanvasTexture(kCv); kTex.colorSpace = THREE.SRGBColorSpace;
  const kPaint = () => {
    const x = kCv.getContext('2d'); x.clearRect(0, 0, 512, 176);
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.roundRect(10, 14, 492, 156, 40); x.fill();
    x.fillStyle = kTxt.c; x.beginPath(); x.roundRect(6, 6, 496, 150, 40); x.fill();
    x.lineWidth = 8; x.strokeStyle = '#ffffff'; x.stroke();
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `900 ${kTxt.b ? 58 : 68}px ${FONT}`; x.fillText(kTxt.a, 256, kTxt.b ? 62 : 82);
    if (kTxt.b) { x.font = `800 34px ${FONT}`; x.fillText(kTxt.b, 256, 122); }
    kTex.needsUpdate = true;
  };
  kPaint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(kPaint);
  const kPost = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.4, 8), postM); kPost.position.y = H + 1.2; kiosk.add(kPost);   // 往上撐著按鈕牌
  const kBody = new THREE.Mesh(new THREE.BoxGeometry(.7, .9, .45), new THREE.MeshStandardMaterial({ color: '#c23a1c', roughness: .6 })); kBody.position.y = H + .55; kiosk.add(kBody);   // 售票機
  const kFace = new THREE.Mesh(new THREE.PlaneGeometry(.6, .2), night(new THREE.MeshStandardMaterial({ map: kTex, emissiveMap: kTex, emissive: '#ffffff', emissiveIntensity: .25 }), 1, '#ffffff'));
  kFace.position.set(0, H + .75, .23); kiosk.add(kFace);
  const kFace2 = kFace.clone(); kFace2.position.z = -.23; kFace2.rotation.y = Math.PI; kiosk.add(kFace2);
  const kBtn = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .06, 16), night(new THREE.MeshStandardMaterial({ color: '#ffd23a' }), 1.5, '#ffd23a')); kBtn.rotation.x = Math.PI / 2; kBtn.position.set(0, H + .45, .25); kiosk.add(kBtn);
  const kSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: kTex, depthTest: false, fog: false })); kSp.renderOrder = 6; kSp.position.y = H + 2.2; kiosk.add(kSp);
  const kHit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 1.1), new THREE.MeshBasicMaterial({ visible: false })); kHit.position.y = H + .5; kiosk.add(kHit);
  const kWorld = new THREE.Vector3();
  function kioskTick() {
    kSp.getWorldPosition(kWorld);
    const d = W.camera ? W.camera.position.distanceTo(kWorld) : 10, k = clamp(d / 10, 1, 4);
    kSp.scale.set(2.2 * k, .76 * k, 1); kSp.position.y = H + 3.0 + .3 * k + Math.sin(performance.now() / 400) * .05;
  }

  // ------------------------------------------------ 列車：4 節彩色車廂，第一節是鯉魚頭
  const carCols = ['#e4532c', '#f0b429', '#2f7fd1', '#3e9b4f'];
  const cars = [], carBeams = [], CAR_BEAM = low ? 5 : 7;
  for (let k = 0; k < CARS; k++) {
    const g = new THREE.Group(); root.add(g);
    const bm = new THREE.MeshStandardMaterial({ color: carCols[k], roughness: .5, metalness: .15, flatShading: true });
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = !low; g.add(o); return o; };
    const B = new THREE.BoxGeometry(1, 1, 1);
    add(B, bm, 0, .22, 0, 1.0, .24, 1.45);                       // 底盤
    add(B, bm, 0, .42, -.62, 1.0, .5, .12);                      // 後背
    add(B, bm, -.48, .42, 0, .06, .3, 1.35); add(B, bm, .48, .42, 0, .06, .3, 1.35);   // 兩側
    add(B, bm, 0, .4, .66, 1.0, .36, .12);                       // 前擋
    add(B, new THREE.MeshStandardMaterial({ color: '#222' }), 0, .36, -.15, .86, .06, .7);   // 座墊
    add(B, new THREE.MeshStandardMaterial({ color: '#cfd6dd', metalness: .6, roughness: .3 }), 0, .66, .5, .8, .05, .05);   // 安全扶手
    for (const z of [-.5, .5]) for (const x of [-.36, .36]) add(new THREE.CylinderGeometry(.09, .09, .1, 10), new THREE.MeshStandardMaterial({ color: '#333' }), x, .08, z).rotation.z = Math.PI / 2;
    if (k === 0) {                                               // 鯉魚頭：紅白鯉魚的臉、鬍鬚
      const w = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .6 });
      add(new THREE.SphereGeometry(.5, 12, 8), w, 0, .42, 1.0, 1, .7, 1.1);
      add(new THREE.SphereGeometry(.5, 12, 8), bm, 0, .62, .92, .8, .45, .8);
      for (const s of [-1, 1]) { add(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshStandardMaterial({ color: '#111' }), s * .32, .55, 1.2); add(new THREE.CylinderGeometry(.015, .015, .4, 4), bm, s * .28, .3, 1.5).rotation.set(1.2, 0, s * .6); }
    }
    // 🚃 車廂燈：每節車底一條彩色燈條；鯉魚頭亮起來，還有一盞車頭燈
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.04, .05, 1.4), night(new THREE.MeshStandardMaterial({ color: carCols[k] }), 1.8, carCols[k])); strip.position.y = .09; g.add(strip);
    if (k === 0) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), night(new THREE.MeshStandardMaterial({ color: '#fffbe6' }), 3.5, '#fff3b0')); hl.position.set(0, .3, 1.5); g.add(hl);
      g.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === 'ffffff' && !NIGHT.find((n) => n.m === o.material)) night(o.material, .5, '#ffe6d0'); });
    }
    // 🔦 車廂裡往外打的投射光：每節車廂四個角落各一道光柱，往外上方斜斜射出、左右掃動、顏色慢慢換
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(.84, .04, 1.2), night(new THREE.MeshStandardMaterial({ color: '#fff6dc' }), 2.6, '#ffe8b0')); cabin.position.y = .345; g.add(cabin);   // 車廂地板發亮
    for (const [x, z, ph] of [[-.38, .52, 0], [.38, .52, 1.7], [-.38, -.48, 3.1], [.38, -.48, 4.6]]) {
      const pv = new THREE.Group(); pv.position.set(x, .42, z); g.add(pv);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, .1, 8), night(new THREE.MeshStandardMaterial({ color: '#ffffff' }), 4, '#ffffff')); pv.add(lamp);
      const geo = new THREE.CylinderGeometry(.75, .05, CAR_BEAM, 14, 1, true); geo.translate(0, CAR_BEAM / 2, 0);
      const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: carCols[k], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      beam.visible = false; beam.renderOrder = 3; pv.add(beam);
      carBeams.push({ pv, beam, sx: Math.sign(x), sz: Math.sign(z), ph: ph + k * .9 });
    }
    cars.push(g);
  }
  // ------------------------------------------------ 狀態
  let cur = { phase: 'dock', s: 0, left: DOCK, eta: 0 }, lastS = 0;
  function timeline(sec) {
    const tc = ((sec % CYCLE) + CYCLE) % CYCLE;
    if (tc < DOCK) return { phase: 'dock', s: 0, left: DOCK - tc, eta: 0 };
    const tr = tc - DOCK, s = sAtTime(tr);
    return { phase: s < topS ? 'lift' : s < BRAKE_S ? 'ride' : 'brake', s, left: 0, eta: RIDE - tr, v: vAtTime(tr) };
  }
  const carQ = [], carP = [];
  function placeCars() {
    for (let k = 0; k < CARS; k++) {
      const sp = sample(cur.s - k * CAR_GAP);
      const q = new THREE.Quaternion().setFromRotationMatrix(basis(sp.t, sp.r));
      cars[k].position.copy(sp.p); cars[k].quaternion.copy(q);
      carQ[k] = q; carP[k] = sp.p;
    }
  }
  placeCars();
  // 📸 拍照模式：晚上拍照那一下，從照相機打閃光燈照亮車廂和人物，並暫時關掉光柱（不然照片糊成一片）
  //   閃光燈一開始就放進場景、平常亮度 0：燈的數量不變，拍照時才不會因為重新編譯材質而卡一下
  const flash = new THREE.PointLight('#fff6e8', 0, 40, 1.6); root.add(flash);
  function photoMode(on, camPos, target) {
    const night = nightN > .05;
    for (const b of beams) b.m.visible = !on && night;
    for (const b of carBeams) b.beam.visible = !on && night;
    if (on && night && camPos) {   // 照相機離車子越近，閃光越弱（俯衝照比較近，不然車廂會被照成一片白）
      flash.position.copy(camPos).lerp(target || camPos, .25);
      const d = target ? camPos.distanceTo(target) : 11.5;
      flash.intensity = (60 + 140 * nightN) * Math.pow(d / 11.5, 1.6) * (d < 9 ? .55 : 1);
    }
    else flash.intensity = 0;
  }
  let chaseT = 0, nightN = 0;
  function update(n = 0) {
    // 🌙 天黑程度 n（0 白天～1 深夜）：發光材質、光柱、彩色小燈
    if (Math.abs(n - nightN) > .01 || n === 0 && nightN !== 0) {
      nightN = n;
      for (const e of NIGHT) e.m.emissiveIntensity = (e.min || 0) + (e.max - (e.min || 0)) * n;
      for (const b of beams) b.m.visible = n > .05;
      for (const b of carBeams) b.beam.visible = n > .05;
      chase.visible = n > .12;
    }
    if (n > .05) {
      const tt = performance.now() / 1000;
      for (const b of beams) { b.m.material.opacity = .22 * n; b.m.material.color.setHSL(((tt * .05 + b.ph * .1) % 1), .9, .62); }
      for (const b of carBeams) {   // 往外、往上斜射，左右掃動
        const sw = Math.sin(tt * 1.3 + b.ph);
        b.pv.rotation.set(b.sz * (.35 + .25 * Math.sin(tt * .9 + b.ph * 2)), 0, -b.sx * (.55 + .3 * sw));
        b.beam.material.opacity = .2 * n; b.beam.material.color.setHSL(((tt * .12 + b.ph * .13) % 1), .95, .6);
      }
      if (fishSkin) { washC.setHSL((tt * .05) % 1, .9, .62); fishSkin.emissive.copy(WHITE_C).lerp(washC, .45); }   // 魚身跟著投射燈的顏色慢慢變
      if (chase.visible && tt - chaseT > .08) {
        chaseT = tt;
        for (let k = 0; k < nChase; k++) { const i = Math.floor(k / 2); chaseCol.setHSL(((i / 24 - tt * .35) % 1 + 1) % 1, .95, .6); chase.setColorAt(k, chaseCol); }
        chase.instanceColor.needsUpdate = true;
      }
    }
    fishWave(performance.now() / 1000);
    flagWave(performance.now() / 1000);
    { const tt = performance.now() / 1000; leapKoi.rotation.z = -.14 + Math.sin(tt * 1.6 + .6) * .03; if (leapKoi.userData.tail) leapKoi.userData.tail.rotation.y = Math.sin(tt * 3.2) * .35; }
    lastS = cur.s;
    cur = timeline(now() / 1000);
    placeCars();
    const c = cur.phase !== 'dock' ? '#e8473f' : cur.left < 6 ? '#ffc23a' : '#4caf50';
    if (lamp.userData.c !== c) { lamp.userData.c = c; lampMat.color.set(c); lampMat.emissive.set(c); }
    kioskTick();
  }
  // 座位：第 i 位 → 第 floor(i/2) 節、左右
  function seatPose(i) {
    const k = Math.floor(i / 2) % CARS, x = (i % 2 ? 1 : -1) * SEAT_X;
    const pos = cars[k].localToWorld(new THREE.Vector3(x, .14, -.12));
    return { pos, q: cars[k].quaternion.clone(), car: k };
  }
  const hashSeat = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % COASTER_CAP; };
  // 其他登入者在車上：網路位置有延遲，直接排到座位上
  let seatFor = () => null;   // 其他人選的座位（main.js 從 market/fx 的 seat 讀來）；沒有就用 id 算出來的座位
  const seatOf = (id) => { const v = seatFor(id); return Number.isInteger(v) && v >= 0 && v < COASTER_CAP ? v : hashSeat(id); };
  function riderSpot(p, id) {
    if (!p) return null;
    const i = seatOf(id), sp = seatPose(i);
    const d = Math.hypot(p.x - sp.pos.x, p.z - sp.pos.z), dy = Math.abs((p.y ?? 0) - sp.pos.y);
    // 停站時要剛好坐在座位上；開車後只要在列車附近（網路位置落後）就排進座位
    let near = false; if (cur.phase === 'dock') near = d < .5 && dy < .5; else for (const cp of carP) if (Math.hypot(p.x - cp.x, p.z - cp.z) < 7 && Math.abs((p.y ?? 0) - cp.y) < 4) near = true;
    return near ? { ...sp, seat: i } : null;
  }
  return {
    root, cars, cap: COASTER_CAP, length: L, cycle: CYCLE, ride: RIDE, topY,
    station: { pos: stationC, exit: exitSpot, land: landSpot, u: us, t: ts, name: STATION_NAME },
    update, photoMode, seatPose, riderSpot, hashSeat, seatOf, setSeatFor: (f) => { seatFor = f; },
    docked: () => cur.phase === 'dock',
    boardOpen: () => cur.phase === 'dock' && cur.left > 3,
    thrill: () => cur.phase === 'ride' && (cur.s - lastS) > 0 && sample(cur.s).t.y < -.25,   // 正在往下衝
    status: () => ({ phase: cur.phase, docked: cur.phase === 'dock', left: Math.ceil(cur.left), eta: Math.ceil(cur.eta), s: cur.s }),
    speed: () => cur.v || 0,
    topS, diveBottomS: () => diveBottomS, loopExitS: () => loopExitS,
    travelTime: (s0, s1) => { const tAt = (x) => { let lo = 0, hi = dist.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (dist[m] < x) lo = m; else hi = m; } return times[hi]; }; return Math.max(0, tAt(s1) - tAt(s0)); },
    profile: () => ({ times, speeds, dist, topS, brakeS: BRAKE_S, L, at: (s0) => { const q = sample(s0); return [q.p.y, q.t.y]; } }),
    grade: () => (cur.phase === 'dock' ? 0 : sample(cur.s).t.y),
    anchor: () => cars[0].position,
    pick: (ray) => ray.intersectObjects([...cars, st], true).length > 0,
    carPick: (ray) => ray.intersectObjects(cars, true).length > 0,
    kioskPick: (ray) => ray.intersectObjects([kSp, kHit], false).length > 0,
    setKiosk(a, b, c) { if (a === kTxt.a && b === kTxt.b && c === kTxt.c) return; kTxt.a = a; kTxt.b = b || ''; kTxt.c = c; kPaint(); },
    kioskPos: () => kiosk.getWorldPosition(new THREE.Vector3()),
    kioskShow: (v) => { kSp.visible = v; },
    avoid: [stationC.clone(), exitSpot.clone(), ...posts.filter((q) => q.y0 > 0).map((q) => new THREE.Vector3(q.x, H, q.z))],
    // 測試用：路線上每一點
    debugPts: () => P,
    inCave: (k = 0) => cur.phase !== 'dock' && inCave(cur.s - k * CAR_GAP),
    photo: { s: photoS, cam: photoCamPos, target: photoTarget },
    loopPhoto: { s: loopS, cam: loopCamPos, target: loopTarget, fov: 36, hide: (v) => { loopPostHide(1, v); loopPostHide(-1, v); } },
    frontS: () => (cur.phase === 'dock' ? -1 : cur.s),
  };
}
