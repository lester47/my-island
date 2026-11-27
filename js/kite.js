// 🪁 放風箏（願望「希望風箏可以讓人放」）：
// - 漫遊時在陸地上，風箏飛在背後的空中，隨風左右飄、上下晃，一條線連到手上
// - 走路時風箏被拉著走；坐船、騎車、坐熱氣球、坐雲霄飛車時先收起來
// - 目前只畫在自己的畫面上（要讓別人看到，Firebase 規則的 market/fx 要多允許一個 kite 欄位）
import * as THREE from 'three';

export const KITES = {
  red: { icon: '🔴', name: '紅鯉魚風箏', a: '#e4532c', b: '#ffd23a' },
  blue: { icon: '🔵', name: '藍天風箏', a: '#2f7fd1', b: '#ffffff' },
  green: { icon: '🟢', name: '青蛙風箏', a: '#3e9b4f', b: '#c8f26b' },
  purple: { icon: '🟣', name: '星星風箏', a: '#8a5cd0', b: '#ffb6e1' },
};

const LINE_PTS = 16;

export function createKite(scene, kind) {
  const K = KITES[kind] || KITES.red;
  const g = new THREE.Group();
  // 菱形風箏面：上下兩塊不同顏色
  const face = (pts, col) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.computeVertexNormals();
    const o = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: .8, side: THREE.DoubleSide, flatShading: true })); g.add(o); return o;
  };
  const T = [0, .75, 0], R = [.55, .1, 0], B = [0, -.85, 0], L = [-.55, .1, 0], C = [0, .1, .06];
  face([...T, ...L, ...C, ...T, ...C, ...R], K.a);
  face([...L, ...B, ...C, ...C, ...B, ...R], K.b);
  // 竹骨
  const stick = new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: .9 });
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(.03, 1.6, .03), stick); s1.position.set(0, -.05, .07); g.add(s1);
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, .03, .03), stick); s2.position.set(0, .1, .07); g.add(s2);
  // 尾巴：一串小蝴蝶結，跟著風擺
  const tail = [];
  const bow = new THREE.MeshStandardMaterial({ color: K.b === '#ffffff' ? '#e4532c' : K.b, roughness: .8, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.22, .1, .02), bow); g.add(b); tail.push(b); }
  g.scale.setScalar(1.3);
  scene.add(g);
  // 風箏線：從手到風箏，中間往下垂一點
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f5f0e6' }));
  line.frustumCulled = false; scene.add(line);

  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), want = new THREE.Vector3(), tmp = new THREE.Vector3();
  let ready = false, ph = Math.random() * 10;
  // hand：手的位置；yaw：人面向的方向；wind：風往哪裡吹（弧度）
  function update(hand, yaw, t, dt, wind = 0.6) {
    dt = Math.min(dt, .05); ph += dt;
    // 風箏飄在下風處的空中（約 9 公尺遠、7 公尺高），走路時被拉著
    const wx = Math.sin(wind), wz = Math.cos(wind);
    const sway = Math.sin(ph * .7) * 2.2 + Math.sin(ph * 1.9) * .6, bob = Math.sin(ph * 1.1) * .7 + Math.sin(ph * 2.7) * .25;
    want.set(hand.x + wx * 8 + wz * sway, hand.y + 7 + bob, hand.z + wz * 8 - wx * sway);
    if (!ready) { pos.copy(want).setY(hand.y + 1.5); ready = true; }
    tmp.copy(want).sub(pos); vel.addScaledVector(tmp, dt * 2.2); vel.multiplyScalar(Math.max(0, 1 - dt * 2.4));
    pos.addScaledVector(vel, dt);
    const d = pos.distanceTo(hand); if (d > 12) pos.sub(hand).setLength(12).add(hand);   // 線只有 12 公尺長
    g.position.copy(pos);
    // 風箏面朝著拿線的人，往後仰一點，跟著飄的方向歪
    g.lookAt(hand.x, pos.y, hand.z); g.rotateX(-.45); g.rotateZ(Math.sin(ph * .7) * .35 - vel.x * .04);
    tail.forEach((b, i) => { b.position.set(Math.sin(ph * 3 - i * .8) * (.08 + i * .05), -.95 - i * .28, -.05 - i * .03); b.rotation.z = Math.sin(ph * 4 - i) * .6; });
    // 線：手 → 風箏的下角，二次曲線往下垂
    g.updateMatrixWorld(); const end = new THREE.Vector3(0, -.5, 0).applyMatrix4(g.matrixWorld);
    const a = line.geometry.attributes.position, sag = Math.min(1.6, hand.distanceTo(end) * .12);
    for (let i = 0; i < LINE_PTS; i++) { const k = i / (LINE_PTS - 1); a.setXYZ(i, hand.x + (end.x - hand.x) * k, hand.y + (end.y - hand.y) * k - Math.sin(k * Math.PI) * sag, hand.z + (end.z - hand.z) * k); }
    a.needsUpdate = true;
  }
  function show(on) { g.visible = on; line.visible = on; if (!on) ready = false; }
  function dispose() {
    scene.remove(g); scene.remove(line);
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    line.geometry.dispose(); line.material.dispose();
  }
  return { kind, g, update, show, dispose, pos };
}
