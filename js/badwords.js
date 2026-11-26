// 🚫 不適當字眼檢查：暱稱、電話自己打的話都用這裡
// 做法：先把文字整理乾淨（全形轉半形、英文轉小寫、拿掉空白和符號），再找有沒有不好的詞。
// 伺服器（Firebase 規則）也會再擋一次最常見的髒話和電話號碼，這裡是第一道、也比較完整的一道。
// 想加詞：加在下面的清單就好（中文、英文都可以）。

// 罵人、髒話、不雅、暴力
const WORDS = [
  // 中文
  '靠北', '靠杯', '靠腰', '靠夭', '機掰', '雞掰', '擊掰', '幹你', '幹妳', '幹他', '幹您', '幹林', '幹拎', '操你', '肏', '屌', '屁眼',
  '白痴', '白癡', '智障', '智缺', '腦殘', '低能', '弱智', '廢物', '人渣', '去死', '死開', '找死', '殺了你', '打死你', '吃屎',
  '賤', '婊', '妓', '雜種', '王八', '混蛋', '畜生', '畜牲', '醜八怪', '死胖子', '神經病',
  '你媽', '你娘', '妳媽', '他媽', '她媽', '媽的', '馬的', '三小', '殺小', '啥小', '北七', '拎北', '恁北', '林北', '閉嘴',
  '色情', '做愛', '性交', '強姦', '自殺',
  // 英文
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'damn', 'sex', 'porn', 'dick', 'pussy', 'asshole', 'bastard', 'idiot', 'stupid', 'wtf', 'stfu', 'kys', 'nigger', 'nigga',
];
// 單獨一個「幹」大多是髒話，但這些正常詞要放行
const OK_WITH_GAN = ['幹嘛', '幹麼', '幹麻', '能幹', '幹部', '樹幹', '主幹', '才幹', '幹活', '苦幹', '實幹', '軀幹', '骨幹', '幹練', '幹勁'];

/** 整理文字：全形轉半形、小寫、拿掉空白和標點符號（避免「白 痴」「f.u.c.k」這樣躲過去） */
export function normalize(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}_]/gu, '');
}
// 英文常見的數字代換：sh1t、b1tch、fvck…
const deLeet = (s) => s.replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4|@/g, 'a').replace(/5|\$/g, 's').replace(/7/g, 't').replace(/v/g, 'u');

/** 有不適當的字就回傳 true */
export function hasBadWord(s) {
  const n = normalize(s).split('媽媽').join('');   // 「你媽媽在哪？」是正常的話，先拿掉「媽媽」再檢查
  if (!n) return false;
  const alt = deLeet(n.replace(/[^a-z0-9]/g, ''));
  if (WORDS.some((w) => n.includes(w) || (/^[a-z]+$/.test(w) && alt.includes(w)))) return true;
  if (n.includes('幹')) { let m = n; for (const ok of OK_WITH_GAN) m = m.split(ok).join(''); if (m.includes('幹')) return true; }
  return false;
}

/** 有沒有像在留個人資料：電話號碼（連續 6 個以上數字）、網址、email、LINE／IG 帳號 */
export function hasPersonalInfo(s) {
  const raw = String(s || '').normalize('NFKC').toLowerCase();
  const digits = raw.replace(/[\s\-–—.()]/g, '');
  return /\d{6,}/.test(digits) || /https?:|www\.|\.com|\.tw|@|line\s*id|ig\s*[:：]/.test(raw);
}

/** 電話自己打的話：回傳空字串＝可以送；不然回傳原因 */
export function checkMessage(s, max) {
  const t = String(s || '').trim();
  if (!t) return '還沒有打字喔';
  if ([...t].length > max) return `最多 ${max} 個字`;
  if (hasBadWord(t)) return '這句話有不適當的字眼，換個說法吧 🙂';
  if (hasPersonalInfo(t)) return '不要在電話裡留電話號碼、網址或帳號喔';
  return '';
}
