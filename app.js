/* ============================================================
 * 应用启动 + 横竖屏适配
 * 横屏 / 竖屏各用一套 Royale 底图与布局（见 layout.js 的 LAYOUT_PRESETS），
 * 画布尺寸随之切换（横 1536×1024，竖 1024×1536）。切换横竖屏时会保存存档 →
 * 调整画布尺寸 → 重启场景重新布局；若此刻正在转动，会等这一把结束后再切，
 * 避免"已扣注、奖金还没结算"时被打断。
 * 状态：localStorage（wanjin_slot_save + bgMusic*）
 * ============================================================ */

(function bootstrapGame() {
  // 先按当前屏幕方向选定布局，再据此创建画布
  applyLayout(detectOrientationKey());

  const config = {
    type: Phaser.AUTO,
    width: LAYOUT.width,
    height: LAYOUT.height,
    parent: "game",
    // 仅作为 create() 里底图绘制完成前的极短兜底色，
    // 与页面背景色 #030202 统一，避免加载瞬间出现色差闪烁。
    backgroundColor: "#030202",
    banner: false,
    // 用 <img> 加载图片（默认走 XHR，直接双击打开 file:// 页面时会被浏览器拦截）
    loader: { imageLoadType: "HTMLImageElement" },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LAYOUT.width,
      height: LAYOUT.height,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scene: SlotGame,
  };

  window.__slotGame = new Phaser.Game(config);

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
      if (typeof bgMusic !== "undefined" && bgMusic.enabled) {
        bgMusic.tryPlay();
      }
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

/** 横竖屏切换：换布局 + 重启场景；其余情况只刷新缩放 */
(function setupOrientationResize() {
  const isIOS =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    (!!navigator.vendor &&
      navigator.vendor.indexOf("Apple") >= 0 &&
      "ontouchend" in document);

  let debounceTimer = 0;
  let stabilizeTimer = 0;
  let currentKey = LAYOUT.key;

  function refreshScale() {
    try {
      const g = window.__slotGame;
      if (g && g.scale && typeof g.scale.refresh === "function") {
        g.scale.refresh();
      }
    } catch (e) {}
    try {
      if (typeof bgMusic !== "undefined" && bgMusic.enabled) {
        bgMusic.tryPlay();
      }
    } catch (e) {}
  }

  function switchLayout(key) {
    if (key === currentKey) return;

    const g = window.__slotGame;
    const sc = window.__slotGameScene;
    const sceneReady = !!(g && sc && sc.sys && sc.sys.isActive());

    if (!sceneReady) {
      // 场景还没起来（首次加载中）：只改布局，create() 会按新布局来
      currentKey = key;
      applyLayout(key);
      if (g && g.scale) g.scale.setGameSize(LAYOUT.width, LAYOUT.height);
      return;
    }

    // 正在转动 / 拉杆未复位：等这一把结算完再切
    if (sc.isSpinning || sc.leverState === "down") {
      setTimeout(function () {
        if (detectOrientationKey() === key) switchLayout(key);
      }, 300);
      return;
    }

    currentKey = key;
    applyLayout(key);
    try {
      if (typeof sc.saveGameState === "function") sc.saveGameState(true);
    } catch (e) {}
    g.scale.setGameSize(LAYOUT.width, LAYOUT.height);
    sc.scene.restart();
    setTimeout(refreshScale, 60);
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
        switchLayout(detectOrientationKey());
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
})();
