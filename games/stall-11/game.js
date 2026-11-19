// 第 11 攤・彈珠迷宮：傾斜木板讓彈珠滾到終點；掉進洞就回起點。手機可以直接傾斜，也可以按方向鍵
import { LIYU } from '../_kit/kit.js?v=20261119f';
const { ctx, W, H } = LIYU;

const CONFIG = {
  no: 11, title: '彈珠迷宮', stall: '彈珠迷宮',
  how: ['傾斜手機，或按住下方的方向鍵（電腦用鍵盤方向鍵）', '讓彈珠從綠旗滾到紅色終點', '黑色的是洞，掉進去會回到起點，貼著另一邊牆走就不會掉', '一共 3 關，越後面洞越多'],
  clear: '讓彈珠抵達終點（第 1 關，和現場一樣）',
  // 迷宮圖：# 牆、. 路、S 起點、G 終點、O 洞（洞偏在格子右下角，貼著左上走就安全）
  // 學生可以用方格紙畫好再照著改這裡（10 格寬 × 12 格高）
  levels: [
    ['##########', '#S.......#', '#.######.#', '#.#.O..#.#', '#.#.##.#.#', '#...#..#.#', '#####.##.#', '#.....#..#', '#.###.#.##', '#...#....#', '#.#.####G#', '##########'],
    ['##########', '#S...#...#', '###.##.#.#', '#...O..#.#', '#.#####..#', '#.....#.##', '####.O#..#', '#....#.#.#', '#.####.#.#', '#..O.....#', '#.#####.G#', '##########'],
    ['##########', '#S.O.....#', '#.####.#.#', '#...O#.#.#', '###.##.#.#', '#...#..#.#', '#.###.##.#', '#.O.#..O.#', '#.#.###.##', '#.#...#..#', '#...#.O.G#', '##########'],
  ],
  credit: '第 11 攤 彈珠迷宮',
};
const CS = 36, OX = 20, OY = 50, BR = 10, HOLE_OFF = 9, HOLE_R = 13;
let lv, maze, ball, falls, time, tilt = null, keys = {}, pad = null, win;
const cell = (c, r) => (maze[r] || '')[c] || '#';
function load(i) {
  lv = i; maze = CONFIG.levels[i];
  for (let r = 0; r < maze.length; r++) for (let c = 0; c < 10; c++) if (maze[r][c] === 'S') ball = { x: OX + c * CS + CS / 2, y: OY + r * CS + CS / 2, vx: 0, vy: 0, sx: OX + c * CS + CS / 2, sy: OY + r * CS + CS / 2, fall: 0 };
}
function start() {
  falls = 0; time = 0; win = 0; load(0);
  // iPhone 要先問「可以讀取動作感應嗎」，按「開始」的那一下才能問
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then((s) => { if (s === 'granted') listenTilt(); }).catch(() => {});
  else listenTilt();
}
let listening = false;
function listenTilt() { if (listening) return; listening = true; addEventListener('deviceorientation', (e) => { if (e.beta == null) return; tilt = { x: Math.max(-1, Math.min(1, (e.gamma || 0) / 25)), y: Math.max(-1, Math.min(1, ((e.beta || 0) - 20) / 25)) }; }); }
addEventListener('keydown', (e) => { keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.key] = false; });
// 畫布下方的方向鍵（按住）
const PAD = { up: [200, 518], down: [200, 574], left: [140, 546], right: [260, 546] };
const padAt = (x, y) => Object.keys(PAD).find((k) => Math.abs(x - PAD[k][0]) < 28 && Math.abs(y - PAD[k][1]) < 26) || null;
LIYU.on('down', (x, y) => { pad = padAt(x, y); });
LIYU.on('move', (x, y, e, held) => { if (held) pad = padAt(x, y); });
LIYU.on('up', () => { pad = null; });

function solid(x, y) { return cell(Math.floor((x - OX) / CS), Math.floor((y - OY) / CS)) === '#'; }
function step(dt) {
  let ax = 0, ay = 0;
  if (keys.ArrowLeft || pad === 'left') ax -= 1; if (keys.ArrowRight || pad === 'right') ax += 1;
  if (keys.ArrowUp || pad === 'up') ay -= 1; if (keys.ArrowDown || pad === 'down') ay += 1;
  if (!ax && !ay && tilt) { ax = tilt.x; ay = tilt.y; }
  const b = ball, A = 520;
  b.vx = (b.vx + ax * A * dt) * Math.pow(.25, dt); b.vy = (b.vy + ay * A * dt) * Math.pow(.25, dt);
  const sp = Math.hypot(b.vx, b.vy), MAX = 260; if (sp > MAX) { b.vx *= MAX / sp; b.vy *= MAX / sp; }
  // 分軸移動，碰牆反彈一點點
  const nx = b.x + b.vx * dt;
  if (solid(nx + Math.sign(b.vx) * BR, b.y - BR + 2) || solid(nx + Math.sign(b.vx) * BR, b.y + BR - 2)) { if (Math.abs(b.vx) > 120) LIYU.sfx('bump'); b.vx *= -.3; } else b.x = nx;
  const ny = b.y + b.vy * dt;
  if (solid(b.x - BR + 2, ny + Math.sign(b.vy) * BR) || solid(b.x + BR - 2, ny + Math.sign(b.vy) * BR)) { if (Math.abs(b.vy) > 120) LIYU.sfx('bump'); b.vy *= -.3; } else b.y = ny;
  const c = Math.floor((b.x - OX) / CS), r = Math.floor((b.y - OY) / CS), k = cell(c, r);
  if (k === 'O') { const hx = OX + c * CS + CS / 2 + HOLE_OFF, hy = OY + r * CS + CS / 2 + HOLE_OFF; if (Math.hypot(b.x - hx, b.y - hy) < HOLE_R) { b.fall = .6; b.hx = hx; b.hy = hy; falls++; LIYU.sfx('miss'); LIYU.toast('掉進洞了！回到起點'); } }
  if (k === 'G') {
    LIYU.sfx('win'); if (lv === 0) LIYU.clear();
    if (lv < CONFIG.levels.length - 1) { LIYU.toast(`第 ${lv + 1} 關完成！`); win = 1; setTimeout(() => { if (LIYU.running) { win = 0; load(lv + 1); } }, 900); }
    else LIYU.finish({ score: Math.round(time), higher: false, lines: [`3 關全部完成！`, `花了 ${Math.round(time)} 秒・掉洞 ${falls} 次`] });
    b.vx = b.vy = 0;
  }
}
LIYU.loop((dt) => {
  LIYU.bg('#f3e1c4');
  if (!maze) { LIYU.text('🔵 彈珠迷宮', 200, 300, { size: 34 }); return; }
  for (let r = 0; r < maze.length; r++) for (let c = 0; c < 10; c++) {
    const k = maze[r][c], x = OX + c * CS, y = OY + r * CS;
    if (k === '#') LIYU.rrect(x, y, CS, CS, 4, '#8b5a2b');
    else { ctx.fillStyle = '#e8c28e'; ctx.fillRect(x, y, CS, CS); }
    if (k === 'O') LIYU.circle(x + CS / 2 + HOLE_OFF, y + CS / 2 + HOLE_OFF, HOLE_R, '#2a1d12');
    if (k === 'S') LIYU.text('🚩', x + CS / 2, y + CS / 2, { size: 20 });
    if (k === 'G') LIYU.circle(x + CS / 2, y + CS / 2, 14, '#e8473f', '#fff', 3);
  }
  if (LIYU.running && !win) {
    time += dt;
    if (ball.fall > 0) { ball.fall -= dt; ball.x += (ball.hx - ball.x) * .2; ball.y += (ball.hy - ball.y) * .2; if (ball.fall <= 0) { ball.x = ball.sx; ball.y = ball.sy; ball.vx = ball.vy = 0; } }
    else step(dt);
  }
  const s = ball.fall > 0 ? Math.max(.2, ball.fall / .6) : 1;
  LIYU.circle(ball.x + 2, ball.y + 3, BR * s, 'rgba(0,0,0,.25)'); LIYU.circle(ball.x, ball.y, BR * s, '#2f7fd1', '#fff', 2); LIYU.circle(ball.x - 3, ball.y - 3, 3 * s, 'rgba(255,255,255,.8)');
  for (const [k, [x, y]] of Object.entries(PAD)) { LIYU.rrect(x - 26, y - 24, 52, 48, 12, pad === k ? '#e8762b' : 'rgba(255,255,255,.85)', '#a8743f', 2); LIYU.text({ up: '▲', down: '▼', left: '◀', right: '▶' }[k], x, y + 1, { size: 22, color: pad === k ? '#fff' : '#7a4a22' }); }
  LIYU.text(`第 ${lv + 1}／${CONFIG.levels.length} 關`, 16, 26, { align: 'left', size: 18 });
  LIYU.text(`⏱ ${Math.floor(time)} 秒`, W - 16, 26, { align: 'right', size: 18 });
  if (tilt) LIYU.text('📱 傾斜中', 330, 546, { size: 14, color: '#7a4a22', weight: 600 });
});
LIYU.peek = () => ({ ball, lv, OX, OY, CS });   // 自動測試用
LIYU.setup({ ...CONFIG, start });
