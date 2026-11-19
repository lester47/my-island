// 🧩 遊戲範本：複製整個 _template 資料夾，改名成 stall-攤號（兩位數），再改下面的設定和玩法
// 範本示範：鯉魚從水裡冒出來，點到就得分；20 秒內點到 5 隻過關
import { LIYU } from '../_kit/kit.js?v=20261119c';
const { ctx, W, H } = LIYU;

// ===== ① 設定（學生可以先只改這裡）=====
const CONFIG = {
  no: 0,                                 // 攤號
  title: '點點鯉魚（範本）',              // 遊戲名稱
  stall: '範本攤位',                     // 攤位名稱
  how: ['鯉魚會從水裡冒出來', '在牠潛下去之前點牠'],
  clear: '20 秒內點到 5 隻',             // 過關條件（要和現場攤位一樣）
  time: 20,                              // 一輪幾秒
  goal: 5,                               // 點到幾隻過關
  credit: '遊戲設計：○○○、○○○｜美術：○○○', // 組員署名
};
// 學生畫的圖：放在 assets/ 資料夾，透明 PNG；還沒有圖時會自動畫簡單圖形代替
const IMG = { koi: LIYU.img('assets/koi.png') };

// ===== ② 遊戲狀態 =====
let t = 0, score = 0, fish = null;
function newFish() { fish = { x: 60 + Math.random() * (W - 120), y: 200 + Math.random() * 300, life: 1.1 }; }

// ===== ③ 開始一輪 =====
function start() { t = CONFIG.time; score = 0; newFish(); }

// ===== ④ 點畫面 =====
LIYU.on('down', (x, y) => {
  if (!LIYU.running || !fish) return;
  if (Math.hypot(x - fish.x, y - fish.y) < 44) {
    score++; LIYU.sfx('hit'); newFish();
    if (score >= CONFIG.goal) LIYU.clear(score);      // 達成過關條件 → 通知市集蓋章
  }
});

// ===== ⑤ 每一格畫面 =====
LIYU.loop((dt) => {
  LIYU.bg('#cdeefa');
  if (LIYU.running) {
    t -= dt; fish.life -= dt; if (fish.life <= 0) newFish();
    if (t <= 0) LIYU.finish({ score, lines: [`點到 ${score} 隻鯉魚`] });
  }
  if (fish) {
    if (IMG.koi.ok) ctx.drawImage(IMG.koi.el, fish.x - 40, fish.y - 25, 80, 50);
    else { LIYU.circle(fish.x, fish.y, 30, '#e8762b'); LIYU.circle(fish.x - 12, fish.y - 6, 5, '#fff'); }
  }
  LIYU.text(`⏱ ${Math.max(0, Math.ceil(t))}`, 20, 30, { align: 'left' });
  LIYU.text(`🐟 ${score}／${CONFIG.goal}`, W - 20, 30, { align: 'right' });
});

LIYU.setup({ ...CONFIG, start });
