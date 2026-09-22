/* 启动 Phaser + 横竖屏卷帘切换 + 音频解锁 */

(function bootstrapGame() {
  applyLayout(detectOrientationKey());

  window.__slotGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: LAYOUT.width,
    height: LAYOUT.height,
    parent: "game",
    backgroundColor: "#030202",
    banner: false,
    loader: { imageLoadType: "HTMLImageElement" },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LAYOUT.width,
      height: LAYOUT.height,
    },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scene: SlotGame,
  });

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
      if (typeof bgMusic === "undefined") return;
      if (document.hidden) {
        if (typeof bgMusic.persistProgress === "function") bgMusic.persistProgress();
      } else if (bgMusic.enabled) {
        bgMusic.tryPlay();
      }
    } catch (e) {}
  });

  function persistAll() {
    try {
      const sc = window.__slotGameScene;
      if (sc && typeof sc.saveGameState === "function") sc.saveGameState(true);
      if (typeof bgMusic !== "undefined" && typeof bgMusic.persistProgress === "function") {
        bgMusic.persistProgress();
      }
    } catch (e) {}
  }
  window.addEventListener("beforeunload", persistAll);
  window.addEventListener("pagehide", persistAll);
})();

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

  const CURTAIN_MS = 400;

  function ensureCurtain() {
    let el = document.getElementById("orient-curtain");
    if (el) return el;
    el = document.createElement("div");
    el.id = "orient-curtain";
    el.innerHTML =
      '<div class="curtain-half curtain-top"></div><div class="curtain-half curtain-bot"></div>';
    document.body.appendChild(el);
    return el;
  }

  function curtainClose(done) {
    const el = ensureCurtain();
    el.classList.remove("active");
    void el.offsetWidth;
    el.classList.add("active");
    setTimeout(done, CURTAIN_MS);
  }

  function curtainOpen(done) {
    const el = ensureCurtain();
    el.classList.remove("active");
    setTimeout(function () {
      if (typeof done === "function") done();
    }, CURTAIN_MS);
  }

  function forceViewportCenter() {
    try {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const vv = window.visualViewport;
      if (vv) {
        const dy = vv.offsetTop || 0;
        if (dy !== 0) {
          window.scrollTo(0, dy);
          window.scrollTo(0, 0);
        }
      }
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
      if (g && g.scale && typeof g.scale.refresh === "function") g.scale.refresh();
    } catch (e) {}
    try {
      if (typeof bgMusic !== "undefined" && bgMusic.enabled) bgMusic.tryPlay();
    } catch (e) {}
  }

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
      currentKey = key;
      applyLayout(key);
      if (g && g.scale) g.scale.setGameSize(LAYOUT.width, LAYOUT.height);
      multiPassRefresh();
      return;
    }

    if (sc.isSpinning || sc.leverState === "down") {
      setTimeout(function () {
        if (detectOrientationKey() === key) switchLayout(key);
      }, 280);
      return;
    }

    switching = true;
    currentKey = key;

    curtainClose(function () {
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

      setTimeout(function () {
        multiPassRefresh();
        curtainOpen(function () {
          switching = false;
        });
      }, 50);
    });
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

  setTimeout(forceViewportCenter, 0);
  setTimeout(forceViewportCenter, 200);
})();
