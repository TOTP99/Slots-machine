/* 数字时钟模块（横竖屏共用同一套逻辑）
   把招牌上原本的 "ROYALE" 文字盖掉，换成实时 HH:MM:SS 时钟；
   字号按 layout.js 里 clockSign 给出的宽高自动算出能放下的最大字号。
   场景 create() 时 new 一个实例，init()（场景重启前）里 destroy() 掉，
   避免横竖屏切换/重开局时残留多个 setInterval。 */

class DigitalClock {
  constructor(scene) {
    this.scene = scene;
    this.timer = null;
    this.patch = null;
    this.text = null;
    this._lastQuarterKey = null;
    this._build();
  }

  _build() {
    // 时分秒显示已去掉：不再绘制盖板与 HH:MM:SS 文字
    // 保留类结构，避免其它引用报错；整刻钟铃声与播放图标刷新一并停用
    return;
  }

  // 自动算出能塞进招牌原 "ROYALE" 位置的最大字号，再整体缩小 33%（更精致，不占满整块招牌）
  _fitFont(maxW, maxH) {
    if (!this.text) return;
    let size = Math.floor(maxH);
    this.text.setFontSize(size);
    while (this.text.width > maxW && size > 10) {
      size -= 1;
      this.text.setFontSize(size);
    }
    size = Math.max(8, Math.round(size * 0.67));
    this.text.setFontSize(size);
  }

  _tick() {
    if (!this.text) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    this.text.setText(`${hh}:${mm}:${ss}`);

    const quarterKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${Math.floor(now.getMinutes() / 15)}`;
    if (
      now.getMinutes() % 15 === 0 &&
      now.getSeconds() === 0 &&
      this._lastQuarterKey !== quarterKey
    ) {
      this._lastQuarterKey = quarterKey;
      if (this.scene.sfx) this.scene.sfx.quarterBell();
    }

    // 顺带保持左侧音乐面板的播放/暂停图标同步（原来挂在旧时钟的 250ms 刷新上）
    if (typeof this.scene.refreshPlayPauseIcon === "function") {
      this.scene.refreshPlayPauseIcon();
    }
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.patch) this.patch.destroy();
    if (this.text) this.text.destroy();
    this.patch = null;
    this.text = null;
  }
}
