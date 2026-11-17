// 攤位立牌：每個攤位在自己的島上有一支木頭立牌，寫攤號和攤名；牌面會轉向鏡頭，點牌子打開攤位卡
import * as THREE from 'three';

const TAU = Math.PI * 2;
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const pad2 = (n) => String(n).padStart(2, '0');

function drawBoard(st, color, dark) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 200;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const lines = String(st.name).split('／').map((s) => s.trim()).filter(Boolean);
  const paint = () => {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 512, 200);
    // 木牌底＋島色外框
    const r = 26; g.beginPath(); g.roundRect(6, 6, 500, 188, r); g.fillStyle = '#fff8e8'; g.fill();
    g.lineWidth = 12; g.strokeStyle = color; g.stroke();
    // 攤號圓章
    g.beginPath(); g.arc(78, 100, 54, 0, TAU); g.fillStyle = dark; g.fill();
    g.fillStyle = '#fff'; g.font = `900 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pad2(st.no), 78, 104);
    // 攤名：一行或兩行（合併攤用「／」分兩行），太長就縮小字
    g.fillStyle = '#2a1d12'; g.textAlign = 'left';
    const maxW = 340, x = 148;
    const fit = (txt, size) => { let s = size; g.font = `900 ${s}px ${FONT}`; while (g.measureText(txt).width > maxW && s > 20) { s -= 2; g.font = `900 ${s}px ${FONT}`; } return s; };
    if (lines.length === 1) { fit(lines[0], 54); g.fillText(lines[0], x, 104); }
    else { const s = Math.min(fit(lines[0], 42), fit(lines[1], 42)); g.font = `900 ${s}px ${FONT}`; g.fillText(lines[0], x, 74); g.fillText(lines[1], x, 132); }
    tex.needsUpdate = true;
  };
  paint();
  if (document.fonts) { document.fonts.load(`900 40px ${FONT}`, st.name).then(paint).catch(() => {}); document.fonts.ready.then(paint); }
  return tex;
}

export function createSigns(W, content, H) {
  const { scene, islands } = W;
  const signs = [], pickables = [];
  const postMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: .9 });
  const postGeo = new THREE.CylinderGeometry(.06, .07, 1.25, 6), capGeo = new THREE.BoxGeometry(1.58, .62, .06);
  const BW = 1.5, BH = BW * 200 / 512;

  for (const I0 of content.islands) {
    const I = islands[I0.id]; if (!I || !I.walk) continue;
    const stalls = content.stalls.filter((s) => s.island === I0.id).sort((a, b) => a.no - b.no);
    if (!stalls.length) continue;
    // 不擋橋頭（朝中央島的方向）和鯉魚號碼頭
    const toC = Math.atan2(-I.pos.z, -I.pos.x);
    const avoid = [[toC, .5]];
    if (W.pier && W.pier.berth && I0.id === 'puzzle') { const b = W.pier.berth.pos; avoid.push([Math.atan2(b.z - I.pos.z, b.x - I.pos.x), .6]); }
    const near = (th) => avoid.some(([a, w]) => { let d = th - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d) < w; });
    // 候選位置：石板小路外側一點的草地，四周要有空間
    const cand = [];
    for (let k = 0; k < 120; k++) {
      const th = toC + .5 + k / 120 * (TAU - 1);      // 從橋頭右邊開始繞一圈，攤號照順序排
      if (near(th)) continue;
      const r = Math.min(I.walk.radAt(th) + .95, I.top(th) * .86);
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      if (I.walk.clear(x, z) < .45) continue;
      cand.push({ th, x, z });
    }
    if (!cand.length) continue;
    stalls.forEach((st, k) => {
      const c = cand[Math.floor((k + .5) * cand.length / stalls.length)];
      const g = new THREE.Group(); g.position.set(I.pos.x + c.x, H, I.pos.z + c.z);
      const post = new THREE.Mesh(postGeo, postMat); post.position.y = .62; post.castShadow = true; g.add(post);
      const head = new THREE.Group(); head.position.y = 1.25 + BH / 2; g.add(head);
      const back = new THREE.Mesh(capGeo, postMat); back.scale.set(BW / 1.5, BH / .58, 1); back.position.z = -.04; back.castShadow = true; head.add(back);
      const tex = drawBoard(st, I0.color, I0.dark);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .28, roughness: .85 }));
      face.position.z = .005; head.add(face);
      scene.add(g);
      const s = { g, head, face, st, island: I0.id };
      signs.push(s); pickables.push({ obj: face, sign: s }); pickables.push({ obj: back, sign: s });
    });
  }
  // 牌面只沿垂直軸轉向鏡頭（不會歪頭），遠看也看得到正面
  function update(camera) {
    for (const s of signs) {
      const dx = camera.position.x - s.g.position.x, dz = camera.position.z - s.g.position.z;
      s.head.rotation.y = Math.atan2(dx, dz);
    }
  }
  return { signs, pickables, update };
}
