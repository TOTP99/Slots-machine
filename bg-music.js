/* 背景音乐：顺序/随机/单曲/全部循环，进度写入 localStorage 以便刷新续播 */

const BG_MUSIC_MAX = 99;
const BG_MUSIC_BASE = "https://totp99.github.io/source/mp3/";

class BGMusic {
  constructor() {
    this.currentNum = 1;
    this._skipAttempts = 0;
    this.audio = new Audio();
    this.audio.loop = false;
    this.audio.preload = "auto";
    this.audio.volume = 0.5;

    const savedEnabled = localStorage.getItem("bgMusicEnabled");
    this.enabled = savedEnabled === null ? true : savedEnabled === "true";

    const savedMode = localStorage.getItem("bgMusicPlayMode");
    const savedShuffleLegacy = localStorage.getItem("bgMusicShuffle") === "true";
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

    this.ctx = null;
    this._source = null;
    this._gain = null;
    this._connected = false;
    this._graphFailed = false;

    this.audio.addEventListener("ended", () => this._advance());
    this.audio.addEventListener("error", () => this._advance());
    this.audio.addEventListener("playing", () => {
      this._skipAttempts = 0;
    });
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

    const savedTime = parseFloat(localStorage.getItem("bgMusicCurrentTime") || "0");
    this._resumeTime =
      Number.isFinite(savedTime) && savedTime > 0.5 ? savedTime : 0;

    this._loadTrack(this.currentNum);
    this._setupMediaSession();
  }

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

  _setupMediaSession() {
    try {
      if (!("mediaSession" in navigator)) return;
      const update = () => {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "TP音乐 · 第 " + this.currentNum + " 首",
          artist: "万锦老虎机",
          album: "Background",
        });
        navigator.mediaSession.playbackState = this.isPlaying() ? "playing" : "paused";
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
        this._source = this.ctx.createMediaElementSource(this.audio);
        this._gain = this.ctx.createGain();
        this._gain.gain.value = 1;
        this._source.connect(this._gain);
        this._gain.connect(this.ctx.destination);
      }
      this._connected = true;
      return true;
    } catch (e) {
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
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (e) {}
  }

  isPlaying() {
    try {
      return !!this.enabled && !!this.audio && !this.audio.paused && !this.audio.ended;
    } catch (e) {
      return false;
    }
  }

  _loadTrack(num) {
    const seekTo =
      this._resumeTime && this.currentNum === num ? this._resumeTime : 0;
    this._resumeTime = 0;

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
      this.audio.addEventListener("loadedmetadata", applySeek, { once: true });
      this.audio.addEventListener("canplay", applySeek, { once: true });
    }

    this._notifyTrackChange();
  }

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

  _pickNext() {
    if (this.playMode === "single") return this.currentNum;
    if (this.playMode === "shuffle") {
      if (BG_MUSIC_MAX <= 1) return 1;
      let next;
      do {
        next = 1 + Math.floor(Math.random() * BG_MUSIC_MAX);
      } while (next === this.currentNum);
      return next;
    }
    return this.currentNum >= BG_MUSIC_MAX ? 1 : this.currentNum + 1;
  }

  _advance() {
    this._skipAttempts += 1;
    if (this._skipAttempts > BG_MUSIC_MAX) return;
    if (this.playMode === "order" && this.currentNum >= BG_MUSIC_MAX) {
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
    try {
      localStorage.setItem("bgMusicCurrentTime", "0");
    } catch (e) {}
    this._loadTrack(this._pickNext());
    if (this.enabled) this._playAudio();
  }

  skipPrev() {
    this._skipAttempts = 0;
    this._resumeTime = 0;
    try {
      localStorage.setItem("bgMusicCurrentTime", "0");
    } catch (e) {}
    let prev;
    if (this.shuffle) {
      prev = this._pickNext();
    } else {
      prev = this.currentNum <= 1 ? BG_MUSIC_MAX : this.currentNum - 1;
    }
    this._loadTrack(prev);
    if (this.enabled) this._playAudio();
  }

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

  async tryPlay() {
    if (!this.enabled) return;
    this.ensureAnalyser();
    this._fadeGainTo(1, 0.05);
    this._playAudio();
  }

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
      this._fadeGainTo(0, 0.06);
      const audioEl = this.audio;
      const gain = this._gain;
      setTimeout(() => {
        try {
          audioEl.pause();
        } catch (e) {}
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
    if (enabled) this.tryPlay();
    else this.pause();
  }
}

const bgMusic = new BGMusic();
