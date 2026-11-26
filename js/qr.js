// 📱 網站 QR code：點左上角的「115 鯉魚市集」打開，掃一下就能到這個網站
// QR code 用 vendor/qrcode（qrcode-generator，MIT 授權）在這台裝置畫出來，不用連到別的網站。
import qrcode from '../vendor/qrcode/qrcode.mjs';

/** 這個網站的網址：拿掉 ?debug 之類的參數和 index.html，掃到的人看到的就是首頁 */
export function siteUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

/** 把網址畫成 QR code（黑白方格，四周留白），回傳 canvas */
export function qrCanvas(text, px = 320) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), quiet = 4, cell = Math.max(2, Math.floor(px / (n + quiet * 2))), size = cell * (n + quiet * 2);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, size, size); x.fillStyle = '#1b1b1b';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
  return cv;
}

/** 下載用的圖：上面標題、中間 QR code、下面網址 */
function posterPng(url, title) {
  const qr = qrCanvas(url, 640), W = qr.width + 80, H = qr.width + 220;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = '#fff7ee'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#c23a1c'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = "900 48px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.fillText(title, W / 2, 64);
  x.drawImage(qr, 40, 110);
  x.fillStyle = '#5a4a3a'; x.font = "700 26px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.fillText(url, W / 2, H - 56);
  return cv.toDataURL('image/png');
}

export function createQr({ $, esc, toast, openDlg, title = '115 鯉魚市集' }) {
  function open() {
    const url = siteUrl(), body = $('#qrBody');
    body.innerHTML = `<p class="qr-lead">用手機相機掃一下，就能打開 ${esc(title)} 的網站</p>
      <div class="qr-box" role="img" aria-label="${esc(title)}網站的 QR code，網址 ${esc(url)}"></div>
      <p class="qr-url"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></p>
      <div class="qr-btns"><button type="button" class="btn ghost" data-qr="copy">📋 複製連結</button>${navigator.share ? '<button type="button" class="btn ghost" data-qr="share">📤 分享</button>' : ''}<a class="btn" data-qr="save" download="115鯉魚市集-QRcode.png" href="#">💾 存 QR code</a></div>`;
    body.querySelector('.qr-box').appendChild(qrCanvas(url, 300));
    body.querySelector('[data-qr="save"]').href = posterPng(url, title);
    body.querySelector('[data-qr="copy"]').onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('📋 連結複製好了，可以貼給朋友'), () => toast('這台裝置不能自動複製，請長按網址複製'));
    const sh = body.querySelector('[data-qr="share"]'); if (sh) sh.onclick = () => navigator.share({ title, text: `一起來逛 ${title}！`, url }).catch(() => {});
    openDlg('#qrDlg');
  }
  return { open };
}
