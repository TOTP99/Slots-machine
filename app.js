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
    try {
      if (typeof bgMusic !== "undefined") {
        if (document.hidden) {
          // 切到后台时落盘进度，避免刷新/杀进程丢进度
          if (typeof bgMusic.persistProgress === "function") bgMusic.persistProgress();
        } else if (bgMusic.enabled) {
          bgMusic.tryPlay();
        }
      }
    } catch (e) {}
  });

  function persistAll() {
    try {
      const sc = window.__slotGameScene;
      if (sc && sc.clockTimer) {
        clearInterval(sc.clockTimer);
        sc.clockTimer = null;
      }
      if (sc && typeof sc.saveGameState === "function") sc.saveGameState(true);
      if (typeof bgMusic !== "undefined" && typeof bgMusic.persistProgress === "function") {
        bgMusic.persistProgress();
      }
    } catch (e) {}
  }

  window.addEventListener("beforeunload", persistAll);
  window.addEventListener("pagehide", persistAll);
})();

/** 横竖屏切换：换布局 + 重启场景；其余情况只刷新缩放
 *  重点：丝滑切换 + 竖屏回位防上移（iOS 地址栏/安全区导致的视觉偏移）
 */
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
  let switching = false;

  /** 强制页面回到可视区顶部并纠正 100vh 偏移（竖屏上移主因） */
  function forceViewportCenter() {
    try {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      // 用 visualViewport 校正 iOS 工具栏弹出后的偏移
      const vv = window.visualViewport;
      if (vv) {
        const dy = vv.offsetTop || 0;
        if (dy !== 0) {
          window.scrollTo(0, dy);
          window.scrollTo(0, 0);
        }
      }
      // 同步 CSS 变量，让 100dvh 类布局用真实可视高度
      const h = (vv && vv.height) || window.innerHeight || 0;
      if (h > 0 && document.documentElement) {
        document.documentElement.style.setProperty("--app-vh", h + "px");
      }
    } catch (e) {}
  }

  function refreshScale() {
    forceViewportCenter();
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

  /** 多次延迟刷新，消化浏览器工具栏动画与 CSS 重排 */
  function multiPassRefresh() {
    forceViewportCenter();
    refreshScale();
    setTimeout(function () {
      forceViewportCenter();
      refreshScale();
    }, 60);
    setTimeout(function () {
      forceViewportCenter();
      refreshScale();
    }, 180);
    setTimeout(function () {
      forceViewportCenter();
      refreshScale();
    }, 420);
  }

  function switchLayout(key) {
    if (key === currentKey || switching) return;

    const g = window.__slotGame;
    const sc = window.__slotGameScene;
    const sceneReady = !!(g && sc && sc.sys && sc.sys.isActive());

    if (!sceneReady) {
      // 场景还没起来（首次加载中）：只改布局，create() 会按新布局来
      currentKey = key;
      applyLayout(key);
      if (g && g.scale) g.scale.setGameSize(LAYOUT.width, LAYOUT.height);
      multiPassRefresh();
      return;
    }

    // 正在转动 / 拉杆未复位：等这一把结算完再切
    if (sc.isSpinning || sc.leverState === "down") {
      setTimeout(function () {
        if (detectOrientationKey() === key) switchLayout(key);
      }, 280);
      return;
    }

    switching = true;
    currentKey = key;

    // 淡出 → 换尺寸 → 重启 → 淡入，减少硬切闪烁
    const doSwitch = function () {
      applyLayout(key);
      try {
        if (typeof sc.saveGameState === "function") sc.saveGameState(true);
      } catch (e) {}
      try {
        if (typeof bgMusic !== "undefined" && typeof bgMusic.persistProgress === "function") {
          bgMusic.persistProgress();
        }
      } catch (e) {}

      forceViewportCenter();
      g.scale.setGameSize(LAYOUT.width, LAYOUT.height);
      sc.scene.restart();

      // 等场景 create 完成后再多轮居中刷新
      setTimeout(function () {
        multiPassRefresh();
        try {
          const sc2 = window.__slotGameScene;
          if (sc2 && sc2.cameras && sc2.cameras.main) {
            sc2.cameras.main.fadeIn(220, 3, 2, 2);
          }
        } catch (e) {}
        switching = false;
      }, 50);
    };

    try {
      if (sc.cameras && sc.cameras.main) {
        sc.cameras.main.fadeOut(140, 3, 2, 2);
        sc.time.delayedCall(150, doSwitch);
        return;
      }
    } catch (e) {}
    doSwitch();
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
        // 尺寸仍在变（地址栏收展），继续等稳
        if (Math.abs(w1 - w2) > 2 || Math.abs(h1 - h2) > 2) {
          scheduleRefresh();
          return;
        }
        forceViewportCenter();
        switchLayout(detectOrientationKey());
        multiPassRefresh();
      }, isIOS ? 160 : 100);
    }, isIOS ? 240 : 160);
  }

  window.addEventListener("orientationchange", function () {
    forceViewportCenter();
    scheduleRefresh();
  });
  window.addEventListener("resize", scheduleRefresh);
  try {
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleRefresh);
      window.visualViewport.addEventListener("scroll", function () {
        forceViewportCenter();
      });
    }
  } catch (e) {}
  try {
    if (window.matchMedia) {
      const mql = window.matchMedia("(orientation: portrait)");
      if (mql.addEventListener) mql.addEventListener("change", scheduleRefresh);
      else if (mql.addListener) mql.addListener(scheduleRefresh);
    }
  } catch (e) {}

  // 首屏也校正一次
  setTimeout(forceViewportCenter, 0);
  setTimeout(forceViewportCenter, 200);
})();
