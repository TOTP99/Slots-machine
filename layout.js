/* 横/竖屏布局预设 + UI 配色 + fitTextToBox */

function finishLayout(p) {
  p.reelH = p.reelBottom - p.reelTop;
  p.reelY = (p.reelTop + p.reelBottom) / 2;
  p.rowH = p.reelH / p.rowsVisible;
  p.reelXs = p.reelWindows.map((w) => (w[0] + w[1]) / 2);
  p.itemN = Math.ceil((p.rowsVisible + 1) / 2);
  const cell = Math.min(p.rowH, p.reelWindows[0][1] - p.reelWindows[0][0]);
  p.symFont = Math.round(cell * 0.62);
  p.discR = Math.round(cell * 0.4);
  p.lever.handFont = Math.round(p.lever.ballR * 1.6);
  p.lever.gripDx = -p.lever.ballR * 0.3;
  p.lever.gripDy = p.lever.ballR * 0.3;
  p.lever.restX = p.lever.ballX + p.lever.ballR * 2.4;
  p.lever.restY = p.lever.ballY - p.lever.ballR * 2.4;
  p.messageW = p.msg.w;
  return p;
}

const LAYOUT_PRESETS = {
  landscape: finishLayout({
    key: "landscape",
    width: 1536,
    height: 1024,
    k: 1.6,
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

    paytableX: 112, paytableY: 280, paytableW: 170, paytableH: 237,
    dock: { x: 230, y: 530, k: 1.85 },
    // 招牌上原 "ROYALE" 文字的位置：换成 HH:MM:SS 数字时钟
    clockSign: { x: 1320, y: 231, w: 290, h: 62 },
    // 右下角硬币（原皇冠+R+ROYALE）：换成设置入口按钮
    coinButton: { x: 1445, y: 915, r: 85 },
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
    rowsVisible: 5,
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
    // 招牌上原 "ROYALE" 文字的位置：换成 HH:MM:SS 数字时钟
    clockSign: { x: 885, y: 279, w: 240, h: 66 },
    // 右下角硬币（原皇冠+R+ROYALE）：换成设置入口按钮
    coinButton: { x: 875, y: 1275, r: 115 },
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

const GOLD = 0xffd700;
const UI = {
  panel: 0x0a1226,
  gold: GOLD,
  goldDim: GOLD,
  neon: 0x39b8ff,
  cream: "#dbe9ff",
  textDark: "#17120a",
  activeFill: 0x8d6f32,
  ruby: 0xb3122b,
};
function fitTextToBox(textObject, value, maxWidth, baseFontSize = 20, minFontSize = 12) {
  if (!textObject) return;
  textObject.setText(value);
  textObject.setFontSize(baseFontSize);
  let size = baseFontSize;
  while (textObject.width > maxWidth && size > minFontSize) {
    size -= 1;
    textObject.setFontSize(size);
  }
}
