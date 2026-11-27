// 🏛️ 市長任務：幫市集加路燈。
// 環島自行車道外側有 10 個候選位置；玩家選一個位置，就會在那裡立一盞路燈（大家都看得到，晚上會亮）。
// 路燈記在 Firebase market/lamps/{位置}；規則還沒加上時只存在這台裝置。
import * as THREE from 'three';
import { TAU } from './kit.js?v=20261127f';
import { H } from './world.js?v=20261127f';

const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, flatShading: true, ...o });
const label = (text, bg, fg = '#fff', w = 128) => {
  const c = document.createElement('canvas'); c.width = w; c.height = 128; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const paint = () => { x.clearRect(0, 0, w, 128); x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, w - 8, 120, 60); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke(); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = "900 60px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.fillText(text, w / 2, 68); t.needsUpdate = true; };
  paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t;
};

export function createMayor(W, opts) {
  const { scene } = W, I = W.islands.center, low = !!opts.low;
  const root = new THREE.Group(); scene.add(root);
  // ---- 候選位置：自行車道外側，避開五條支線，找空地
  const bridgeA = W.bridges.map((b) => b.a), R = I.ring + (opts.lane || 1.25) / 2 + .5;
  const spots = [];
  for (let k = 0; k < 40 && spots.length < 10; k++) {
    const a = (k / 40) * TAU + .08;
    if (bridgeA.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < .32)) continue;
    const x = I.pos.x + Math.cos(a) * R, z = I.pos.z + Math.sin(a) * R;
    if (I.walk && I.walk.clear && I.walk.clear(x - I.pos.x, z - I.pos.z) < .35) continue;
    if (W.ground(x, z) == null) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.4)) continue;
    spots.push({ id: `s${spots.length + 1}`, no: spots.length + 1, x, z, a });
  }
  // ---- 候選位置的發亮號碼（選位置時才出現）
  const markers = new THREE.Group(); markers.visible = false; root.add(markers);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: .75 });
  for (const s of spots) {
    const g = new THREE.Group(); g.position.set(s.x, H + .05, s.z); markers.add(g);
    const r = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 24), ringMat); r.rotation.x = -Math.PI / 2; g.add(r);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(`💡${s.no}`, '#e8a317', '#fff', 192), depthTest: false })); sp.scale.set(1.1, .73, 1); sp.position.y = 1.2; g.add(sp);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 2.4, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1; hit.userData.spot = s.id; g.add(hit);
    s.marker = g; s.hit = hit;
  }
  // ---- 路燈模型：墨綠色燈柱＋彎臂＋燈籠；晚上燈罩發光、地上一圈暖色光暈
  const postM = m('#2f4a3a', { metalness: .3 }), bulbM = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcc55', emissiveIntensity: .4 });
  const glowM = new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0, depthWrite: false });
  const lamps = new Map();
  function makeLamp(s) {
    const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = -s.a + Math.PI / 2; root.add(g);
    const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = !low; g.add(o); return o; };
    add(new THREE.CylinderGeometry(.16, .2, .18, 8), postM, 0, .09, 0);
    add(new THREE.CylinderGeometry(.05, .06, 2.3, 8), postM, 0, 1.25, 0);
    add(new THREE.BoxGeometry(.06, .06, .5), postM, 0, 2.35, -.22);
    add(new THREE.BoxGeometry(.26, .06, .26), postM, 0, 2.28, -.46);
    add(new THREE.BoxGeometry(.2, .26, .2), bulbM, 0, 2.1, -.46);
    add(new THREE.ConeGeometry(.2, .16, 4), postM, 0, 2.36, -.46).rotation.y = Math.PI / 4;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), glowM); glow.rotation.x = -Math.PI / 2; glow.position.set(0, .09, -.46); g.add(glow);
    // 小小的蓋好動畫：從地上長出來
    g.scale.set(1, .01, 1); g.userData.grow = 0;
    return g;
  }
  // ---- 任務看板（服務台島）：裝飾擺好之後再找空地放（placeBoard）
  let hitB = null; const boardPos = new THREE.Vector3();
  function placeBoard(spot) {
    spot = spot || { x: -3, z: -6, face: 0 };
    const board = new THREE.Group(); board.position.set(spot.x, H, spot.z); board.rotation.y = spot.face || 0; root.add(board);
    const wood = m('#8a5a2e');
    for (const x of [-.55, .55]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 1.7, 6), wood); p.position.set(x, .85, 0); p.castShadow = !low; board.add(p); }
    const tex = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const paint = () => { x.fillStyle = '#2f4a3a'; x.beginPath(); x.roundRect(4, 4, 312, 192, 18); x.fill(); x.strokeStyle = '#f2c230'; x.lineWidth = 8; x.stroke(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = "900 46px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.fillText('🏛️ 市長任務', 160, 66); x.font = "800 34px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.fillStyle = '#ffe07a'; x.fillText('💡 幫市集加路燈', 160, 140); t.needsUpdate = true; };
      paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; })();
    // 看板兩面都有字
    for (const [z, ry] of [[.04, 0], [-.04, Math.PI]]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .8), new THREE.MeshStandardMaterial({ map: tex, roughness: .8 })); f.position.set(0, 1.35, z); f.rotation.y = ry; board.add(f); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.36, .86, .05), wood); back.position.set(0, 1.35, 0); board.add(back);
    hitB = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, .8), new THREE.MeshBasicMaterial({ visible: false })); hitB.position.y = .95; board.add(hitB);
    boardPos.set(spot.x, H, spot.z);
  }

  // ---- 狀態
  function setLamps(state) {
    for (const s of spots) {
      const on = !!(state && state[s.id]);
      if (on && !lamps.has(s.id)) lamps.set(s.id, makeLamp(s));
      if (!on && lamps.has(s.id)) { root.remove(lamps.get(s.id)); lamps.delete(s.id); }
      s.marker.children[0].visible = !on;                             // 已經有燈的位置：號碼變灰、不能再選
      s.marker.children[1].material.opacity = on ? .25 : 1;
    }
  }
  function update(t, dt, night) {
    const k = Math.max(0, Math.min(1, night ?? 0));
    bulbM.emissiveIntensity = .4 + k * 2.6; glowM.opacity = k * .6;   // 地上的光暈要夠亮，路面才看得出被照亮
    for (const g of lamps.values()) if (g.userData.grow < 1) { g.userData.grow = Math.min(1, g.userData.grow + dt * 1.5); const e = 1 - (1 - g.userData.grow) ** 3; g.scale.set(1, Math.max(.01, e), 1); }
    if (markers.visible) for (const s of spots) s.marker.children[0].rotation.z = t * .8;
  }
  return {
    spots, boardPos,
    placeBoard,
    pickBoard: (ray) => !!hitB && ray.intersectObject(hitB, false).length > 0,
    pickSpot: (ray) => { const h = ray.intersectObjects(spots.map((s) => s.hit), false)[0]; return h ? spots.find((s) => s.id === h.object.userData.spot) : null; },
    showMarkers: (on) => { markers.visible = on; },
    setLamps, update,
    avoid: spots.map((s) => new THREE.Vector3(s.x, H, s.z)),
  };
}
