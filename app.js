/* ============================================================
 * 横屏：完全原样（不读竖屏布局、不改 Phaser 外观）
 * 竖屏：Royale 边框 + HUD 填充数据
 * ============================================================ */

(function bootstrapGame() {
  const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game",
    backgroundColor: "#030202",
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scene: SlotGame,
  };

  window.__slotGame = new Phaser.Game(config);
  window.__portraitMode = false;

  function unlockAudioOnce() {
    try {
      const sc =
        window.__slotGameScene ||
        (window.__slotGame &&
          window.__slotGame.scene &&
          window.__slotGame.scene.getScenes()[0]);
      if (sc && sc.sfx) {
        sc.sfx.enabled = true;
        sc.sfx.init();
        sc.sfx.warmup();
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          if (ctx.state === "suspended") {
            const r = ctx.resume();
            if (r && typeof r.catch === "function") r.catch(function () {});
          }
        }
      }
    } catch (e) {}
    try {
      bgMusic.tryPlay();
    } catch (e) {}
    document.removeEventListener("touchstart", unlockAudioOnce, true);
    document.removeEventListener("mousedown", unlockAudioOnce, true);
    document.removeEventListener("keydown", unlockAudioOnce, true);
  }
  document.addEventListener("touchstart", unlockAudioOnce, true);
  document.addEventListener("mousedown", unlockAudioOnce, true);
  document.addEventListener("keydown", unlockAudioOnce, true);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    try {
      if (typeof bgMusic !== "undefined" && bgMusic.enabled) bgMusic.tryPlay();
    } catch (e) {}
  });

  window.addEventListener("beforeunload", function () {
    try {
      const sc = window.__slotGameScene;
      if (sc && sc.clockTimer) {
        clearInterval(sc.clockTimer);
        sc.clockTimer = null;
      }
      if (sc && typeof sc.saveGameState === "function") sc.saveGameState(true);
    } catch (e) {}
  });
})();

(function setupOrientationResize() {
  const isIOS =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    (!!navigator.vendor &&
      navigator.vendor.indexOf("Apple") >= 0 &&
      "ontouchend" in document);

  const FRAME_W = 1024;
  const FRAME_H = 1536;
  const REEL = { left: 0.238, top: 0.156, right: 0.757, bottom: 0.794 };
  const JACKPOT = { left: 0.18, top: 0.03, right: 0.82, bottom: 0.12 };
  const BTN_Y0 = 0.88;
  const BTN_Y1 = 0.96;
  const BTN = [
    { left: 0.18, right: 0.4 },
    { left: 0.4, right: 0.6 },
    { left: 0.6, right: 0.82 },
  ];
  const LEVER = { left: 0.78, top: 0.32, right: 0.96, bottom: 0.62 };
  const MSG = { left: 0.25, top: 0.8, right: 0.75, bottom: 0.86 };

  let debounceTimer = 0;
  let stabilizeTimer = 0;
  let lastPortrait = null;

  function isPortrait() {
    return window.matchMedia
      ? window.matchMedia("(orientation: portrait)").matches
      : window.innerHeight >= window.innerWidth;
  }

  function frameRect() {
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const scale = Math.min(vw / FRAME_W, vh / FRAME_H);
    const fw = FRAME_W * scale;
    const fh = FRAME_H * scale;
    return {
      ox: (vw - fw) / 2,
      oy: (vh - fh) / 2,
      fw,
      fh,
    };
  }

  function place(el, left, top, right, bottom, fr) {
    if (!el) return;
    el.style.left = Math.round(fr.ox + left * fr.fw) + "px";
    el.style.top = Math.round(fr.oy + top * fr.fh) + "px";
    el.style.width = Math.round((right - left) * fr.fw) + "px";
    el.style.height = Math.round((bottom - top) * fr.fh) + "px";
  }

  /** 横屏：清掉所有竖屏内联样式，恢复原生布局 */
  function clearPortraitInlineStyles() {
    const wrap = document.getElementById("game-wrapper");
    if (wrap) {
      wrap.style.cssText = "";
    }
    [
      "hud-jackpot",
      "hud-message",
      "hud-lever",
      "hud-balance",
      "hud-bet",
      "hud-lastwin",
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.style.left = "";
        el.style.top = "";
        el.style.width = "";
        el.style.height = "";
        el.style.fontSize = "";
      }
    });
  }

  function layoutPortraitSkin() {
    const portrait = isPortrait();
    const wrap = document.getElementById("game-wrapper");
    const hud = document.getElementById("portrait-hud");

    // ---------- 横屏：保护原样 ----------
    if (!portrait) {
      window.__portraitMode = false;
      clearPortraitInlineStyles();
      if (hud) hud.setAttribute("aria-hidden", "true");

      // 仅在从竖屏切回横屏时通知场景还原（避免重复扰动）
      if (lastPortrait === true || lastPortrait === null) {
        try {
          const sc = window.__slotGameScene;
          if (sc && typeof sc.setPortraitMode === "function") {
            sc.setPortraitMode(false);
          }
        } catch (e) {}
      }
      lastPortrait = false;
      return;
    }

    // ---------- 竖屏 ----------
    window.__portraitMode = true;
    lastPortrait = true;
    if (hud) hud.setAttribute("aria-hidden", "false");

    const fr = frameRect();

    if (wrap) {
      wrap.style.position = "fixed";
      wrap.style.left = Math.round(fr.ox + REEL.left * fr.fw) + "px";
      wrap.style.top = Math.round(fr.oy + REEL.top * fr.fh) + "px";
      wrap.style.width = Math.round((REEL.right - REEL.left) * fr.fw) + "px";
      wrap.style.height = Math.round((REEL.bottom - REEL.top) * fr.fh) + "px";
      wrap.style.background = "transparent";
      wrap.style.margin = "0";
    }

    place(document.getElementById("hud-jackpot"), JACKPOT.left, JACKPOT.top, JACKPOT.right, JACKPOT.bottom, fr);
    place(document.getElementById("hud-message"), MSG.left, MSG.top, MSG.right, MSG.bottom, fr);
    place(document.getElementById("hud-lever"), LEVER.left, LEVER.top, LEVER.right, LEVER.bottom, fr);
    place(document.getElementById("hud-balance"), BTN[0].left, BTN_Y0, BTN[0].right, BTN_Y1, fr);
    place(document.getElementById("hud-bet"), BTN[1].left, BTN_Y0, BTN[1].right, BTN_Y1, fr);
    place(document.getElementById("hud-lastwin"), BTN[2].left, BTN_Y0, BTN[2].right, BTN_Y1, fr);

    const jp = document.getElementById("hud-jackpot");
    if (jp) jp.style.fontSize = Math.max(14, Math.round(fr.fh * 0.028)) + "px";
    const msg = document.getElementById("hud-message");
    if (msg) msg.style.fontSize = Math.max(11, Math.round(fr.fh * 0.018)) + "px";
    document.querySelectorAll(".hud-value").forEach(function (el) {
      el.style.fontSize = Math.max(13, Math.round(fr.fh * 0.022)) + "px";
    });
    document.querySelectorAll(".hud-label").forEach(function (el) {
      el.style.fontSize = Math.max(8, Math.round(fr.fh * 0.012)) + "px";
    });

    try {
      const sc = window.__slotGameScene;
      if (sc && typeof sc.setPortraitMode === "function") sc.setPortraitMode(true);
    } catch (e) {}
  }

  window.syncPortraitHUD = function (data) {
    // 横屏不写 HUD，避免无意义 DOM 操作
    if (!window.__portraitMode || !data) return;
    const b = document.getElementById("hud-balance-val");
    const bet = document.getElementById("hud-bet-val");
    const lw = document.getElementById("hud-lastwin-val");
    const jp = document.getElementById("hud-jackpot");
    const msg = document.getElementById("hud-message");
    if (b && data.balance != null) b.textContent = String(data.balance);
    if (bet && data.bet != null) bet.textContent = String(data.bet);
    if (lw && data.lastWin != null) lw.textContent = String(data.lastWin);
    if (jp && data.jackpot != null) jp.textContent = "🏵️ Jackpot " + data.jackpot;
    if (msg && data.message != null) msg.textContent = data.message;
  };

  function bindLever() {
    const btn = document.getElementById("hud-lever");
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener("pointerdown", function (e) {
      // 横屏时按钮被 CSS 隐藏且 pointer-events:none，这里再挡一层
      if (!window.__portraitMode) return;
      e.preventDefault();
      try {
        const sc = window.__slotGameScene;
        if (sc) {
          if (sc.sfx) {
            sc.sfx.init();
            sc.sfx.warmup();
          }
          if (typeof sc.handleSpinInput === "function") sc.handleSpinInput();
        }
      } catch (err) {}
    });
  }

  function refreshScale() {
    layoutPortraitSkin();
    bindLever();
    try {
      const g = window.__slotGame;
      if (g && g.scale && typeof g.scale.refresh === "function") g.scale.refresh();
    } catch (e) {}
    try {
      if (typeof bgMusic !== "undefined" && bgMusic.enabled) bgMusic.tryPlay();
    } catch (e) {}
  }

  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (stabilizeTimer) clearTimeout(stabilizeTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = 0;
      var w1 = window.innerWidth || 0;
      var h1 = window.innerHeight || 0;
      stabilizeTimer = setTimeout(function () {
        stabilizeTimer = 0;
        var w2 = window.innerWidth || 0;
        var h2 = window.innerHeight || 0;
        if (w1 !== w2 || h1 !== h2) {
          scheduleRefresh();
          return;
        }
        refreshScale();
      }, isIOS ? 120 : 80);
    }, isIOS ? 220 : 180);
  }

  window.addEventListener("orientationchange", scheduleRefresh);
  window.addEventListener("resize", scheduleRefresh);
  try {
    if (window.matchMedia) {
      const mql = window.matchMedia("(orientation: portrait)");
      if (mql.addEventListener) mql.addEventListener("change", scheduleRefresh);
      else if (mql.addListener) mql.addListener(scheduleRefresh);
    }
  } catch (e) {}

  // 首屏：若已是横屏，只清样式、不碰场景外观
  layoutPortraitSkin();
  bindLever();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      layoutPortraitSkin();
      bindLever();
    });
  }
  window.addEventListener("load", function () {
    layoutPortraitSkin();
    bindLever();
  });
})();
