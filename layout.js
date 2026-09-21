/* ============================================================
 * 布局坐标 + UI 配色 + 文本适配工具
 * 依赖：无（纯常量与工具函数），需在 slot-game.js 之前加载。
 *
 * Royale 换皮：横屏 / 竖屏各有一套画布尺寸与坐标（LAYOUT_PRESETS），
 * 全部以对应底图的像素坐标为准（横 1536×1024，竖 1024×1536）。
 * 当前生效的一套是全局 LAYOUT，切换横竖屏时用 applyLayout(key) 重新指向。
 * （config.js 里的 GAME_WIDTH / GAME_HEIGHT 是旧 960×540 设计稿常量，换皮后不再使用。）
 * ============================================================ */

// ---------- 布局预设 ----------
// 转轴窗口 reelWindows 是底图里透明窗口的像素范围（[x0,x1]），reelTop/reelBottom 为窗口上下沿。
// 拉杆：球头 + 杆身是从底图里抠出来的两张 PNG（assets/lever_*），原位的杆已在底图里抹掉，
// 由代码画回去并做"下拉"动画。底图里原有的 BALANCE / BET / LAST WIN 文字也已抹掉，改由代码绘制。
function finishLayout(p) {
  p.reelH = p.reelBottom - p.reelTop;
  p.reelY = (p.reelTop + p.reelBottom) / 2;
  p.rowH = p.reelH / p.rowsVisible;
  p.reelXs = p.reelWindows.map((w) => (w[0] + w[1]) / 2);
  p.itemN = Math.ceil((p.rowsVisible + 1) / 2); // 中心行上下各缓冲的行数（横 2 / 竖 3）
  const cell = Math.min(p.rowH, p.reelWindows[0][1] - p.reelWindows[0][0]);
  p.symFont = Math.round(cell * 0.62);
  p.discR = Math.round(cell * 0.4);
  p.lever.handFont = Math.round(p.lever.ballR * 1.6);
  p.lever.gripDx = -p.lever.ballR * 0.3;
  p.lever.gripDy = p.lever.ballR * 0.3;
  p.lever.restX = p.lever.ballX + p.lever.ballR * 2.4;
  p.lever.restY = p.lever.ballY - p.lever.ballR * 2.4;
  // 旧代码里少数地方仍读这几个字段
  p.balanceW = p.plates.valueMaxW + 35;
  p.lastWinW = p.plates.valueMaxW + 35;
  p.messageW = p.msg.w;
  return p;
}

const LAYOUT_PRESETS = {
  landscape: finishLayout({
    key: "landscape",
    width: 1536,
    height: 1024,
    k: 1.6, // 相对旧 960 宽设计稿的放大系数（星星等装饰用）
    bgKey: "bg_landscape",
    bgFile: "assets/royale_landscape.webp",
    ballKey: "ball_landscape",
    ballFile: "assets/lever_ball_landscape.png",
    shaftKey: "shaft_landscape",
    shaftFile: "assets/lever_shaft_landscape.png",

    reelWindows: [[445, 667], [682, 904], [919, 1139]],
    reelTop: 178,
    reelBottom: 809,
    rowsVisible: 3,
    dimOuterRows: false,
    frame: { x: 787, y: 492, w: 775, h: 715 },
    bounce: 23,

    jackpot: { x: 768, y: 58, w: 600, h: 62, font: 38, minFont: 24, maxW: 500 },
    msg: { x: 768, y: 997, w: 760, h: 42 },
    msgScale: 1.35,
    plates: {
      xs: [481, 783, 1077], y: 920, labelDy: -20, valueDy: 12,
      labelFont: 20, valueFont: 34, valueMinFont: 20, valueMaxW: 210, arrowDx: 108,
    },

    // 左侧音乐 / 设置面板（原 170×237 面板，整体按 k 放大后放到 x,y）
    paytableX: 112, paytableY: 280, paytableW: 170, paytableH: 237,
    dock: { x: 222, y: 520, k: 1.5 },
    clock: { x: 62, y: 62, k: 1.2 },
    modalScale: 1.65,

    lever: {
      ballX: 1221, ballY: 425, ballR: 35, collarBottom: 467, drop: 78,
      shaftX: 1220, baseY: 560,
      hit: { x: 1221, y: 540, w: 130, h: 340 },
    },

    win: { x: 768, y: 493, font: 120, stroke: 14 },
    fx: { cx: 768, cy: 493, k: 1.6, coinX0: 445, coinX1: 1139, coinY0: 340, coinY1: 640 },
  }),

  portrait: finishLayout({
    key: "portrait",
    width: 1024,
    height: 1536,
    k: 1.5,
    bgKey: "bg_portrait",
    bgFile: "assets/royale_portrait.webp",
    ballKey: "ball_portrait",
    ballFile: "assets/lever_ball_portrait.png",
    shaftKey: "shaft_portrait",
    shaftFile: "assets/lever_shaft_portrait.png",

    reelWindows: [[244, 415], [427, 595], [610, 776]],
    reelTop: 240,
    reelBottom: 1221,
    rowsVisible: 5, // 每列显示 5 行；中间 3 行对应横屏的 3 行，上下各 1 行压暗；判奖仍只看正中一行
    dimOuterRows: true,
    frame: { x: 507, y: 734, w: 598, h: 1068 },
    bounce: 21,

    jackpot: { x: 540, y: 95, w: 400, h: 64, font: 32, minFont: 20, maxW: 340 },
    msg: { x: 512, y: 1322, w: 470, h: 44 },
    msgScale: 1.4,
    plates: {
      xs: [260, 521, 781], y: 1415, labelDy: -20, valueDy: 12,
      labelFont: 22, valueFont: 36, valueMinFont: 20, valueMaxW: 190, arrowDx: 100,
    },

    paytableX: 112, paytableY: 280, paytableW: 170, paytableH: 237,
    dock: { x: 136, y: 720, k: 1.6 },
    clock: { x: 818, y: 100, k: 1.4 },
    modalScale: 1.55,

    lever: {
      ballX: 879, ballY: 627, ballR: 53, collarBottom: 694, drop: 100,
      shaftX: 878, baseY: 806,
      hit: { x: 880, y: 815, w: 150, h: 510 },
    },

    win: { x: 512, y: 730, font: 110, stroke: 14 },
    fx: { cx: 512, cy: 730, k: 1.3, coinX0: 244, coinX1: 776, coinY0: 520, coinY1: 940 },
  }),
};

// 当前生效的布局（其它文件直接读全局 LAYOUT）
let LAYOUT = LAYOUT_PRESETS.landscape;

function detectOrientationKey() {
  try {
    if (window.matchMedia) {
      return window.matchMedia("(orientation: portrait)").matches
        ? "portrait"
        : "landscape";
    }
  } catch (e) {}
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

function applyLayout(key) {
  LAYOUT = LAYOUT_PRESETS[key] || LAYOUT_PRESETS.landscape;
  return LAYOUT;
}

// ---------- UI 配色 ----------
// 全站唯一金色来源：GOLD（数值，画布用），与页面 CSS 变量 --gold 保持同一
// 数值，避免多处各自定义、互相不一致。
const GOLD = 0xffd700;
// 旧拉杆手柄的待机色（Royale 换皮后拉杆改为底图抠图，这个常量已不再使用，保留仅为兼容）
const LEVER_HANDLE_IDLE_FILL = 0x5c4010;

// 仅保留 slot-game.js 实际引用的键。
const UI = {
  panel: 0x0a1226,
  panelDeep: 0x060b18,
  gold: GOLD,
  goldDim: GOLD,
  goldBright: GOLD,
  neon: 0x39b8ff, // Royale 蓝色霓虹描边
  cream: "#dbe9ff",
  textDark: "#17120a",
  activeFill: 0x8d6f32,
  // 点缀色：宝石红，少量用于聚焦光晕等
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
