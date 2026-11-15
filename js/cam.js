// 鏡頭：拖曳旋轉縮放、回到全景、點島飛近（電影史詩運鏡）、開場、導覽、地面漫遊
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TAU, clamp, lerp, easeInOut, smooth } from './kit.js?v=20261115j';
import { H } from './world.js?v=20261115j';
import { SHORE } from './scenery.js?v=20261115j';

export function createCam(W, canvas, hooks) {
  const camera = W.camera;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
  controls.rotateSpeed = .55; controls.zoomSpeed = .9;
  controls.minPolarAngle = THREE.MathUtils.degToRad(14); controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
  // 在標籤等其他元素上放開滑鼠時，也把「放開」補送給 3D 畫面，避免旋轉卡住
  const downIds = new Set();
  canvas.addEventListener('pointerdown', (e) => downIds.add(e.pointerId));
  addEventListener('pointerup', (e) => { if (downIds.has(e.pointerId) && e.target !== canvas) canvas.dispatchEvent(new PointerEvent('pointerup', e)); downIds.delete(e.pointerId); }, true);
  addEventListener('pointercancel', (e) => { if (downIds.has(e.pointerId) && e.target !== canvas) canvas.dispatchEvent(new PointerEvent('pointercancel', e)); downIds.delete(e.pointerId); }, true);
  const HOME_T = new THREE.Vector3(0, 8, -6);           // 全景注視點略高、略後，讓上方露出遠山稜線
  const S = { busy: null, mode: 'orbit', reduced: false, mobile: false };

  const ELEV_D = THREE.MathUtils.degToRad(15), ELEV_M = THREE.MathUtils.degToRad(24);
  const RH = SHORE - 34;                                  // 鏡頭水平距離上限：永遠在湖面上，看不到山的底面與斷邊
  let ELEV = ELEV_D;
  const PTS = [];
  for (const id in W.islands) { const I = W.islands[id]; for (let a = 0; a < 8; a++) PTS.push(new THREE.Vector3(I.pos.x + Math.cos(a / 8 * TAU) * I.R * 1.2, a % 2 ? 0 : 4, I.pos.z + Math.sin(a / 8 * TAU) * I.R * 1.2)); }
  const probe = new THREE.PerspectiveCamera();
  function homeDist() {
    // 實際投影所有島的外框，找出剛好看得到全部島（含標籤）的距離
    probe.fov = camera.fov; probe.aspect = camera.aspect; probe.near = .5; probe.far = 2000; probe.updateProjectionMatrix();
    const top = S.mobile ? .3 : .26, bot = S.mobile ? -.6 : -.84;
    for (let d = 40; d < 260; d += 3) {
      probe.position.copy(sphPos(HOME_T, d, 0, ELEV)); probe.lookAt(HOME_T); probe.updateMatrixWorld();
      if (PTS.every((p) => { const v = p.clone().project(probe); return Math.abs(v.x) < .94 && v.y < top && v.y > bot; })) return d;
    }
    return 260;
  }
  function sphPos(target, dist, az, el) { return target.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist)); }
  function limits() { ELEV = S.mobile ? ELEV_M : ELEV_D; const d = homeDist(); controls.minDistance = 14; controls.maxDistance = Math.min(d * 1.3, 280); }
  function setHome(instant = true) {
    limits();
    const d = homeDist();
    if (instant) { controls.target.copy(HOME_T); camera.position.copy(sphPos(HOME_T, d, 0, ELEV)); controls.update(); }
    return { t: HOME_T.clone(), p: sphPos(HOME_T, d, 0, ELEV) };
  }

  // 沿弧線補間：位置以球座標內插，可加「拉高」
  function flight(to, ms, lift = 0, done) {
    const from = { t: controls.target.clone(), p: camera.position.clone() };
    if (S.reduced || ms <= 0) { controls.target.copy(to.t); camera.position.copy(to.p); controls.update(); S.busy = null; done && done(); return; }
    const a = new THREE.Spherical().setFromVector3(from.p.clone().sub(from.t)), b = new THREE.Spherical().setFromVector3(to.p.clone().sub(to.t));
    let dth = b.theta - a.theta; while (dth > Math.PI) dth -= TAU; while (dth < -Math.PI) dth += TAU;
    S.busy = { from, to, a, b, dth, t0: performance.now(), ms: S.mobile ? ms * .7 : ms, lift, done };
    controls.enabled = false;
  }
  function stepFlight() {
    const F = S.busy; if (!F || F.custom) return;
    const k = clamp((performance.now() - F.t0) / F.ms, 0, 1), e = easeInOut(k);
    const t = F.from.t.clone().lerp(F.to.t, e);
    const rad = lerp(F.a.radius, F.b.radius, e) + Math.sin(k * Math.PI) * F.lift;
    const phi = lerp(F.a.phi, F.b.phi, e) - Math.sin(k * Math.PI) * (F.lift ? .32 : 0);
    const th = F.a.theta + F.dth * e;
    camera.position.copy(t).add(new THREE.Vector3().setFromSphericalCoords(rad, clamp(phi, .12, 1.45), th));
    controls.target.copy(t); camera.lookAt(t);
    if (k >= 1) { S.busy = null; controls.enabled = S.mode === 'orbit'; const dmp = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.target.copy(F.to.t); camera.position.copy(F.to.p); controls.update(); controls.enableDamping = dmp; F.done && F.done(); }   // 清掉拖曳殘留的慣性，停在正確位置
  }

  function islandView(I) {
    const az = Math.atan2(I.pos.x, I.pos.z) * .45;      // 島的正面（朝外側稍微偏）
    const t = I.pos.clone().setY(H + .6);
    const d = I.id === 'center' ? 30 : 23;
    return { t, p: sphPos(t, d, az, THREE.MathUtils.degToRad(34)) };
  }
  function flyToIsland(I, done) { flight(islandView(I), 2000, 16, done); }
  function home(done) { const h = setHome(false); flight({ t: h.t, p: h.p }, 1400, 6, done); }

  // ------------------------------------------------------------ 開場運鏡（4～6 秒，可跳過）
  function intro(done) {
    const h = setHome(false);
    if (S.reduced) { setHome(true); done && done(); return; }
    const dur = (S.mobile ? 5000 * .7 : 5200);
    const t0 = performance.now();
    const P0 = new THREE.Vector3(-150, 120, -190), P1 = new THREE.Vector3(-30, 82, -70);     // 高空、雲層
    controls.enabled = false;
    S.busy = { custom: true, done, t0, dur };
    S.introStep = () => {
      const k = clamp((performance.now() - t0) / dur, 0, 1);
      let pos, tgt = HOME_T.clone();
      if (k < .3) { const e = smooth(k / .3); pos = P0.clone().lerp(P1, e); }              // 穿過雲層
      else if (k < .72) {                                                                  // 環繞半圈並俯衝
        const e = smooth((k - .3) / .42), az = lerp(Math.atan2(P1.x, P1.z), Math.atan2(P1.x, P1.z) + Math.PI, e);
        const rad = lerp(Math.hypot(P1.x, P1.z), 26, e), y = lerp(P1.y, 14, e);
        pos = new THREE.Vector3(Math.sin(az) * rad, y, Math.cos(az) * rad);
      } else {                                                                             // 拉遠成全景
        const e = smooth((k - .72) / .28), az0 = Math.atan2(P1.x, P1.z) + Math.PI;
        const s = new THREE.Vector3(Math.sin(az0) * 26, 14, Math.cos(az0) * 26);
        pos = s.lerp(h.p, e);
      }
      camera.position.copy(pos); camera.lookAt(tgt); controls.target.copy(tgt);
      hooks.onIntro && hooks.onIntro(k);
      if (k >= 1) finishIntro();
    };
  }
  function finishIntro() {
    if (!S.introStep) return;
    S.introStep = null; const d = S.busy && S.busy.done; S.busy = null;
    setHome(true); controls.enabled = S.mode === 'orbit'; hooks.onIntro && hooks.onIntro(1); d && d();
  }

  // ------------------------------------------------------------ 地面漫遊（第一人稱）
  const walk = { yaw: 0, pitch: -.05, keys: {}, pad: {}, pos: new THREE.Vector3() };
  function enterWalk() {
    S.mode = 'walk'; controls.enabled = false; S.busy = null;
    walk.pos.set(0, H, 7.4); walk.yaw = Math.PI; walk.pitch = -.05;      // 從中央島出發，面向服務台
    placeWalk();
  }
  function exitWalk(done) { S.mode = 'orbit'; const h = setHome(false); flight({ t: h.t, p: h.p }, 1400, 0, done); }
  function placeWalk() {
    const eye = walk.pos.clone().setY(walk.pos.y + 1.05);
    camera.position.copy(eye);
    const dir = new THREE.Vector3(Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(walk.yaw) * Math.cos(walk.pitch));
    camera.lookAt(eye.clone().add(dir));
  }
  function stepWalk(dt) {
    const k = walk.keys, p = walk.pad;
    const fwd = (k.KeyW || k.ArrowUp || p.up ? 1 : 0) - (k.KeyS || k.ArrowDown || p.down ? 1 : 0);
    const turn = (k.ArrowLeft || p.left ? 1 : 0) - (k.ArrowRight || p.right ? 1 : 0);
    const strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    walk.yaw += turn * dt * 1.8;
    const sp = 4.2 * dt;
    const dx = (Math.sin(walk.yaw) * fwd - Math.cos(walk.yaw) * strafe) * sp, dz = (Math.cos(walk.yaw) * fwd + Math.sin(walk.yaw) * strafe) * sp;
    if (dx || dz) {
      // 分軸嘗試，碰到牆可以沿牆滑動；走到海邊或建築會被擋住
      const tryMove = (x, z) => { const h = W.ground(x, z); if (h == null) return false; walk.pos.set(x, h, z); return true; };
      if (!tryMove(walk.pos.x + dx, walk.pos.z + dz)) { tryMove(walk.pos.x + dx, walk.pos.z) || tryMove(walk.pos.x, walk.pos.z + dz); }
    }
    placeWalk();
  }
  // 拖曳到低角度又拉遠時，把鏡頭抬高，水平距離不超過 RH
  const _sp = new THREE.Spherical();
  function clampReach() {
    const off = camera.position.clone().sub(controls.target);
    _sp.setFromVector3(off);
    const tx = controls.target.x, tz = controls.target.z;
    for (let k = 0; k < 8; k++) {
      const p = controls.target.clone().add(new THREE.Vector3().setFromSpherical(_sp));
      if (Math.hypot(p.x, p.z) <= RH) { if (k) { camera.position.copy(p); camera.lookAt(controls.target); } return; }
      _sp.phi = Math.max(.05, _sp.phi * .9);
    }
    camera.position.copy(controls.target.clone().add(new THREE.Vector3().setFromSpherical(_sp))); camera.lookAt(controls.target);
  }
  let look = null;
  canvas.addEventListener('pointerdown', (e) => { if (S.mode === 'walk') { look = { x: e.clientX, y: e.clientY, yaw: walk.yaw, pitch: walk.pitch }; } });
  addEventListener('pointermove', (e) => { if (look && S.mode === 'walk') { walk.yaw = look.yaw - (e.clientX - look.x) * .005; walk.pitch = clamp(look.pitch - (e.clientY - look.y) * .004, -.9, .6); } });
  addEventListener('pointerup', () => { look = null; });

  function update(dt) {
    if (S.introStep) { S.introStep(); return; }
    if (S.mode === 'walk') { stepWalk(dt); return; }
    if (S.busy) { stepFlight(); return; }
    controls.enableDamping = !S.reduced;
    controls.update();
    clampReach();
  }
  return { controls, S, walk, setHome, flyToIsland, home, intro, finishIntro, enterWalk, exitWalk, update, islandView, flight, limits };
}
