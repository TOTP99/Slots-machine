/* ============================================================
 * 背景音乐播放器（BGMusic）
 * 依赖：无（原生 <audio> + Web Audio API 用于暂停淡出）。
 * 需在 slot-game.js 之前加载；侧栏与存档读写全局单例 bgMusic。
 * 曲号/模式写入 localStorage（bgMusic*）。
 * ============================================================ */

// ---------- 背景音乐歌单清单 ----------
// 加歌方式：把 mp3 文件改名为 1.mp3、2.mp3 …按你想要的播放顺序编号，
// 放进和 index.html 同一个目录即可，以后无需再改这里的代码。
// 播放时按数字从小到大依次尝试；如果某个编号的文件缺失，会自动跳过找下一个，
// 直到编号 BG_MUSIC_MAX 结束后循环回到 1。
const BG_MUSIC_MAX = 99; // 支持的最大编号（对应 1.mp3 ~ 99.mp3），全部 99 首参与循环播放
const BG_MUSIC_BASE = "https://totp99.github.io/source/mp3/"; // mp3 取歌来源

class BGMusic {
  constructor() {
    this.currentNum = 1;
    this._skipAttempts = 0; // 连续跳过次数，防止全部文件缺失时死循环

    this.audio = new Audio();
    this.audio.loop = false; // 由 ended/error 事件控制切歌
    this.audio.preload = "auto";
    // 注意：不要设 crossOrigin=anonymous，本地/无 CORS 的 mp3 会被静音或加载失败
    this.audio.volume = 0.5; // 固定音量（无滑杆；iOS 上 <audio>.volume 仍受系统限制）

    const savedEnabled = localStorage.getItem("bgMusicEnabled");
    this.enabled = savedEnabled === null ? true : savedEnabled === "true"; // 默认开启

    const savedMode = localStorage.getItem("bgMusicPlayMode");
    const savedShuffleLegacy = localStorage.getItem("bgMusicShuffle") === "true";
    // order / shuffle / single / all
    let mode = savedMode || (savedShuffleLegacy ? "shuffle" : "order");
    if (mode !== "order" && mode !== "shuffle" && mode !== "single" && mode !== "all") {
      mode = "order";
    }
    this.playMode = mode;
    this.shuffle = this.playMode === "shuffle";

    const savedNum = parseInt(localStorage.getItem("bgMusicCurrentNum") || "1", 10);
    this.currentNum =
      Number.isFinite(savedNum) && savedNum >= 1 && savedNum <= BG_MUSIC_MAX
        ? savedNum
        : 1;

    // Web Audio：MediaElementSource + GainNode，仅用于暂停淡出（避免爆音）
    this.ctx = null;
    this._source = null;
    this._gain = null;
    this._connected = false;
    this._graphFailed = false;

    this.audio.addEventListener("ended", () => this._advance());
    this.audio.addEventListener("error", () => this._advance()); // 该编号文件缺失/加载失败，自动跳到下一个
    this.audio.addEventListener("playing", () => {
      this._skipAttempts = 0; // 成功播放后重置跳过计数
    });
    // 定期落盘进度，刷新页面后可从同一位置续播
    this.audio.addEventListener("timeupdate", () => {
      if (!this._timeSavePending) {
        this._timeSavePending = true;
        setTimeout(() => {
          this._timeSavePending = false;
          this.persistProgress();
        }, 2000);
      }
    });
    this.audio.addEventListener("pause", () => this.persistProgress());

    // 恢复上次播放进度（同一曲号）
    const savedTime = parseFloat(localStorage.getItem("bgMusicCurrentTime") || "0");
    this._resumeTime =
      Number.isFinite(savedTime) && savedTime > 0.5 ? savedTime : 0;

    this._loadTrack(this.currentNum);
    this._setupMediaSession();
  }

  /** 把曲号 + 播放进度写入 localStorage，刷新后可续播 */
  persistProgress() {
    try {
      if (!this.audio) return;
      localStorage.setItem("bgMusicCurrentNum", String(this.currentNum || 1));
      const t = this.audio.currentTime;
      if (Number.isFinite(t) && t >= 0) {
        localStorage.setItem("bgMusicCurrentTime", String(Math.floor(t * 10) / 10));
      }
    } catch (e) {}
  }

  // 尽量让系统在切到其他 App/锁屏时仍显示媒体控件（真正关网页后无法继续播）
  _setupMediaSession() {
    try {
      if (!("mediaSession" in navigator)) return;
      const update = () => {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "TP音乐 · 第 " + this.currentNum + " 首",
          artist: "万锦老虎机",
          album: "Background",
        });
        navigator.mediaSession.playbackState = this.isPlaying()
          ? "playing"
          : "paused";
      };
      navigator.mediaSession.setActionHandler("play", () => {
        this.play();
        update();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        this.pause();
        update();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        this.skipPrev();
        update();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        this.skipNext();
        update();
      });
      this.audio.addEventListener("play", update);
      this.audio.addEventListener("pause", update);
      update();
    } catch (e) {}
  }

  // 须在用户手势中调用。成功则接管到 Web Audio（Gain 淡出）；失败则保持原生 <audio> 出声
  ensureAnalyser() {
    if (this._connected) {
      this._resumeCtx();
      return true;
    }
    if (this._graphFailed) return false;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this._graphFailed = true;
        return false;
      }
      if (!this.ctx) this.ctx = new AC();
      this._resumeCtx();
      if (!this._source) {
        // 每个 <audio> 只能 createMediaElementSource 一次；之后必须经 destination 才能出声
        this._source = this.ctx.createMediaElementSource(this.audio);
        // GainNode：暂停时先淡出几十毫秒，避免直接截断波形产生"啪"的爆音
        this._gain = this.ctx.createGain();
        this._gain.gain.value = 1;
        this._source.connect(this._gain);
        this._gain.connect(this.ctx.destination);
      }
      this._connected = true;
      return true;
    } catch (e) {
      // 接管失败：不破坏原生播放
      this._graphFailed = true;
      this._connected = false;
      return false;
    }
  }

  _resumeCtx() {
    if (this.ctx && this.ctx.state === "suspended") {
      const r = this.ctx.resume();
      if (r && typeof r.catch === "function") r.catch(() => {});
    }
  }

  _playAudio() {
    this._resumeCtx();
    try {
      const p = this.audio.play();
      if (p && typeof p.catch === "function") {
        // 自动播放被拦截时静默；下一次用户手势会再次尝试
        p.catch(() => {});
      }
    } catch (e) {}
  }

  isPlaying() {
    try {
      return (
        !!this.enabled &&
        !!this.audio &&
        !this.audio.paused &&
        !this.audio.ended
      );
    } catch (e) {
      return false;
    }
  }

  _loadTrack(num, opts) {
    const resume = opts && typeof opts.resumeTime === "number" ? opts.resumeTime : null;
    // 切歌时清掉旧进度；首次构造带 _resumeTime 则保留
    const seekTo =
      resume != null
        ? resume
        : this._resumeTime && this.currentNum === num
          ? this._resumeTime
          : 0;
    this._resumeTime = 0; // 只用一次

    this.currentNum = num;
    try {
      localStorage.setItem("bgMusicCurrentNum", String(num));
      if (seekTo <= 0) localStorage.setItem("bgMusicCurrentTime", "0");
    } catch (e) {}
    this.audio.src = new URL(`${num}.mp3`, BG_MUSIC_BASE).href;
    this.audio.loop = this.playMode === "single";

    if (seekTo > 0.5) {
      const applySeek = () => {
        try {
          if (this.audio.duration && seekTo < this.audio.duration - 1) {
            this.audio.currentTime = seekTo;
          }
        } catch (e) {}
      };
      // loadedmetadata / canplay 任一先到即可
      this.audio.addEventListener("loadedmetadata", applySeek, { once: true });
      this.audio.addEventListener("canplay", applySeek, { once: true });
    }

    this._notifyTrackChange();
  }

  // 曲目变化订阅：无论顺序切歌、随机切歌，还是播完自动切到下一首，
  // 只要 currentNum 改变就统一从这一处通知所有界面刷新，
  // 避免各处各自维护刷新时机、遗漏导致显示的编号和实际播放曲目不一致
  // （此前"随机播放时曲号显示错误"正是因为自动切歌 _advance() 未触发任何界面刷新）。
  onTrackChange(cb) {
    if (typeof cb !== "function") return;
    if (!this._trackChangeListeners) this._trackChangeListeners = [];
    this._trackChangeListeners.push(cb);
  }

  _notifyTrackChange() {
    if (!this._trackChangeListeners) return;
    for (const cb of this._trackChangeListeners) {
      try {
        cb(this.currentNum);
      } catch (e) {}
    }
  }

  // order: 顺序到尽头后停；all: 顺序循环；shuffle: 随机；single: 单曲循环
  _pickNext() {
    if (this.playMode === "single") {
      return this.currentNum;
    }
    if (this.playMode === "shuffle") {
      if (BG_MUSIC_MAX <= 1) return 1;
      let next;
      do {
        next = 1 + Math.floor(Math.random() * BG_MUSIC_MAX);
      } while (next === this.currentNum);
      return next;
    }
    // order / all
    return this.currentNum >= BG_MUSIC_MAX ? 1 : this.currentNum + 1;
  }

  _advance() {
    this._skipAttempts += 1;
    if (this._skipAttempts > BG_MUSIC_MAX) {
      // 连续跳过次数超过总编号数，说明目录里没有任何可用的 mp3，停止尝试避免死循环
      return;
    }
    if (this.playMode === "order" && this.currentNum >= BG_MUSIC_MAX) {
      // 顺序播放：播完最后一首后停止，不自动循环回第一首
      this._loadTrack(1);
      this.pause();
      return;
    }
    if (this.playMode === "single") {
      this.audio.currentTime = 0;
      if (this.enabled) this._playAudio();
      return;
    }
    this._loadTrack(this._pickNext());
    if (this.enabled) this._playAudio();
  }

  // mode: order / shuffle / single / all
  setPlayMode(mode) {
    if (
      mode !== "order" &&
      mode !== "shuffle" &&
      mode !== "single" &&
      mode !== "all"
    ) {
      mode = "order";
    }
    this.playMode = mode;
    this.shuffle = mode === "shuffle";
    this.audio.loop = mode === "single";
    localStorage.setItem("bgMusicPlayMode", mode);
    localStorage.setItem("bgMusicShuffle", String(this.shuffle));
  }

  skipNext() {
    this._skipAttempts = 0;
    this._resumeTime = 0;
    try { localStorage.setItem("bgMusicCurrentTime", "0"); } catch (e) {}
    this._loadTrack(this._pickNext());
    if (this.enabled) this._playAudio();
  }

  skipPrev() {
    this._skipAttempts = 0;
    this._resumeTime = 0;
    try { localStorage.setItem("bgMusicCurrentTime", "0"); } catch (e) {}
    let prev;
    if (this.shuffle) {
      prev = this._pickNext();
    } else {
      prev = this.currentNum <= 1 ? BG_MUSIC_MAX : this.currentNum - 1;
    }
    this._loadTrack(prev);
    if (this.enabled) this._playAudio();
  }

  // 显式播放（竖屏 ▶️ 键）
  async play() {
    if (!this.audio) return;
    this.ensureAnalyser();
    if (!this.enabled) {
      this.enabled = true;
      localStorage.setItem("bgMusicEnabled", "true");
    }
    this._fadeGainTo(1, 0.05);
    this._playAudio();
  }

  // 需在用户手势（点击/触摸/按键）中调用，否则浏览器会拦截自动播放
  async tryPlay() {
    if (!this.enabled) return;
    this.ensureAnalyser();
    this._fadeGainTo(1, 0.05);
    this._playAudio();
  }

  // 短暂线性淡入/淡出，避免音量突变（尤其是暂停瞬间）产生爆音/怪声
  _fadeGainTo(target, seconds) {
    if (!this._gain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const g = this._gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + seconds);
    } catch (e) {}
  }

  pause() {
    if (this._gain && this.ctx && this.ctx.state === "running") {
      // 先淡出 60ms 再真正 pause()，避免直接截断波形产生"咔"的爆音
      this._fadeGainTo(0, 0.06);
      const audioEl = this.audio;
      const gain = this._gain;
      setTimeout(() => {
        try {
          audioEl.pause();
        } catch (e) {}
        // 淡出后立刻把音量拉回 1，供下次播放使用（此时已静音，不会有声音）
        try {
          gain.gain.cancelScheduledValues(this.ctx.currentTime);
          gain.gain.setValueAtTime(1, this.ctx.currentTime);
        } catch (e) {}
      }, 70);
      return;
    }
    try {
      this.audio.pause();
    } catch (e) {}
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem("bgMusicEnabled", String(enabled));
    if (enabled) {
      this.tryPlay();
    } else {
      this.pause();
    }
  }
}

const bgMusic = new BGMusic();
