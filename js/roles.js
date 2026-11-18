// 加入市集時可選的身分與衣服顏色（main.js 與 players.js 共用）
export const ROLES = {
  student: { label: '學生', icon: '🎒', color: '#2f7fd1' },
  parent: { label: '家長', icon: '🏠', color: '#d0621a' },
  teacher: { label: '老師', icon: '🍎', color: '#2f8a40' },
  visitor: { label: '訪客', icon: '⭐', color: '#7a4cc0' },
};
export const OUTFITS = ['#e8762b', '#2f7fd1', '#dc4848', '#3e9b4f', '#8a5cd0', '#e3a33b', '#4fb3b0', '#f2f2f2'];
// 可以選的帽子（每頂帽子前面都有小鯉魚 Logo）
export const HATS = {
  none: { label: '不戴', icon: '🙂' },
  cap: { label: '棒球帽', icon: '🧢' },
  bucket: { label: '漁夫帽', icon: '👒' },
  beanie: { label: '毛線帽', icon: '🧶' },
  straw: { label: '草帽', icon: '🌾' },
  koi: { label: '鯉魚帽', icon: '🎏' },
};
