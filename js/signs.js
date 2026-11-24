// 攤位實體：每個攤位在自己的島上有一座小攤子（桌子、條紋遮雨棚、招牌、依類型擺的道具）
// 招牌寫攤號和攤名，前後兩面都有字；點攤子或招牌就打開那一攤的攤位卡
import * as THREE from 'three';
import { batchStatic } from './kit.js?v=20261125c';

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
    g.beginPath(); g.roundRect(6, 6, 500, 188, 26); g.fillStyle = '#fff8e8'; g.fill();
    g.lineWidth = 12; g.strokeStyle = color; g.stroke();
    g.beginPath(); g.arc(78, 100, 54, 0, TAU); g.fillStyle = dark; g.fill();
    g.fillStyle = '#fff'; g.font = `900 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pad2(st.no), 78, 104);
    g.fillStyle = '#2a1d12'; g.textAlign = 'left';
    const maxW = 340, x = 148;
    const fit = (txt, size) => { let s = size; g.font = `900 ${s}px ${FONT}`; while (g.measureText(txt).width > maxW && s > 20) { s -= 2; g.font = `900 ${s}px ${FONT}`; } return s; };
    if (st.game && st.game.ready) {                          // 有線上小遊戲：招牌右下角掛「🎮 線上玩」
      g.beginPath(); g.roundRect(352, 156, 140, 34, 17); g.fillStyle = '#e8762b'; g.fill();
      g.fillStyle = '#fff'; g.font = `900 24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🎮 線上玩', 422, 174);
      g.fillStyle = '#2a1d12'; g.textAlign = 'left';
    }
    if (lines.length === 1) { fit(lines[0], 54); g.fillText(lines[0], x, 104); }
    else { const s = Math.min(fit(lines[0], 42), fit(lines[1], 42)); g.font = `900 ${s}px ${FONT}`; g.fillText(lines[0], x, 74); g.fillText(lines[1], x, 132); }
    tex.needsUpdate = true;
  };
  paint();
  if (document.fonts) { document.fonts.load(`900 40px ${FONT}`, st.name).then(paint).catch(() => {}); document.fonts.ready.then(paint); }
  return tex;
}

// 共用的形狀與材質
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(.5, .5, 1, 8),
  sph: new THREE.SphereGeometry(.5, 10, 8),
  torus: new THREE.TorusGeometry(.5, .14, 6, 14),
  cone: new THREE.ConeGeometry(.5, 1, 8),
};
const M = {};
const mat = (c) => (M[c] || (M[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .85 })));

// 各攤專屬道具（攤子本地座標：+z 是正面、桌面高 top；x 超過 ±0.75 是攤子旁邊的地面）
const PROPS = {
  1(add, t) {   // 大狗堡：熱狗麵包＋番茄醬、芥末醬罐
    for (let i = 0; i < 3; i++) { const x = -.45 + i * .3; add(G.box, '#e0a25a', x, t + .05, .08, .24, .08, .1); add(G.cyl, '#b0452c', x, t + .1, .08, .05, .26, .05, 0, 0, Math.PI / 2); add(G.box, '#ffd23a', x, t + .125, .08, .2, .01, .02); }
    add(G.cyl, '#dc3a2a', .45, t + .11, -.1, .08, .22, .08); add(G.cyl, '#f2c230', .58, t + .11, -.1, .08, .22, .08);
  },
  2(add, t) {   // 美食小食堂：小鍋子＋幾碗飯菜
    add(G.cyl, '#9aa3ad', -.4, t + .1, -.05, .34, .2, .34); add(G.cyl, '#5a4636', -.4, t + .21, -.05, .36, .02, .36); add(G.sph, '#5a4636', -.4, t + .24, -.05, .06, .05, .06);
    for (let i = 0; i < 3; i++) { const x = .05 + i * .22; add(G.cyl, '#ffffff', x, t + .04, .12, .17, .08, .17); add(G.sph, ['#f3e3b5', '#c7703a', '#7cc576'][i], x, t + .09, .12, .14, .06, .14); }
  },
  3(add, t) {   // 蜜糖小屋：糖果罐＋棒棒糖
    for (let i = 0; i < 3; i++) { const x = -.45 + i * .2; add(G.cyl, '#dff3ff', x, t + .12, -.05, .16, .24, .16); add(G.sph, ['#ff7aa8', '#ffd23a', '#7cd3a8'][i], x, t + .08, -.05, .12, .1, .12); }
    for (let i = 0; i < 4; i++) { const x = .2 + i * .14; add(G.cyl, '#ffffff', x, t + .14, .1, .02, .28, .02); add(G.cyl, ['#ff5d8f', '#8a5cd0', '#2f7fd1', '#f08a3c'][i], x, t + .3, .1, .14, .03, .14, Math.PI / 2); }
  },
  4(add, t) {   // 自製飲料店／鯉魚麻糬屋：一大桶冬瓜茶＋杯子，蒸籠裡一顆顆麻糬
    add(G.cyl, '#c97a2a', -.42, t + .2, -.08, .32, .4, .32); add(G.cyl, '#d8e8ee', -.42, t + .42, -.08, .34, .04, .34); add(G.box, '#9aa3ad', -.42, t + .08, .1, .04, .04, .08);
    for (let i = 0; i < 3; i++) add(G.cyl, '#eaf6fb', -.1 + i * .1, t + .08, .12, .07, .16, .07);
    add(G.cyl, '#d6b07a', .4, t + .06, 0, .46, .12, .46);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; add(G.sph, '#fbf7f2', .4 + Math.cos(a) * .12, t + .14, Math.sin(a) * .12, .11, .08, .11); }
  },
  5(add, t) {   // 靚萱餅乾鋪：一盤盤餅乾＋手作材料盒
    for (let i = 0; i < 2; i++) { const x = -.45 + i * .3; add(G.cyl, '#ffffff', x, t + .02, .05, .26, .03, .26); for (let j = 0; j < 4; j++) add(G.cyl, j % 2 ? '#c98a4a' : '#e7b46e', x + (j % 2 - .5) * .1, t + .05 + (j > 1 ? .02 : 0), .05 + (j > 1 ? .06 : -.04), .1, .02, .1); }
    add(G.box, '#f6d6e6', .4, t + .07, -.02, .36, .14, .26); for (let i = 0; i < 3; i++) add(G.sph, ['#ff7aa8', '#7cc576', '#2f7fd1'][i], .3 + i * .1, t + .16, -.02, .06, .06, .06);
  },
  6(add, t) {   // 巧手工坊／自己畫貼紙：貼紙紙張＋一筒彩色筆
    for (let i = 0; i < 3; i++) { add(G.box, '#ffffff', -.45 + i * .26, t + .01, .08, .22, .015, .28, 0, (i - 1) * .2); add(G.sph, ['#ffd23a', '#ff7aa8', '#7cd3a8'][i], -.45 + i * .26, t + .025, .08, .1, .01, .1); }
    add(G.cyl, '#8a5cd0', .45, t + .1, -.1, .14, .2, .14); for (let i = 0; i < 5; i++) add(G.cyl, ['#dc4848', '#2f7fd1', '#3e9b4f', '#e3a33b', '#8a5cd0'][i], .41 + (i % 3) * .04, t + .24, -.12 + (i > 2 ? .05 : 0), .025, .18, .025);
  },
  7(add, t) {   // 吉樂工作室：作品展示架＋材料籃
    add(G.box, '#a8743f', -.35, t + .2, -.2, .6, .4, .1);
    for (let i = 0; i < 3; i++) add(G.sph, ['#ff7aa8', '#ffd23a', '#2f7fd1'][i], -.53 + i * .18, t + .3, -.12, .12, .12, .12);
    add(G.cyl, '#c9a06a', .4, t + .07, .05, .4, .14, .3); for (let i = 0; i < 4; i++) add(G.box, ['#dc4848', '#3e9b4f', '#e3a33b', '#8a5cd0'][i], .3 + i * .07, t + .16, .05, .05, .06, .12);
  },
  8(add, t) {   // 有吃有玩真好玩：點心袋＋遊戲骰子
    for (let i = 0; i < 3; i++) add(G.box, ['#ffd23a', '#ff9f43', '#7cd3a8'][i], -.45 + i * .17, t + .12, -.05, .13, .24, .07);
    add(G.box, '#ffffff', .25, t + .08, .08, .16, .16, .16, 0, .5); add(G.box, '#ffffff', .48, t + .08, .02, .16, .16, .16, 0, -.3);
    add(G.sph, '#dc4848', .25, t + .165, .08, .04, .01, .04);
  },
  9(add, t) {   // 正反接球王：旁邊立一個接球桶，桌上一籃球
    add(G.cyl, '#c9a06a', -.35, t + .07, 0, .4, .14, .3); for (let i = 0; i < 4; i++) add(G.sph, ['#dc4848', '#2f7fd1', '#ffd23a', '#3e9b4f'][i], -.47 + i * .08, t + .17, 0, .1, .1, .1);
    add(G.cyl, '#2f7fd1', 1.1, .3, .3, .45, .6, .45); add(G.cyl, '#1d5aa0', 1.1, .61, .3, .48, .04, .48);
  },
  10(add, t) {  // 圈圈洞洞：旁邊地上的套圈木樁＋桌上的戳洞洞箱
    for (let i = 0; i < 3; i++) add(G.cyl, '#a8743f', 1.0 + (i % 2) * .3, .2, .1 + i * .25 - .25, .05, .4, .05);
    add(G.torus, '#dc4848', .3, t + .03, .1, .22, .22, .22, Math.PI / 2); add(G.torus, '#ffd23a', .35, t + .07, .08, .2, .2, .2, Math.PI / 2);
    add(G.box, '#e3a33b', -.38, t + .2, -.1, .5, .4, .14); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(G.cyl, (r + c) % 3 ? '#fffaf0' : '#8a5cd0', -.56 + c * .12, t + .08 + r * .12, -.025, .08, .01, .08, Math.PI / 2);
  },
  11(add, t) {  // 彈珠迷宮：桌上一塊木頭迷宮板＋彈珠
    add(G.box, '#c48a4f', 0, t + .03, 0, 1.1, .05, .6);
    const walls = [[-.5, 0, .02, .56], [.5, 0, .02, .56], [0, -.28, 1.0, .02], [0, .28, 1.0, .02], [-.25, -.08, .02, .38], [0, .08, .02, .38], [.25, -.08, .02, .38]];
    for (const [x, z, sx, sz] of walls) add(G.box, '#7a4a22', x, t + .08, z, sx, .06, sz);
    add(G.sph, '#9fd3f5', -.4, t + .1, .2, .07, .07, .07); add(G.cyl, '#dc4848', .4, t + .06, -.2, .1, .01, .1);
  },
  12(add, t) {  // 鯉魚遊戲店：桌遊盒＋小鯉魚旗
    for (let i = 0; i < 3; i++) add(G.box, ['#2f7fd1', '#dc4848', '#3e9b4f'][i], -.35, t + .04 + i * .07, 0, .4 - i * .04, .06, .3 - i * .03, 0, i * .15);
    add(G.cyl, '#ffffff', .4, t + .3, -.15, .02, .6, .02); add(G.cone, '#f08a3c', .5, t + .5, -.15, .14, .24, .1, 0, 0, -Math.PI / 2);
    add(G.box, '#ffd23a', .35, t + .03, .12, .3, .04, .2);
  },
  13(add, t) {  // 鯉魚記憶王／搖出好耳力：翻牌＋一排豆子瓶
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) add(G.box, (r + c) % 2 ? '#2f7fd1' : '#ffffff', -.55 + c * .14, t + .01, .02 + r * .18, .11, .015, .15);
    for (let i = 0; i < 4; i++) { const x = .12 + i * .14; add(G.cyl, '#e8f4f8', x, t + .12, -.05, .1, .22, .1); add(G.sph, ['#a8323a', '#5aa04a', '#e3c13a', '#7a4a22'][i], x, t + .06, -.05, .08, .08, .08); }
  },
  14(add, t) {  // 娃！茶一點就中：旁邊地上的大茶杯目標＋桌上的小茶杯
    add(G.cyl, '#ffffff', 1.1, .22, .25, .5, .44, .5); add(G.cyl, '#7a4a22', 1.1, .43, .25, .44, .02, .44); add(G.torus, '#ffffff', 1.38, .24, .25, .16, .16, .16, 0, Math.PI / 2);
    for (let i = 0; i < 3; i++) { add(G.cyl, '#ffffff', -.35 + i * .22, t + .06, .05, .14, .12, .14); add(G.cyl, '#b9d98a', -.35 + i * .22, t + .115, .05, .12, .01, .12); }
  },
  15(add, t) { // 夏來寶／廢物市集：二手箱＋鑽石貼紙畫
    add(G.box, '#c48a4f', -.42, t + .14, 0, .45, .28, .32); add(G.box, '#3d5a80', -.42, t + .3, 0, .3, .06, .22);
    add(G.box, '#ffffff', .3, t + .22, -.15, .4, .4, .03, -.2); for (let i = 0; i < 9; i++) add(G.sph, ['#ff7aa8', '#9fd3f5', '#ffd23a'][i % 3], .18 + (i % 3) * .12, t + .14 + Math.floor(i / 3) * .1, -.12 + Math.floor(i / 3) * .02, .05, .05, .02);
    add(G.sph, '#b5703a', .5, t + .1, .15, .16, .18, .14);
  },
  16(add, t) {  // 聖誕 DIY：小聖誕樹＋吊飾
    add(G.cone, '#2f7a3a', -.35, t + .3, -.05, .4, .55, .4); add(G.cone, '#3e9b4f', -.35, t + .48, -.05, .3, .35, .3); add(G.cone, '#ffd23a', -.35, t + .7, -.05, .08, .1, .08);
    for (let i = 0; i < 4; i++) add(G.sph, ['#dc4848', '#ffd23a', '#2f7fd1', '#ffffff'][i], -.35 + Math.cos(i * 1.6) * .14, t + .25 + i * .06, -.05 + Math.sin(i * 1.6) * .14, .06, .06, .06);
    for (let i = 0; i < 3; i++) add(G.cone, '#fffaf0', .2 + i * .17, t + .06, .1, .12, .1, .03, Math.PI / 2);
  },
  17(add, t) {  // 名不虛傳 GG 手：手部挑戰道具（疊杯）
    for (let r = 0; r < 3; r++) for (let c = 0; c <= 2 - r; c++) add(G.cyl, ['#dc4848', '#2f7fd1', '#ffd23a'][r], -.3 + c * .17 + r * .085, t + .07 + r * .14, 0, .14, .14, .14);
    add(G.sph, '#f3c9a0', .4, t + .07, .1, .2, .1, .14);
  },
  18(add, t) {  // 丟球者：旁邊立一塊九個洞的目標板＋桌上一籃球
    add(G.box, '#e3a33b', 1.15, .6, 0, .1, .9, .9, 0, 0, 0);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) add(G.cyl, '#5a3a1a', 1.1, .35 + r * .26, -.26 + c * .26, .14, .02, .14, 0, 0, Math.PI / 2);
    add(G.cyl, '#c9a06a', -.35, t + .07, 0, .4, .14, .3); for (let i = 0; i < 4; i++) add(G.sph, ['#dc4848', '#2f7fd1', '#ffd23a', '#ffffff'][i], -.47 + i * .08, t + .17, 0, .1, .1, .1);
  },
  19(add, t) {  // 三二一發射！戰鬥陀螺：旁邊地上的圓形擂台，裡面兩顆陀螺；桌上放發射器
    add(G.cyl, '#3d5a80', 1.15, .12, .1, .9, .24, .9); add(G.cyl, '#9fd3f5', 1.15, .2, .1, .78, .12, .78); add(G.cyl, '#2f7fd1', 1.15, .27, .1, .82, .02, .82);
    for (const [dx, c] of [[-.15, '#dc4848'], [.15, '#ffd23a']]) { const x = 1.15 + dx; add(G.cyl, c, x, .3, .1, .18, .05, .18); add(G.cone, '#c0c6cc', x, .25, .1, .1, .08, .1, Math.PI); add(G.cyl, '#ffffff', x, .34, .1, .06, .04, .06); }
    for (let i = 0; i < 2; i++) { add(G.box, ['#2f7fd1', '#8a5cd0'][i], -.35 + i * .3, t + .05, .05, .22, .08, .1); add(G.box, '#ffffff', -.35 + i * .3, t + .05, -.07, .03, .02, .22); }
  },
  20(add, t) {  // 女童軍：一袋袋爆米花
    for (let i = 0; i < 4; i++) { const x = -.45 + i * .3; add(G.box, i % 2 ? '#8a5cd0' : '#ffffff', x, t + .13, 0, .16, .26, .12); add(G.sph, '#fff3c4', x, t + .3, 0, .18, .1, .14); }
  },
};

// 價目小立牌「1 鯉魚幣」（共用一張貼圖）
let priceTex = null;
function priceTexture() {
  if (priceTex) return priceTex;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  priceTex = new THREE.CanvasTexture(cv); priceTex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => { const g = cv.getContext('2d'); g.fillStyle = '#ffe58a'; g.beginPath(); g.roundRect(4, 4, 248, 120, 20); g.fill(); g.lineWidth = 8; g.strokeStyle = '#b8860b'; g.stroke();
    g.fillStyle = '#5a3a0a'; g.font = `900 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1 鯉魚幣', 128, 68); priceTex.needsUpdate = true; };
  paint(); if (document.fonts) document.fonts.ready.then(paint);
  return priceTex;
}

// 攤子旁邊地上的大型主題擺設（x 負的那一側；+x 那一側有些攤已經擺了遊戲道具）
const SIDE = -1.08;
const EXTRA = {
  1(add) {   // 大狗堡：立在旁邊的大熱狗招牌
    add(G.cyl, '#7a4a22', SIDE, .5, 0, .06, 1, .06); add(G.box, '#e0a25a', SIDE, 1.05, 0, .62, .2, .22); add(G.cyl, '#b0452c', SIDE, 1.15, 0, .13, .74, .13, 0, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) add(G.box, '#ffd23a', SIDE - .24 + i * .12, 1.23, .0, .06, .02, .14, 0, .6);
    add(G.cyl, '#5a5f66', SIDE, .2, .45, .32, .4, .32); add(G.box, '#2a2a2a', SIDE, .41, .45, .38, .02, .38);   // 小烤爐
    for (let i = 0; i < 3; i++) add(G.cyl, '#b0452c', SIDE - .1 + i * .1, .44, .45, .04, .22, .04, Math.PI / 2);
  },
  2(add) {   // 美食小食堂：小爐子＋冒煙的湯鍋、手寫菜單立牌
    add(G.box, '#5a5f66', SIDE, .25, .1, .5, .5, .4); add(G.cyl, '#9aa3ad', SIDE, .62, .1, .36, .26, .36); add(G.cyl, '#ff7a2a', SIDE, .5, .31, .2, .04, .04, Math.PI / 2);
    for (let i = 0; i < 3; i++) add(G.sph, '#f4f6f8', SIDE + (i - 1) * .08, .85 + i * .12, .1, .14, .12, .14);
    add(G.box, '#2f3a2f', SIDE, .45, .55, .42, .55, .04, -.25); add(G.box, '#ffffff', SIDE, .55, .57, .3, .03, .01, -.25); add(G.box, '#ffffff', SIDE, .45, .58, .26, .03, .01, -.25); add(G.box, '#ffffff', SIDE, .35, .59, .3, .03, .01, -.25);
  },
  3(add) {   // 蜜糖小屋：超大棒棒糖＋糖果桶
    add(G.cyl, '#ffffff', SIDE, .7, 0, .05, 1.4, .05);
    for (let i = 0; i < 4; i++) add(G.cyl, ['#ff5d8f', '#ffffff', '#ffd23a', '#8a5cd0'][i], SIDE, 1.42, 0, .62 - i * .14, .06, .62 - i * .14, Math.PI / 2);
    add(G.cyl, '#f6d6e6', SIDE + .1, .22, .5, .4, .44, .4); for (let i = 0; i < 6; i++) add(G.sph, ['#ff5d8f', '#ffd23a', '#7cd3a8', '#2f7fd1', '#f08a3c', '#8a5cd0'][i], SIDE + .1 + Math.cos(i) * .1, .46, .5 + Math.sin(i) * .1, .1, .08, .1);
  },
  4(add) {   // 鯉魚麻糬屋：木臼＋木槌（現場打麻糬），旁邊一桶冬瓜茶
    add(G.cyl, '#a8743f', SIDE, .22, .2, .6, .44, .6); add(G.cyl, '#fbf7f2', SIDE, .45, .2, .44, .04, .44);
    add(G.cyl, '#c48a4f', SIDE + .1, .75, .2, .05, .7, .05, 0, 0, .5); add(G.cyl, '#a8743f', SIDE + .27, 1.05, .2, .16, .34, .16, 0, 0, .5 + Math.PI / 2);
    add(G.cyl, '#8b5a2b', SIDE, .3, -.45, .4, .6, .4); add(G.cyl, '#c97a2a', SIDE, .61, -.45, .36, .03, .36);
  },
  5(add) {   // 餅乾鋪：大餅乾招牌＋一籃手作材料
    add(G.cyl, '#7a4a22', SIDE, .45, 0, .05, .9, .05); add(G.cyl, '#e7b46e', SIDE, 1.05, 0, .62, .08, .62, Math.PI / 2);
    for (let i = 0; i < 5; i++) add(G.sph, '#6b3d1e', SIDE + Math.cos(i * 1.3) * .17, 1.05 + Math.sin(i * 1.3) * .17, .05, .07, .07, .04);
    add(G.cyl, '#c9a06a', SIDE + .05, .14, .5, .5, .28, .36); for (let i = 0; i < 5; i++) add(G.box, ['#ff7aa8', '#ffd23a', '#7cd3a8', '#2f7fd1', '#f08a3c'][i], SIDE - .12 + i * .06, .32, .5, .05, .1, .2);
  },
  6(add) {   // 自己畫貼紙：畫架上一張貼紙作品
    for (const s of [-1, 1]) add(G.cyl, '#7a4a22', SIDE + s * .22, .6, .05, .04, 1.2, .04, -.15, 0, s * -.15); add(G.cyl, '#7a4a22', SIDE, .55, -.15, .04, 1.1, .04, .35);
    add(G.box, '#ffffff', SIDE, .95, .12, .62, .5, .03, -.15);
    for (let i = 0; i < 6; i++) add(G.cyl, ['#ff5d8f', '#ffd23a', '#2f7fd1', '#7cd3a8', '#8a5cd0', '#f08a3c'][i], SIDE - .2 + (i % 3) * .2, .85 + Math.floor(i / 3) * .2, .15, .12, .01, .12, Math.PI / 2 - .15);
  },
  7(add) {   // 吉樂工作室：洞洞板展示架，掛滿手作小物
    for (const s of [-1, 1]) add(G.cyl, '#7a4a22', SIDE + s * .3, .6, 0, .04, 1.2, .04);
    add(G.box, '#e8d5b0', SIDE, .85, 0, .62, .6, .04);
    for (let i = 0; i < 6; i++) { const x = SIDE - .2 + (i % 3) * .2, y = .7 + Math.floor(i / 3) * .28; add(G.cyl, '#5a3a1a', x, y + .08, .03, .01, .06, .01); add(i % 2 ? G.sph : G.box, ['#ff7aa8', '#2f7fd1', '#ffd23a', '#3e9b4f', '#8a5cd0', '#f08a3c'][i], x, y, .05, .11, .11, .05); }
  },
  8(add) {   // 有吃有玩真好玩：彩色轉盤遊戲
    add(G.cyl, '#7a4a22', SIDE, .45, 0, .05, .9, .05);
    for (let i = 0; i < 6; i++) add(G.cyl, ['#dc4848', '#ffd23a', '#2f7fd1', '#3e9b4f', '#8a5cd0', '#f08a3c'][i], SIDE + Math.cos(i / 6 * TAU) * .14, 1.0 + Math.sin(i / 6 * TAU) * .14, .04, .2, .03, .2, Math.PI / 2);
    add(G.cyl, '#ffffff', SIDE, 1.0, .07, .08, .03, .08, Math.PI / 2); add(G.cone, '#2a2a2a', SIDE, 1.27, .06, .06, .1, .04, Math.PI);
    for (let i = 0; i < 3; i++) add(G.box, ['#ffd23a', '#ff9f43', '#7cd3a8'][i], SIDE - .15 + i * .15, .15, .5, .12, .3, .08);
  },
  9(add) {   // 正反接球王：一堆彩色球
    for (let i = 0; i < 9; i++) add(G.sph, ['#dc4848', '#2f7fd1', '#ffd23a', '#3e9b4f'][i % 4], SIDE + Math.cos(i * 2.4) * (.08 + i * .025), .1 + (i > 5 ? .15 : 0), .1 + Math.sin(i * 2.4) * (.08 + i * .025), .2, .2, .2);
    add(G.box, '#ffffff', SIDE, .02, .65, .8, .02, .06);   // 站位線
  },
  10(add) {  // 好開心抽抽樂：獎品架，一格格小禮物
    add(G.box, '#a8743f', SIDE, .5, -.05, .62, 1, .3);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { add(G.box, ['#dc4848', '#2f7fd1', '#ffd23a', '#8a5cd0', '#3e9b4f'][(r * 3 + c) % 5], SIDE - .2 + c * .2, .22 + r * .3, .12, .14, .14, .14); add(G.box, '#ffffff', SIDE - .2 + c * .2, .22 + r * .3, .195, .02, .14, .01); }
  },
  11(add) {  // 彈珠迷宮：彈珠罐＋小獎盃
    add(G.cyl, '#dff3ff', SIDE, .25, .1, .36, .5, .36); for (let i = 0; i < 8; i++) add(G.sph, ['#9fd3f5', '#ff7aa8', '#ffd23a', '#7cd3a8'][i % 4], SIDE + Math.cos(i * 2) * .09, .08 + Math.floor(i / 3) * .1, .1 + Math.sin(i * 2) * .09, .11, .11, .11);
    add(G.box, '#7a4a22', SIDE, .4, .55, .3, .8, .3); add(G.cyl, '#f2c230', SIDE, .9, .55, .16, .2, .16); add(G.sph, '#f2c230', SIDE, 1.05, .55, .26, .18, .26);
  },
  12(add) {  // 鯉魚遊戲店：疊高的桌遊盒＋鯉魚旗
    for (let i = 0; i < 5; i++) add(G.box, ['#2f7fd1', '#dc4848', '#3e9b4f', '#ffd23a', '#8a5cd0'][i], SIDE, .08 + i * .15, 0, .5 - i * .03, .14, .36 - i * .02, 0, i * .25);
    add(G.cyl, '#ffffff', SIDE + .2, .9, .5, .03, 1.8, .03);
    for (let i = 0; i < 2; i++) { add(G.cone, ['#f08a3c', '#dc4848'][i], SIDE + .45, 1.65 - i * .35, .5, .18, .44, .14, 0, 0, -Math.PI / 2); add(G.sph, '#ffffff', SIDE + .32, 1.67 - i * .35, .56, .05, .05, .02); }
  },
  13(add) {  // 鯉魚記憶王：大型翻牌牆
    for (const s of [-1, 1]) add(G.cyl, '#7a4a22', SIDE + s * .32, .55, 0, .04, 1.1, .04);
    add(G.box, '#2f7fd1', SIDE, .85, 0, .68, .6, .04);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(G.box, (r * 4 + c) % 3 ? '#ffffff' : ['#ffd23a', '#ff7aa8', '#7cd3a8'][(r + c) % 3], SIDE - .24 + c * .16, .67 + r * .18, .03, .12, .14, .01);
  },
  14(add) {  // 娃！茶一點就中：一籃沙包＋茶壺
    add(G.cyl, '#c9a06a', SIDE, .12, .2, .5, .24, .4); for (let i = 0; i < 5; i++) add(G.box, ['#dc4848', '#3e9b4f', '#ffd23a', '#2f7fd1', '#f08a3c'][i], SIDE - .12 + i * .06, .28, .2 + (i % 2) * .05, .1, .06, .1, 0, i);
    add(G.sph, '#ffffff', SIDE, .35, -.4, .4, .34, .4); add(G.cyl, '#ffffff', SIDE + .25, .38, -.4, .04, .22, .04, 0, 0, -.8); add(G.sph, '#b9d98a', SIDE, .53, -.4, .1, .06, .1);
  },
  15(add) {  // 夏來寶／廢物市集：二手衣架＋鑽石貼紙畫畫架
    add(G.cyl, '#5a5f66', SIDE - .3, .6, 0, .03, 1.2, .03); add(G.cyl, '#5a5f66', SIDE + .3, .6, 0, .03, 1.2, .03); add(G.cyl, '#5a5f66', SIDE, 1.18, 0, .03, .64, .03, 0, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) add(G.box, ['#2f7fd1', '#dc4848', '#ffd23a', '#3e9b4f'][i], SIDE - .2 + i * .13, .9, 0, .12, .44, .2, 0, Math.PI / 2 - .3);
    add(G.box, '#c48a4f', SIDE, .15, .55, .5, .3, .3); for (let i = 0; i < 3; i++) add(G.box, ['#8a5cd0', '#f08a3c', '#7cd3a8'][i], SIDE - .14 + i * .14, .36, .55, .1, .14, .22);
  },
  16(add) {  // 聖誕 DIY：大聖誕樹＋禮物盒
    add(G.cyl, '#7a4a22', SIDE, .12, 0, .1, .24, .1);
    add(G.cone, '#2f7a3a', SIDE, .55, 0, .8, .7, .8); add(G.cone, '#3e9b4f', SIDE, .95, 0, .6, .6, .6); add(G.cone, '#4fb35a', SIDE, 1.3, 0, .4, .5, .4); add(G.cone, '#ffd23a', SIDE, 1.62, 0, .12, .16, .12);
    for (let i = 0; i < 8; i++) add(G.sph, ['#dc4848', '#ffd23a', '#2f7fd1', '#ffffff'][i % 4], SIDE + Math.cos(i * 2.2) * (.32 - i * .025), .5 + i * .1, Math.sin(i * 2.2) * (.32 - i * .025), .08, .08, .08);
    add(G.box, '#dc4848', SIDE + .35, .1, .45, .22, .2, .22); add(G.box, '#ffd23a', SIDE + .35, .21, .45, .04, .02, .23); add(G.box, '#2f7fd1', SIDE - .05, .08, .55, .18, .16, .18);
  },
  17(add) {  // 名不虛傳 GG 手：高高的疊杯塔
    add(G.box, '#a8743f', SIDE, .3, 0, .6, .6, .5);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4 - r; c++) add(G.cyl, ['#dc4848', '#2f7fd1', '#ffd23a', '#3e9b4f'][r], SIDE - .2 + c * .13 + r * .065, .67 + r * .13, 0, .12, .12, .12);
    add(G.cyl, '#ffffff', SIDE + .1, .1, .55, .2, .2, .2); add(G.cyl, '#dc4848', SIDE + .1, .21, .55, .08, .02, .08);   // 計時器
  },
  18(add) {  // 丟球者：地上一大籃球
    add(G.cyl, '#c9a06a', SIDE, .2, .1, .62, .4, .62); for (let i = 0; i < 7; i++) add(G.sph, ['#dc4848', '#2f7fd1', '#ffd23a', '#ffffff'][i % 4], SIDE + Math.cos(i) * .14, .42 + (i > 3 ? .08 : 0), .1 + Math.sin(i) * .14, .18, .18, .18);
  },
  19(add) {  // 戰鬥陀螺：「3・2・1」倒數牌＋發射器架
    add(G.cyl, '#7a4a22', SIDE, .5, 0, .05, 1, .05);
    for (let i = 0; i < 3; i++) add(G.cyl, ['#3e9b4f', '#ffd23a', '#dc4848'][i], SIDE - .2 + i * .2, 1.08, .03, .17, .03, .17, Math.PI / 2);
    add(G.box, '#3d5a80', SIDE, .25, .5, .5, .5, .2);
    for (let i = 0; i < 3; i++) { add(G.box, ['#2f7fd1', '#8a5cd0', '#dc4848'][i], SIDE - .15 + i * .15, .55, .5, .1, .1, .06); add(G.box, '#ffffff', SIDE - .15 + i * .15, .62, .5, .02, .06, .12); }
  },
  20(add) {  // 女童軍：爆米花機
    add(G.box, '#dc4848', SIDE, .3, 0, .5, .6, .4); for (const s of [-1, 1]) add(G.cyl, '#2a2a2a', SIDE + s * .2, .08, .22, .08, .02, .08, Math.PI / 2);
    add(G.box, '#dff3ff', SIDE, .85, 0, .48, .5, .38); add(G.box, '#fff3c4', SIDE, .72, 0, .44, .2, .34);
    for (let i = 0; i < 6; i++) add(G.sph, '#fff8dc', SIDE + Math.cos(i) * .14, .85 + (i % 2) * .06, Math.sin(i) * .1, .08, .08, .08);
    add(G.box, '#dc4848', SIDE, 1.15, 0, .52, .1, .42);
  },
};

// 每座攤子都有的布置：前緣三角彩旗、兩顆燈籠、價目小立牌
function decorate(add, g, st, I0, W, D, TH) {
  const cols = ['#dc4848', '#ffd23a', '#2f7fd1', '#3e9b4f', '#8a5cd0', '#f08a3c'];
  for (let i = 0; i < 9; i++) { const x = -W / 2 + .1 + i * (W - .2) / 8, y = 1.36 - Math.sin(i / 8 * Math.PI) * .08; add(G.cone, cols[i % cols.length], x, y, D / 2 + .02, .1, .14, .02, Math.PI); }
  for (const s of [-1, 1]) { add(G.cyl, '#2a2a2a', s * (W / 2 - .04), 1.42, D / 2 + .02, .01, .12, .01); add(G.sph, '#ff6a3d', s * (W / 2 - .04), 1.28, D / 2 + .02, .16, .2, .16); add(G.cyl, '#2a2a2a', s * (W / 2 - .04), 1.18, D / 2 + .02, .08, .02, .08); }
  if (st.no !== 20) {
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(.32, .16), new THREE.MeshStandardMaterial({ map: priceTexture(), roughness: .8 }));
    tag.position.set(W / 2 - .2, TH + .14, D / 2 - .05); tag.rotation.x = -.3; g.add(tag);
    add(G.box, '#7a4a22', W / 2 - .2, TH + .05, D / 2 - .1, .02, .1, .02);
  }
}

function makeBooth(st, I0, people) {
  const g = new THREE.Group();
  let into = g;   // 道具放進哪一個群組
  const add = (geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, parent = into) => { const o = new THREE.Mesh(geo, mat(c)); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const W = 1.5, D = .8, TH = .55;
  // 桌子：木頭桌面＋島色桌布（垂到地面）
  add(G.box, '#a8743f', 0, TH, 0, W, .06, D);
  add(G.box, I0.color, 0, TH / 2, D / 2 - .01, W - .04, TH - .04, .02);
  add(G.box, '#f6efe0', 0, TH / 2, D / 2 + .005, W * .6, .08, .01);
  // 四根柱子
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(G.cyl, '#7a4a22', sx * (W / 2 - .04), .78, sz * (D / 2 - .04), .06, 1.56, .06);
  // 條紋遮雨棚：島色和白色交錯，前低後高
  const N = 6;
  for (let i = 0; i < N; i++) add(G.box, i % 2 ? '#fffaf0' : I0.color, -W / 2 + (i + .5) * W / N, 1.62, 0, W / N + .005, .05, D + .3, -.22);
  // 遮雨棚前緣的小波浪
  for (let i = 0; i < N; i++) add(G.cone, i % 2 ? '#fffaf0' : I0.color, -W / 2 + (i + .5) * W / N, 1.5, D / 2 + .16, .25, .14, .06, Math.PI);
  // 依攤位內容擺專屬道具；沒有專屬設計的攤位用類型的通用道具
  const top = TH + .03, type = st.type || 'food';
  // 道具放大一點，遠看也認得出是什麼（以桌面為基準放大）
  const pg = new THREE.Group(), PS = 1.25; pg.scale.setScalar(PS); pg.position.y = top - top * PS; g.add(pg); into = pg;
  if (PROPS[st.no]) PROPS[st.no](add, top);
  else if (type === 'food') {
    add(G.cyl, '#ffffff', -.45, top + .02, .05, .3, .03, .3); add(G.sph, '#d9a35b', -.45, top + .08, .05, .22, .12, .22);
    add(G.cyl, '#ffffff', 0, top + .02, .1, .3, .03, .3); add(G.sph, '#f3d27a', -.05, top + .07, .1, .12, .1, .12); add(G.sph, '#e98aa8', .06, top + .07, .08, .12, .1, .12);
    for (let i = 0; i < 3; i++) add(G.cyl, ['#f08a3c', '#9fd3f5', '#7cc576'][i], .38 + i * .13, top + .1, -.05, .09, .2, .09);
  } else if (type === 'craft') {
    add(G.box, '#ffffff', -.4, top + .01, .05, .4, .02, .3, 0, .2); add(G.box, '#ffd36b', -.4, top + .025, .05, .2, .01, .14, 0, .2);
    for (let i = 0; i < 4; i++) add(G.cyl, ['#dc4848', '#2f7fd1', '#3e9b4f', '#e3a33b'][i], .05 + i * .1, top + .08, -.12, .05, .16, .05);
    add(G.box, '#8a5cd0', .45, top + .06, .08, .26, .12, .2); add(G.box, '#f2f2f2', .45, top + .13, .08, .27, .02, .21);
  } else if (type === 'secondhand') {
    add(G.box, '#c48a4f', -.42, top + .14, 0, .45, .28, .32); add(G.box, '#3d5a80', -.42, top + .3, 0, .3, .06, .22);
    for (let i = 0; i < 3; i++) add(G.box, ['#dc4848', '#3e9b4f', '#e3a33b'][i], .1 + i * .07, top + .11, -.05, .05, .22, .18);
    add(G.sph, '#b5703a', .48, top + .1, .08, .18, .2, .16); add(G.sph, '#b5703a', .48, top + .23, .08, .13, .12, .12);
  } else {   // game
    for (let i = 0; i < 3; i++) add(G.sph, ['#dc4848', '#2f7fd1', '#ffd36b'][i], -.45 + i * .16, top + .07, .08, .13, .13, .13);
    add(G.torus, '#8a5cd0', .15, top + .03, .05, .26, .26, .26, Math.PI / 2); add(G.torus, '#f08a3c', .2, top + .07, .02, .24, .24, .24, Math.PI / 2);
    add(G.box, '#ffffff', .52, top + .18, -.15, .3, .36, .04); add(G.cyl, '#dc4848', .52, top + .24, -.125, .14, .02, .14, Math.PI / 2);
  }
  into = g;
  decorate(add, g, st, I0, W, D, TH);
  if (EXTRA[st.no]) EXTRA[st.no](add);
  // 顧攤的攤主：站在桌子後面面向客人；合併攤和部分攤位有兩位
  const keepers = [];
  if (people) {
    const n = people.count(st), xs = n === 2 ? [-.38, .38] : [0];
    xs.forEach((x, i) => {
      const P = people.make(st.no * 7 + i, I0.color);
      P.g.position.set(x, 0, -D / 2 - .24); g.add(P.g);
      keepers.push({ P, ph: st.no * 1.7 + i * 2.3 });
    });
  }
  // 招牌：掛在遮雨棚上方，前後兩面
  const tex = drawBoard(st, I0.color, I0.dark), BW = 1.5, BH = BW * 200 / 512;
  const sign = new THREE.Group(); sign.position.set(0, 1.62 + .1 + BH / 2, .02); g.add(sign);
  const back = add(G.box, '#7a4a22', 0, 0, 0, BW + .06, BH + .06, .05, 0, 0, 0, sign);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .28, roughness: .85 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), faceMat); face.position.z = .03; sign.add(face);
  const face2 = face.clone(); face2.position.z = -.03; face2.rotation.y = Math.PI; sign.add(face2);
  // 點擊用的透明大盒子（整座攤子）
  const hit = new THREE.Mesh(new THREE.BoxGeometry(W + .2, 2.4, D + .4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.2; g.add(hit);
  // 桌子、遮雨棚、道具、彩旗這些不會動的零件合併成少數幾個網格（每攤原本約 80 個 → 十幾個）
  batchStatic(g, [hit, sign, ...keepers.map((k) => k.P.g)]);
  return { g, hit, face, back, keepers };
}

export function createSigns(W, content, H, opts = {}) {
  // 攤主：用和島民一樣的 Q 版小人；手機或低畫質時每攤只放一位
  const people = opts.makePerson ? {
    count: (st) => (opts.low ? 1 : (String(st.name).includes('／') || st.no % 3 === 0 ? 2 : 1)),
    make: (seed, shirt) => { const P = opts.makePerson(opts.rng(1000 + seed), false, { shirt }); P.g.remove(P.hit); return P; },
  } : null;
  const keepers = [];
  const { scene, islands } = W;
  const signs = [], pickables = [];
  for (const I0 of content.islands) {
    const I = islands[I0.id]; if (!I || !I.walk) continue;
    const stalls = content.stalls.filter((s) => s.island === I0.id).sort((a, b) => a.no - b.no);
    if (!stalls.length) continue;
    // 不擋橋頭（朝中央島的方向）和鯉魚號碼頭
    const toC = Math.atan2(-I.pos.z, -I.pos.x);
    const avoid = [[toC, .55]];
    if (W.pier && W.pier.berth && I0.id === 'puzzle') { const b = W.pier.berth.pos; avoid.push([Math.atan2(b.z - I.pos.z, b.x - I.pos.x), .45]); }
    const near = (th) => avoid.some(([a, w]) => { let d = th - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d) < w; });
    // 候選位置：石板小路外側的草地，四周空間要夠放一座攤子；空間不夠時逐步放寬
    // 每個角度試幾個不同的距離（離小路近一點或遠一點），挑空間最大的
    let cand = [];
    for (const need of [.9, .75, .6, .48, .38, .3]) {
      cand = [];
      for (let k = 0; k < 180; k++) {
        const th = toC + .55 + k / 180 * (TAU - 1.1);   // 從橋頭右邊開始繞一圈，攤號照順序排
        if (near(th)) continue;
        let best = null;
        // 一律放在步道外側，正面朝向步道
        for (const off of [1.15, .95, 1.35, .8]) {
          const r = Math.min(I.walk.radAt(th) + off, I.top(th) * .88);
          const x = Math.cos(th) * r, z = Math.sin(th) * r, cl = I.walk.clear(x, z);
          if (cl >= need && (!best || cl > best.cl)) best = { th, x, z, cl };
        }
        if (best) cand.push(best);
      }
      // 候選位置要夠多、而且分布得夠開，才不會擠在同一邊
      const spread = cand.length ? cand[cand.length - 1].th - cand[0].th : 0;
      if (cand.length >= stalls.length * 5 && spread > Math.PI) break;
    }
    if (!cand.length) continue;
    // 依角度平均分配，並且攤子之間至少隔一段距離（不會擠成一堆）
    const th0 = cand[0].th, th1 = cand[cand.length - 1].th, chosen = [];
    const pickFor = (target, gap) => {
      let best = null, bd = Infinity;
      for (const c of cand) {
        if (chosen.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < gap)) continue;
        const d = Math.abs(c.th - target); if (d < bd) { bd = d; best = c; }
      }
      return best;
    };
    stalls.forEach((st, k) => {
      const target = th0 + (k + .5) / stalls.length * (th1 - th0);
      const c = pickFor(target, 2.6) || pickFor(target, 2.0) || pickFor(target, 1.4) || cand[Math.floor((k + .5) * cand.length / stalls.length)];
      chosen.push(c);
      const B = makeBooth(st, I0, people); keepers.push(...B.keepers);
      B.g.position.set(I.pos.x + c.x, H, I.pos.z + c.z);
      B.g.rotation.y = Math.atan2(-c.x, -c.z);          // 攤子正面朝向步道
      if (c.cl < .55) B.g.scale.setScalar(.85);          // 空間比較擠的位置，攤子小一號
      scene.add(B.g);
      B.g.userData.island = I0.id;
      const s = { g: B.g, st, island: I0.id };
      signs.push(s); for (const o of [B.hit, B.face, B.back]) pickables.push({ obj: o, sign: s });
    });
  }
  // 樹擋到攤子招牌就移開：搬到島上離所有攤子和步道都遠一點的草地；找不到位置就收起來
  for (const I0 of content.islands) {
    const I = islands[I0.id]; if (!I || !I.trees) continue;
    const booths = signs.filter((s) => s.island === I0.id).map((s) => s.g.position);
    const far = (x, z, d) => booths.every((b) => Math.hypot(b.x - x, b.z - z) > d);
    for (const tr of I.trees) {
      const wx = I.pos.x + tr.position.x, wz = I.pos.z + tr.position.z;
      if (far(wx, wz, 3.6)) continue;           // 樹冠半徑約 1.3，加上招牌寬度，3.6 以內都可能擋到
      let spot = null;
      // 依序放寬條件：先找島緣的空地，再試步道內側的空地
      for (const [need, gap] of [[.7, 4.0], [.5, 3.8], [.4, 3.6]]) {
        for (let k = 0; k < 96 && !spot; k++) {
          const th = (k * 37 % 96) / 96 * TAU;
          if ([...(I.bridgeAngles || []), ...(I.entryAngles || [])].some((b) => Math.abs(Math.atan2(Math.sin(th - b), Math.cos(th - b))) < .45)) continue;
          for (const r of [I.top(th) * .86, I.top(th) * .78, I.walk.radAt(th) + 1.6, I.walk.radAt(th) - 1.0, I.walk.radAt(th) - 1.6]) {
            if (r < 1.2) continue;
            const x = Math.cos(th) * r, z = Math.sin(th) * r;
            if (!far(I.pos.x + x, I.pos.z + z, gap) || I.walk.clear(x, z) < need) continue;
            if (I.trees.some((o) => o !== tr && o.visible && Math.hypot(o.position.x - x, o.position.z - z) < 1.8)) continue;
            spot = { x, z }; break;
          }
        }
        if (spot) break;
      }
      if (spot) tr.position.set(spot.x, tr.position.y, spot.z); else tr.visible = false;
    }
  }
  // 攤主的小動作：左右看看、偶爾揮手招呼客人
  function update(t, moving) {
    if (!moving) return;
    for (const k of keepers) {
      const P = k.P, s = t + k.ph;
      P.head.rotation.y = Math.sin(s * .7) * .45;
      const wave = (s % 9) < 1.6;
      P.arms[1].rotation.z = wave ? 2.5 + Math.sin(s * 10) * .35 : .1;
      P.arms[0].rotation.z = -.1;
    }
  }
  return { signs, pickables, update };
}
