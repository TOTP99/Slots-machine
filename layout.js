/* ============================================================
 * 布局坐标 + UI 配色 + 文本适配工具
 * 依赖：无（纯常量与工具函数），需在 slot-game.js 之前加载。
 * ============================================================ */

// ---------- 布局坐标 ----------
const LAYOUT = {
  jackpotY: 70,

  paytableX: 112,
  paytableY: 280,
  paytableW: 170,
  paytableH: 237,

  machineX: 470,
  machineY: 270,
  machineOuterW: 560,
  machineOuterH: 255,
  machineInnerW: 520,
  machineInnerH: 208,
  reelFrameW: 150,
  reelFrameH: 170,
  reelXs: [350, 470, 590],
  reelY: 270,

  messageX: 470,
  messageY: 402,
  messageW: 448,
  messageH: 44,

  // 余额 / 上次获胜现在并入四分屏（createBottomPanels 统一布局），
  // 只有 W 还用于 fitTextToBox 的最大宽度计算，X/Y/H 已不再需要，故未保留。
  balanceW: 108,
  lastWinW: 108,

  rightPanelX: 855,
};

// ---------- UI 配色（高级金边主题） ----------
// 全站唯一金色来源：GOLD（数值，画布用），与页面 CSS 变量 --gold 保持同一
// 数值，避免多处各自定义、互相不一致。
const GOLD = 0xffd700;
// 拉杆手柄外圈的"待机"填充色：hover 高亮和松开复位都要用这同一个值，
// 否则第一次 hover 后手柄会永久停在 hover 用的过渡色上，回不到真正的默认色
const LEVER_HANDLE_IDLE_FILL = 0x5c4010;

// 仅保留 slot-game.js 实际引用的键。
const UI = {
  panel: 0x101714,
  panelDeep: 0x0b100e,
  gold: GOLD,
  goldDim: GOLD,
  goldBright: GOLD,
  cream: "#e8dcc0",
  textDark: "#17120a",
  activeFill: 0x8d6f32,
  // 点缀色：宝石红，少量用于三线标签底、聚焦光晕等，打破纯金单色
  ruby: 0xb3122b,
  rubyDim: 0x6e0c1c,
};

// 面板圆角半径（统一口径，避免各处各写各的数值）
const PANEL_RADIUS = 14;

// ---------- 文本适配 ----------
// 把文本塞进一个最大宽度里：先按 baseFontSize 渲染，超宽就逐级缩小字号，
// 直到不超宽或触底 minFontSize 为止。用于余额/中奖播报等长度不固定的文本。
function fitTextToBox(
  textObject,
  value,
  maxWidth,
  baseFontSize = 20,
  minFontSize = 12,
) {
  if (!textObject) return;

  textObject.setText(value);
  textObject.setFontSize(baseFontSize);

  let size = baseFontSize;

  while (textObject.width > maxWidth && size > minFontSize) {
    size -= 1;
    textObject.setFontSize(size);
  }
}
