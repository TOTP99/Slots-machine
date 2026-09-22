/* SlotGame 主场景 */

// ---------- 主场景 ----------
class SlotGame extends Phaser.Scene {
        constructor() {
          super("SlotGame");

          this.balance = 1000;
          this.bet = 50;
          this.minBet = 10;
          this.maxBet = 500;
          this.betStep = 10;

          this.baseJackpotValue = 25000;
          this.jackpotValue = 25800;
          this.lastWin = 0;

          this.isSpinning = false;
          this.stopRequested = false;
          this.inputLocked = false;
          this.leverState = "up"; // up | down
          this.mode = "NORMAL"; // NORMAL | FAST

          this.autoPlay = false;
          this.autoPlayRounds = 0;
          this.maxAutoPlayRounds = 5;

          this.reels = [];
          this.stoppedReelsCount = 0;
          this.sfx = new SoundFX();

          this.focusMode = false;
          this.focusHideGroup = [];

          this.speedSettings = {
            NORMAL: { duration: 1700, interval: 40, step: 18 },
            FAST: { duration: 1000, interval: 22, step: 20 },
          };
        }

        // 场景重启时重置运行期状态
        init() {
          if (this.clockTimer) {
            clearInterval(this.clockTimer);
            this.clockTimer = null;
          }
          this.reels = [];
          this.focusHideGroup = [];
          this.focusMode = false;
          this.isSpinning = false;
          this.stopRequested = false;
          this.inputLocked = false;
          this.leverState = "up";
          this.autoPlay = false;
          this.autoPlayRounds = 0;
          this.stoppedReelsCount = 0;
          this.jackpotStars = [];
          this._handFollow = false;
        }

        preload() {
          this.load.image(LAYOUT.bgKey, LAYOUT.bgFile);
          this.load.image(LAYOUT.ballKey, LAYOUT.ballFile);
          this.load.image(LAYOUT.shaftKey, LAYOUT.shaftFile);
        }

        create() {
          window.__slotGameScene = this;
          this.createBackdrop();
          this.createHeader();
          this.loadGameState();
          this.createPaytableButton();
          this.createMachine();
          this.createReels();
          this.createBottomPanels();
          this.createRightControls();
          this.createSettingsModal();
          this.createKeyboardControls();
          this.createAmbientAnimations();
          this.toggleFocusMode(true); // 默认「简」
          this.updateDisplay();
        }

}

        SlotGame.prototype.createBackdrop = function() {
          this.add.image(0, 0, LAYOUT.bgKey).setOrigin(0).setDepth(10);
        };

        SlotGame.prototype.shadeColor = function(hex, percent) {
          const c = Phaser.Display.Color.ValueToColor(hex).clone();
          if (percent >= 0) c.brighten(percent);
          else c.darken(-percent);
          return c.color;
        };

        SlotGame.prototype.drawGradientPanel = function(gfx, w, h, radius, topColor, bottomColor, fillAlpha, strokeColor, strokeWidth) {
          gfx.clear();
          gfx.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, fillAlpha);
          gfx.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
          if (strokeColor !== null && strokeWidth > 0) {
            gfx.lineStyle(strokeWidth, strokeColor, 0.95);
            gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
          }
        };

        SlotGame.prototype.setControlActive = function(bg, txt, active) {
          const fill = active ? UI.activeFill : 0x101c3a;
          const top = this.shadeColor(fill, active ? 16 : 10);
          const bottom = this.shadeColor(fill, -8);
          const stroke = active ? UI.gold : UI.goldDim;
          const w = bg._btnW || 58;
          const h = bg._btnH || 28;
          this.drawGradientPanel(bg, w, h, 8, top, bottom, 0.95, stroke, active ? 1.5 : 1);
          txt.setColor(active ? UI.textDark : UI.cream);
        };

        SlotGame.prototype.createHeader = function() {
          const J = LAYOUT.jackpot;
          const isPortrait = LAYOUT.key === "portrait";

          if (!isPortrait) {
            const pill = this.add.graphics().setPosition(J.x, J.y).setDepth(12);
            this.drawGradientPanel(pill, J.w, J.h, J.h / 2, 0x0a1838, 0x040a1c, 0.82, UI.neon, 2);
          }

          this.createJackpotSparkle(J.x, J.y, J.w - 60, J.h);

          this.jackpotText = this.add
            .text(
              J.x,
              J.y,
              `🏵️ Jackpot ${this.formatMoney(this.jackpotValue)}`,
              {
                fontSize: J.font + "px",
                fontStyle: "bold",
                fontFamily: 'Arial, sans-serif',
                color: "#f0d58a",
                stroke: "#090b0b",
                strokeThickness: 2,
                shadow: { offsetX: 0, offsetY: 2, color: "#9b7a3e", blur: 8, fill: true },
              },
            )
            .setOrigin(0.5)
            .setDepth(13);
        };

        SlotGame.prototype.createJackpotSparkle = function(cx, cy, w, h) {
          const count = 19;
          const k = LAYOUT.k;
          this.jackpotStars = [];
          for (let i = 0; i < count; i++) {
            const sx = cx - w / 2 + Phaser.Math.Between(8, w - 8);
            const sy = cy - h / 2 + Phaser.Math.Between(4, h - 4);
            const points = Phaser.Math.RND.pick([4, 4, 5]);
            const outerR = Phaser.Math.Between(3, 6) * k;
            const star = this.add
              .star(sx, sy, points, Math.max(1, outerR * 0.5), outerR, 0xfff3c4, 0.9)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(12.5);
            this.jackpotStars.push(star);
            this.twinkleStar(star);
          }
        };

        SlotGame.prototype.twinkleStar = function(star) {
          const delay = Phaser.Math.Between(0, 2200);
          const duration = Phaser.Math.Between(650, 1500);
          this.time.delayedCall(delay, () => {
            if (!star.active) return;
            this.tweens.add({
              targets: star,
              alpha: { from: 0.9, to: Phaser.Math.FloatBetween(0.1, 0.3) },
              scale: { from: 1, to: Phaser.Math.FloatBetween(0.5, 1.6) },
              duration,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          });
        };

        SlotGame.prototype.updateLiveClock = function() {
          if (!this.rightClockText) return;
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, "0");
          const mm = String(now.getMinutes()).padStart(2, "0");
          this.rightClockText.setText(`${hh}:${mm}`);

          const quarterKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${Math.floor(now.getMinutes() / 15)}`;
          if (
            now.getSeconds() === 0 &&
            now.getMilliseconds() < 1000 &&
            this.lastQuarterKey !== quarterKey
          ) {
            this.lastQuarterKey = quarterKey;
            this.sfx.quarterBell();
          }

          this.refreshPlayPauseIcon();
        };

        SlotGame.prototype.createMachine = function() {
          const L = LAYOUT;
          const F = L.frame;

          this.machineGlow = this.add
            .rectangle(F.x, F.y, F.w, F.h)
            .setStrokeStyle(6, UI.neon, 1)
            .setDepth(11);

          L.reelWindows.forEach(([x0, x1]) => {
            const w = x1 - x0;

            const back = this.add.graphics().setDepth(1);
            back.fillGradientStyle(0x030817, 0x030817, 0x0a1a44, 0x0a1a44, 1);
            back.fillRect(x0, L.reelTop, w, L.reelH);

            const shade = this.add.graphics().setDepth(4);
            const band = L.reelH * 0.16;
            shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0, 0);
            shade.fillRect(x0, L.reelTop, w, band);
            shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
            shade.fillRect(x0, L.reelBottom - band, w, band);

            if (L.dimOuterRows) {
              shade.fillStyle(0x000000, 0.42);
              shade.fillRect(x0, L.reelTop, w, L.rowH);
              shade.fillRect(x0, L.reelBottom - L.rowH, w, L.rowH);
            }
          });

          // 三条线：仅中间参与判奖
          const xL = L.reelWindows[0][0];
          const xR = L.reelWindows[L.reelWindows.length - 1][1];
          const lineW = xR - xL;
          const lineX = (xL + xR) / 2;
          const th = Math.max(2, Math.round(L.k * 1.6));

          this.paylineTop = this.add
            .rectangle(lineX, L.reelY - L.rowH, lineW, th, 0x7fdcff, 0.7)
            .setDepth(2);
          this.paylineMiddle = this.add
            .rectangle(lineX, L.reelY, lineW, th * 2, 0xbfeaff, 0.88)
            .setDepth(2);
          this.paylineBottom = this.add
            .rectangle(lineX, L.reelY + L.rowH, lineW, th, 0x7fdcff, 0.7)
            .setDepth(2);
        };

        SlotGame.prototype.setReelFrameStroke = function(reel, strokeWidth, strokeColor) {
          if (!reel || !reel.frame) return;
          const g = reel.frame;
          const L = LAYOUT;
          g.clear();
          g.lineStyle(strokeWidth * 3, strokeColor, 0.16);
          g.strokeRect(reel.x0, L.reelTop, reel.w, L.reelH);
          g.lineStyle(strokeWidth, strokeColor, strokeWidth <= 2 ? 0.55 : 0.95);
          g.strokeRect(reel.x0 + 1, L.reelTop + 1, reel.w - 2, L.reelH - 2);
        };

        SlotGame.prototype.createReels = function() {
          const L = LAYOUT;
          const N = L.itemN;

          L.reelWindows.forEach(([x0, x1], reelIndex) => {
            const w = x1 - x0;
            const x = (x0 + x1) / 2;

            const frame = this.add.graphics().setDepth(11);

            const maskShape = this.add.graphics();
            maskShape.fillStyle(0xffffff);
            maskShape.fillRect(x0, L.reelTop, w, L.reelH);

            const mask = maskShape.createGeometryMask();
            maskShape.setVisible(false);

            const container = this.add.container(x, L.reelY).setDepth(3);
            container.setMask(mask);

            const items = [];

            for (let i = -N; i <= N; i++) {
              const symbol = Phaser.Utils.Array.GetRandom(SYMBOLS);

              const bg = this.add
                .circle(0, i * L.rowH, L.discR, 0x000000, 0.5)
                .setStrokeStyle(2, 0x2b6cff, 0.45);

              const txt = this.add
                .text(0, i * L.rowH, symbol.label, {
                  fontSize: L.symFont + "px",
                  fontStyle: "bold",
                  color: symbol.color,
                  stroke: "#090b0b",
                  strokeThickness: Math.max(2, Math.round(L.symFont * 0.05)),
                  shadow: {
                    offsetX: 0,
                    offsetY: Math.round(L.symFont * 0.04),
                    color: "#000000",
                    blur: Math.round(L.symFont * 0.07),
                    fill: true,
                  },
                })
                .setOrigin(0.5);

              container.add([bg, txt]);
              items.push({ bg, txt, symbol });
            }

            const reel = {
              frame,
              container,
              items,
              value: SYMBOLS[reelIndex],
              intervalEvent: null,
              stopped: true,
              forceStopScheduled: false,
              x0,
              w,
            };
            this.reels.push(reel);
            this.setReelFrameStroke(reel, 2, UI.neon);
          });
        };

        SlotGame.prototype.createBottomPanels = function() {
          const P = LAYOUT.plates;
          const M = LAYOUT.msg;

          const labelStyle = {
            fontSize: P.labelFont + "px",
            fontStyle: "bold",
            fontFamily: "Arial, sans-serif",
            color: "#4fc3ff",
            stroke: "#021028",
            strokeThickness: 3,
            letterSpacing: 2,
          };
          const valueStyle = {
            fontSize: P.valueFont + "px",
            fontStyle: "bold",
            fontFamily: "Arial, sans-serif",
            color: "#fff3c4",
            stroke: "#021028",
            strokeThickness: 4,
            shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 6, fill: true },
          };

          const make = (i, label, value) => {
            this.add
              .text(P.xs[i], P.y + P.labelDy, label, labelStyle)
              .setOrigin(0.5)
              .setDepth(12);
            return this.add
              .text(P.xs[i], P.y + P.valueDy, value, valueStyle)
              .setOrigin(0.5)
              .setDepth(12);
          };

          this.balanceValue = make(0, "BALANCE", this.formatInt(this.balance));
          this.betValue = make(1, "BET", this.formatInt(this.bet));
          this.lastWinValue = make(2, "LAST WIN", this.formatInt(this.lastWin));

          const arrow = (x, glyph, delta) => {
            const t = this.add
              .text(x, P.y, glyph, {
                fontSize: "34px",
                fontStyle: "bold",
                color: "#4fc3ff",
                stroke: "#021028",
                strokeThickness: 3,
              })
              .setOrigin(0.5)
              .setDepth(13);
            const hit = this.add
              .rectangle(x, P.y, 70, 80, 0x000000, 0.001)
              .setDepth(14)
              .setInteractive({ useHandCursor: true });
            hit.on("pointerover", () => t.setScale(1.2));
            hit.on("pointerout", () => t.setScale(1));
            hit.on("pointerdown", (p, lx, ly, e) => {
              if (e) e.stopPropagation();
              this.changeBet(delta);
            });
          };
          arrow(P.xs[1] - P.arrowDx, "◀", -this.betStep);
          arrow(P.xs[1] + P.arrowDx, "▶", this.betStep);

          const pill = this.add.graphics().setPosition(M.x, M.y).setDepth(12);
          this.drawGradientPanel(pill, M.w, M.h, M.h / 2, 0x0a1838, 0x040a1c, 0.62, UI.neon, 1.5);

          this.messageText = this.add
            .text(M.x, M.y, "READY TO SPIN", {
              fontSize: 16 * LAYOUT.msgScale + "px",
              fontStyle: "bold",
              fontFamily: "Arial, sans-serif",
              color: "#e8f1ff",
              align: "center",
            })
            .setOrigin(0.5)
            .setDepth(13);
        };

        SlotGame.prototype.createPaytableButton = function() {
          const _dockStart = this.focusHideGroup.length;
          const x = LAYOUT.paytableX;
          const y = LAYOUT.paytableY;
          const w = LAYOUT.paytableW;
          const h = LAYOUT.paytableH;

          // 赌场风面板：酒红丝绒底 + 双层金边 + 四角金点
          const dockPanel = this.add.graphics().setPosition(x, y);
          dockPanel.fillGradientStyle(0x2a0a14, 0x2a0a14, 0x0c060a, 0x0c060a, 0.96);
          dockPanel.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
          dockPanel.lineStyle(2, 0xffd700, 0.95);
          dockPanel.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
          dockPanel.lineStyle(1, 0xc9a227, 0.65);
          dockPanel.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 11);
          const cdot = (ox, oy) => {
            dockPanel.fillStyle(0xffd700, 0.85);
            dockPanel.fillCircle(ox, oy, 2.5);
          };
          const inset = 10;
          cdot(-w / 2 + inset, -h / 2 + inset);
          cdot(w / 2 - inset, -h / 2 + inset);
          cdot(-w / 2 + inset, h / 2 - inset);
          cdot(w / 2 - inset, h / 2 - inset);
          this.focusHideGroup.push(dockPanel);

          this.updateLiveClock();
          this.clockTimer = setInterval(() => this.updateLiveClock(), 250);

          const iconFont = 50;
          const iconHalf = iconFont * 0.55;
          const topSafe = 14;
          const frameH = 52;
          const bottomSafe = 14;
          const SPACING_SCALE = 0.75;
          const REFERENCE_PANEL_H = 306;
          const fullContentSpan = REFERENCE_PANEL_H - topSafe - bottomSafe - 2;
          const contentSpan = fullContentSpan * SPACING_SCALE;
          const contentTop = y - contentSpan / 2;
          const contentBottom = y + contentSpan / 2;

          const micY = contentTop + iconHalf;
          const btnCenterY = contentBottom - frameH / 2;
          const midTop = micY + iconHalf + 10 * SPACING_SCALE;
          const midBottom = btnCenterY - frameH / 2 - 10 * SPACING_SCALE;
          const midSpan = Math.max(midBottom - midTop, 1);
          const tY = midTop + midSpan * 0.32;
          const trackY = midTop + midSpan * 0.72;

          const micIcon = this.add
            .text(x, micY, "🎏", { fontSize: iconFont + "px" })
            .setOrigin(0.5);
          this.focusHideGroup.push(micIcon);

          const ctrlGap = Math.min(50, w * 0.27);

          const prevBtn = this.add
            .text(x - ctrlGap, tY, "⏮️", { fontSize: "30px" })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
          prevBtn.on("pointerdown", () => {
            this.sfx.click();
            bgMusic.skipPrev();
            this.saveGameState();
          });
          prevBtn.on("pointerover", () => prevBtn.setScale(1.1));
          prevBtn.on("pointerout", () => prevBtn.setScale(1));
          this.focusHideGroup.push(prevBtn);

          this.sidePlayPauseBtn = this.add
            .text(x, tY, bgMusic.isPlaying() ? "⏸️" : "▶️", { fontSize: "30px" })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
          this.sidePlayPauseBtn.on("pointerdown", () => {
            this.sfx.click();
            if (bgMusic.isPlaying()) {
              bgMusic.pause();
            } else {
              bgMusic.play();
            }
            this.refreshPlayPauseIcon();
            this.saveGameState();
          });
          this.sidePlayPauseBtn.on("pointerover", () =>
            this.sidePlayPauseBtn.setScale(1.1),
          );
          this.sidePlayPauseBtn.on("pointerout", () =>
            this.sidePlayPauseBtn.setScale(1),
          );
          this.focusHideGroup.push(this.sidePlayPauseBtn);

          const nextBtn = this.add
            .text(x + ctrlGap, tY, "⏭️", { fontSize: "30px" })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
          nextBtn.on("pointerdown", () => {
            this.sfx.click();
            bgMusic.skipNext();
            this.saveGameState();
          });
          nextBtn.on("pointerover", () => nextBtn.setScale(1.1));
          nextBtn.on("pointerout", () => nextBtn.setScale(1));
          this.focusHideGroup.push(nextBtn);

          this.sideTrackLabel = this.add
            .text(x, trackY, "01 / 99", {
              fontSize: "18px",
              fontStyle: "bold",
              color: "#ffd700",
              stroke: "#1a0808",
              strokeThickness: 2,
            })
            .setOrigin(0.5);
          this.focusHideGroup.push(this.sideTrackLabel);
          this.refreshTrackLabel();
          if (typeof bgMusic.onTrackChange === "function") {
            bgMusic.onTrackChange(() => this.refreshTrackLabel());
          }

          const frameW = Math.round((w - 24) * 0.9);
          const frame = this.add.graphics().setPosition(x, btnCenterY);
          const drawCtrlFrame = (hover) => {
            frame.clear();
            frame.fillGradientStyle(
              hover ? 0x3d1520 : 0x2a0a14,
              hover ? 0x3d1520 : 0x2a0a14,
              hover ? 0x1a0a10 : 0x0c060a,
              hover ? 0x1a0a10 : 0x0c060a,
              0.95,
            );
            frame.fillRoundedRect(-frameW / 2, -frameH / 2, frameW, frameH, 12);
            frame.lineStyle(hover ? 2.2 : 1.6, 0xffd700, hover ? 1 : 0.9);
            frame.strokeRoundedRect(-frameW / 2, -frameH / 2, frameW, frameH, 12);
            frame.lineStyle(1, 0xc9a227, 0.55);
            frame.strokeRoundedRect(-frameW / 2 + 3, -frameH / 2 + 3, frameW - 6, frameH - 6, 10);
          };
          drawCtrlFrame(false);
          frame.setInteractive(
            new Phaser.Geom.Rectangle(-frameW / 2, -frameH / 2, frameW, frameH),
            Phaser.Geom.Rectangle.Contains,
          );
          if (frame.input) frame.input.cursor = "pointer";

          const ctrlLabel = this.add
            .text(x, btnCenterY, "PAYTABLE\nSETTING", {
              fontSize: "15px",
              fontStyle: "bold",
              color: "#ffd700",
              align: "center",
              lineSpacing: 4,
              stroke: "#1a0808",
              strokeThickness: 1,
            })
            .setOrigin(0.5);

          const openCtrl = () => {
            this.sfx.click();
            this.toggleSettingsModal(true);
          };
          frame.on("pointerdown", openCtrl);
          frame.on("pointerover", () => {
            drawCtrlFrame(true);
            ctrlLabel.setScale(1.05);
          });
          frame.on("pointerout", () => {
            drawCtrlFrame(false);
            ctrlLabel.setScale(1);
          });
          ctrlLabel.setInteractive({ useHandCursor: true });
          ctrlLabel.on("pointerdown", openCtrl);
          this.focusHideGroup.push(frame, ctrlLabel);

          const dk = LAYOUT.dock;
          this.dockContainer = this.wrapInScaledContainer(
            this.focusHideGroup.slice(_dockStart),
            x, y, dk.x, dk.y, dk.k, 20,
          );
        };

        // 把一批已创建的对象装进容器：以 (ox,oy) 为原坐标中心，放大 k 倍后落在 (tx,ty)
        SlotGame.prototype.wrapInScaledContainer = function(items, ox, oy, tx, ty, k, depth) {
          const c = this.add.container(tx - ox * k, ty - oy * k).setScale(k).setDepth(depth);
          const list = items.filter(Boolean);
          list.forEach((o) => {
            if (o.type === "Text" && o.setResolution) o.setResolution(Math.min(4, Math.ceil(k * 2)));
          });
          c.add(list);
          return c;
        };

        SlotGame.prototype.refreshTrackLabel = function() {
          if (!this.sideTrackLabel) return;
          const n = bgMusic.currentNum || 1;
          this.sideTrackLabel.setText(
            String(n).padStart(2, "0") +
              " / " +
              String(BG_MUSIC_MAX).padStart(2, "0"),
          );
        };

        SlotGame.prototype.refreshPlayPauseIcon = function() {
          if (!this.sidePlayPauseBtn) return;
          this.sidePlayPauseBtn.setText(bgMusic.isPlaying() ? "⏸️" : "▶️");
        };

        SlotGame.prototype.createRightControls = function() {
          const L = LAYOUT.lever;

          this.createRightClockToggle(855);
          const ck = LAYOUT.clock;
          this.clockContainer = this.wrapInScaledContainer(
            [
              this.rightClockShadow,
              this.rightClockToggleBg,
              this.rightClockHighlight,
              this.rightClockText,
              this.modeChipBg,
              this.modeLabelSimple,
              this.modeLabelComplex,
              this.rightClockRay,
              this.rightClockToggleHit,
            ],
            855, 165, ck.x, ck.y, ck.k, 20,
          );

          this.leverShaft = this.add
            .image(L.shaftX, L.baseY, LAYOUT.shaftKey)
            .setOrigin(0.5, 1)
            .setDepth(12);
          this._shaftW = this.leverShaft.width;

          this.leverGlow = this.add
            .circle(L.ballX, L.ballY, L.ballR + 12, UI.neon, 1)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0)
            .setDepth(12.5);

          const ballTex = this.textures.get(LAYOUT.ballKey).getSourceImage();
          const ballBoxX0 = L.ballX - ballTex.width / 2; // 抠图以球心为水平中心
          this.leverBall = this.add
            .image(L.ballX, L.ballY, LAYOUT.ballKey)
            .setOrigin(
              (L.ballX - ballBoxX0) / ballTex.width,
              (L.ballY - (L.collarBottom - ballTex.height)) / ballTex.height,
            )
            .setDepth(13);

          this._leverTw = { p: 0 };

          this.leverHand = this.add
            .text(L.restX, L.restY, "✋", { fontSize: L.handFont + "px" })
            .setOrigin(0.35, 0.35)
            .setAlpha(0)
            .setDepth(20)
            .setAngle(-25);

          this.leverHit = this.add
            .rectangle(L.hit.x, L.hit.y, L.hit.w, L.hit.h, 0x000000, 0.01)
            .setDepth(14)
            .setInteractive({ useHandCursor: true });

          this.leverHit.on("pointerdown", () => {
            this.sfx.init();
            this.sfx.warmup();
            this.handleSpinInput();
          });
          this.leverHit.on("pointerover", () => {
            if (this.leverState === "up" && !this.isSpinning) {
              this.leverGlow.setAlpha(0.3);
            }
          });
          this.leverHit.on("pointerout", () => {
            if (this.leverState !== "down") this.leverGlow.setAlpha(0);
          });

          this.setLeverProgress(0);
        };

        SlotGame.prototype.setLeverProgress = function(p) {
          const L = LAYOUT.lever;
          if (!this.leverBall || !this.leverShaft) return;

          const ballY = L.ballY + L.drop * p;
          const s = 1 + 0.12 * Math.max(0, p);
          this.leverBall.setPosition(L.ballX, ballY).setScale(s);
          if (this.leverGlow) this.leverGlow.setPosition(L.ballX, ballY).setScale(s);

          const collarBottom = ballY + (L.collarBottom - L.ballY) * s;
          this.leverShaft.setDisplaySize(
            this._shaftW,
            Math.max(6, L.baseY - collarBottom + 4),
          );

          if (this._handFollow && this.leverHand) {
            this.leverHand.setPosition(
              L.ballX + L.gripDx,
              ballY + L.gripDy + L.ballR * 0.3 * Math.max(0, p),
            );
            this.leverHand.setAngle(-4 + 36 * Math.max(0, p));
            this.leverHand.setScale(0.96 - 0.08 * Math.max(0, p));
          }
        };

        SlotGame.prototype.drawRoundedPanel = function(gfx, w, h, radius, strokeColor, strokeWidth, fillColor, fillAlpha = 1) {
          gfx.clear();
          gfx.fillStyle(fillColor, fillAlpha);
          gfx.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
          gfx.lineStyle(strokeWidth, strokeColor, 1);
          gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
        };

        SlotGame.prototype.createRightClockToggle = function(lx) {
          const btnW = 76;
          const btnH = 82;
          const cy = 165;
          const clockY = cy - 14;
          const modeY = cy + 22;
          const btnRadius = 14;
          const modeHalf = 16;
          const chipW = 28;
          const chipH = 20;
          const chipR = 7;

          this._clockModeHalf = modeHalf;
          this._clockChipW = chipW;
          this._clockChipH = chipH;
          this._clockChipR = chipR;
          this._clockBtnW = btnW;
          this._clockBtnH = btnH;
          this._clockBtnR = btnRadius;

          this.rightClockShadow = this.add.graphics().setPosition(lx + 2, cy + 3);
          this.rightClockShadow.fillStyle(0x000000, 0.45);
          this.rightClockShadow.fillRoundedRect(
            -btnW / 2, -btnH / 2, btnW, btnH, btnRadius,
          );

          this.rightClockToggleBg = this.add.graphics().setPosition(lx, cy);
          this._drawClockButton3D(false);

          this.rightClockHighlight = this.add.graphics().setPosition(lx, cy);
          this.rightClockHighlight.fillStyle(0xffffff, 0.12);
          this.rightClockHighlight.fillRoundedRect(
            -btnW / 2 + 4, -btnH / 2 + 3, btnW - 8, Math.max(10, btnH * 0.28), btnRadius - 4,
          );

          this.rightClockText = this.add
            .text(lx, clockY, "--:--", {
              fontSize: "21px",
              fontStyle: "bold",
              color: "#ffd700",
              stroke: "#000000",
              strokeThickness: 1,
              shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 4, fill: true },
            })
            .setOrigin(0.5);

          this.modeChipBg = this.add.graphics().setPosition(lx, modeY);

          this.modeLabelSimple = this.add
            .text(lx - modeHalf, modeY, "简", {
              fontSize: "13px",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 1,
            })
            .setOrigin(0.5);

          this.modeLabelComplex = this.add
            .text(lx + modeHalf, modeY, "繁", {
              fontSize: "13px",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 1,
            })
            .setOrigin(0.5);

          this.refreshModeLabel();

          this.rightClockRay = this.add.graphics().setPosition(lx, cy).setAlpha(0).setDepth(21);

          this.rightClockToggleHit = this.add
            .rectangle(lx, cy, btnW, btnH, 0x000000, 0.01)
            .setInteractive({ useHandCursor: true });

          this.rightClockToggleHit.on("pointerover", () => {
            this._drawClockButton3D(true);
          });
          this.rightClockToggleHit.on("pointerout", () => {
            this._drawClockButton3D(false);
          });
          this.rightClockToggleHit.on("pointerdown", () => {
            this.sfx.click();
            this.tweens.add({
              targets: [
                this.rightClockToggleBg,
                this.rightClockHighlight,
                this.rightClockShadow,
                this.rightClockText,
                this.modeChipBg,
                this.modeLabelSimple,
                this.modeLabelComplex,
              ],
              scaleX: 0.92,
              scaleY: 0.92,
              duration: 70,
              yoyo: true,
              ease: "Sine.easeInOut",
            });
            this._burstClockRays(lx, cy);
            this.toggleFocusMode();
          });
        };

        SlotGame.prototype._drawClockButton3D = function(hover) {
          const g = this.rightClockToggleBg;
          if (!g) return;
          const w = this._clockBtnW || 76;
          const h = this._clockBtnH || 82;
          const r = this._clockBtnR || 14;
          g.clear();
          g.fillGradientStyle(
            hover ? 0x1a2a4a : 0x121c36,
            hover ? 0x1a2a4a : 0x121c36,
            hover ? 0x0a1020 : 0x080e1c,
            hover ? 0x0a1020 : 0x080e1c,
            0.96,
          );
          g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
          g.lineStyle(hover ? 3.2 : 2.2, UI.ruby, 1);
          g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
          g.lineStyle(1, UI.gold, hover ? 0.85 : 0.55);
          g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, Math.max(4, r - 3));
        };

        SlotGame.prototype._burstClockRays = function(cx, cy) {
          const ray = this.rightClockRay;
          if (!ray) return;
          ray.clear();
          ray.setPosition(cx, cy);
          ray.setAlpha(1);
          const rays = 12;
          for (let i = 0; i < rays; i++) {
            const a = (Math.PI * 2 * i) / rays + Math.random() * 0.15;
            const len = 28 + Math.random() * 36;
            const c = i % 2 === 0 ? 0xffd700 : 0x39b8ff;
            ray.lineStyle(2, c, 0.95);
            ray.beginPath();
            ray.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
            ray.lineTo(Math.cos(a) * len, Math.sin(a) * len);
            ray.strokePath();
          }
          ray.fillStyle(0xffd700, 0.35);
          ray.fillCircle(0, 0, 16);
          ray.fillStyle(0xffffff, 0.2);
          ray.fillCircle(0, 0, 8);

          this.tweens.killTweensOf(ray);
          ray.setScale(0.6);
          this.tweens.add({
            targets: ray,
            alpha: 0,
            scale: 1.55,
            duration: 380,
            ease: "Cubic.easeOut",
            onComplete: () => {
              ray.clear();
              ray.setAlpha(0);
              ray.setScale(1);
            },
          });
        };

        SlotGame.prototype.createSettingsModal = function() {
          const cx = LAYOUT.width / 2;
          const cy = LAYOUT.height / 2;
          const panelW = 560;
          const panelH = 400;
          const top = cy - panelH / 2;

          this.settingsModalGroup = this.add
            .container(0, 0)
            .setDepth(100)
            .setVisible(false);

          const children = [];

          const overlayKey = "settingsOverlayGradient";
          if (this.textures.exists(overlayKey)) this.textures.remove(overlayKey);
          if (!this.textures.exists(overlayKey)) {
            const rt = this.textures.createCanvas(overlayKey, LAYOUT.width, LAYOUT.height);
            const ctx = rt.getContext();
            const grad = ctx.createRadialGradient(
              cx, cy, 0,
              cx, cy, Math.hypot(cx, cy),
            );
            grad.addColorStop(0, "rgba(0,0,0,0.32)");
            grad.addColorStop(0.55, "rgba(0,0,0,0.6)");
            grad.addColorStop(1, "rgba(0,0,0,0.86)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, LAYOUT.width, LAYOUT.height);
            rt.refresh();
          }
          const overlay = this.add
            .image(0, 0, overlayKey)
            .setOrigin(0)
            .setInteractive();
          overlay.on("pointerdown", () => this.toggleSettingsModal(false));
          children.push(overlay);

          const modalGlow = this.add.graphics().setPosition(cx, cy);
          modalGlow.fillStyle(0xffd700, 0.06);
          modalGlow.fillRoundedRect(-(panelW + 18) / 2, -(panelH + 18) / 2, panelW + 18, panelH + 18, 26);
          modalGlow.lineStyle(2, 0xffd700, 0.35);
          modalGlow.strokeRoundedRect(-(panelW + 14) / 2, -(panelH + 14) / 2, panelW + 14, panelH + 14, 24);
          modalGlow.lineStyle(1, 0x39b8ff, 0.25);
          modalGlow.strokeRoundedRect(-(panelW + 22) / 2, -(panelH + 22) / 2, panelW + 22, panelH + 22, 28);
          children.push(modalGlow);

          const panelVisual = this.add.graphics().setPosition(cx, cy);
          panelVisual.fillGradientStyle(0x2a0a14, 0x2a0a14, 0x0c060a, 0x0c060a, 0.98);
          panelVisual.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
          panelVisual.lineStyle(2.5, 0xffd700, 0.95);
          panelVisual.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
          panelVisual.lineStyle(1, 0xc9a227, 0.7);
          panelVisual.strokeRoundedRect(-panelW / 2 + 5, -panelH / 2 + 5, panelW - 10, panelH - 10, 16);
          const corner = (ox, oy) => {
            panelVisual.fillStyle(0xffd700, 0.85);
            panelVisual.fillCircle(ox, oy, 3);
            panelVisual.lineStyle(1.2, 0xffd700, 0.6);
            panelVisual.strokeCircle(ox, oy, 7);
          };
          const inset = 14;
          corner(-panelW / 2 + inset, -panelH / 2 + inset);
          corner(panelW / 2 - inset, -panelH / 2 + inset);
          corner(-panelW / 2 + inset, panelH / 2 - inset);
          corner(panelW / 2 - inset, panelH / 2 - inset);
          children.push(panelVisual);

          const titleBar = this.add.graphics().setPosition(cx, top + 22);
          titleBar.fillGradientStyle(0x3d1520, 0x3d1520, 0x1a0a10, 0x1a0a10, 0.9);
          titleBar.fillRoundedRect(-140, -14, 280, 28, 8);
          titleBar.lineStyle(1, 0xffd700, 0.7);
          titleBar.strokeRoundedRect(-140, -14, 280, 28, 8);
          children.push(titleBar);
          children.push(
            this.add
              .text(cx, top + 22, "✦ ROYALE LOUNGE ✦", {
                fontSize: "15px",
                fontStyle: "bold",
                fontFamily: "Arial, sans-serif",
                color: "#ffd700",
                stroke: "#1a0808",
                strokeThickness: 2,
              })
              .setOrigin(0.5),
          );

          const panel = this.add
            .rectangle(cx, cy, panelW, panelH, 0x000000, 0.001)
            .setInteractive();
          panel.on("pointerdown", (pointer, lx, ly, event) => {
            event.stopPropagation();
          });
          children.push(panel);

          const pad = 22;
          const leftX = cx - panelW / 2 + pad;
          const rightX = cx + panelW / 2 - pad;
          const dividerX = cx - 28;

          // 左：赔率表（无列标题）；整块内容在面板内垂直居中
          const payRows = [
            ["7️⃣7️⃣7️⃣", "×50"],
            ["🌸🌸🌸", "×20"],
            ["🌺🌺🌺", "×15"],
            ["🍇🍇🍇", "×10"],
            ["🍓🍓🍓", "×8"],
            ["🍒🍒🍒", "×6"],
            ["🍄🍄🍄", "×4"],
            ["Any pair", "×2"],
          ];
          const paySpacing = 40;
          const contentSpan = (payRows.length - 1) * paySpacing;
          const payStart = top + 42 + (panelH - 52 - contentSpan) / 2;
          payRows.forEach((row, i) => {
            const ry = payStart + i * paySpacing;
            children.push(
              this.add
                .text(leftX + 7, ry, row[0], {
                  fontSize: "18px",
                  color: "#e8dcc0",
                })
                .setOrigin(0, 0.5),
            );
            children.push(
              this.add
                .text(dividerX - 12, ry, row[1], {
                  fontSize: "14px",
                  fontStyle: "bold",
                  color: "#ffd700",
                })
                .setOrigin(1, 0.5),
            );
          });

          children.push(
            this.add
              .rectangle(dividerX, cy, 1, panelH - 48, UI.gold, 0.22)
              .setOrigin(0.5),
          );

          const makeOptionButton = (bx, by, label) => {
            const w = 58;
            const h = 28;
            const bg = this.add.graphics().setPosition(bx, by);
            bg._btnW = w;
            bg._btnH = h;
            this.drawGradientPanel(
              bg,
              w,
              h,
              8,
              this.shadeColor(0x101c3a, 10),
              this.shadeColor(0x101c3a, -8),
              0.95,
              UI.goldDim,
              1,
            );
            bg.setInteractive(
              new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
              Phaser.Geom.Rectangle.Contains,
            );
            if (bg.input) bg.input.cursor = "pointer";
            const txt = this.add
              .text(bx, by, label, {
                fontSize: "13px",
                color: "#e8dcc0",
              })
              .setOrigin(0.5);
            children.push(bg, txt);
            return { bg, txt };
          };

          // 通用：给一个文字/图标叠加一个更大的隐形热区，扩大点击范围，
          // 并统一处理悬停放大反馈 + 按下音效，避免每处再各自重复实现。
          const addHitZone = (visual, bx, by, w, h, sound, onDown) => {
            const hit = this.add
              .rectangle(bx, by, w, h, 0x000000, 0.001)
              .setInteractive({ useHandCursor: true });
            hit.on("pointerover", () => visual.setScale(1.15));
            hit.on("pointerout", () => visual.setScale(1));
            hit.on("pointerdown", (p, lx, ly, e) => {
              if (e) e.stopPropagation();
              if (sound) sound();
              onDown();
            });
            children.push(hit);
            return hit;
          };

          const rowLabelX = dividerX + 16;
          const optAX = cx + 66;
          const optBX = cx + 146;
          const boxCenterX = cx + 106;

          let rowY = payStart;
          children.push(
            this.add
              .text(rowLabelX, rowY, "SPEED", {
                fontSize: "14px",
                fontStyle: "bold",
                color: "#ffd700",
              })
              .setOrigin(0, 0.5),
          );
          const normalOpt = makeOptionButton(optAX, rowY, "NORMAL");
          const fastOpt = makeOptionButton(optBX, rowY, "FAST");
          this.speedButtons = [
            { label: "NORMAL", btn: normalOpt.bg, txt: normalOpt.txt },
            { label: "FAST", btn: fastOpt.bg, txt: fastOpt.txt },
          ];
          normalOpt.bg.on("pointerdown", (p, lx, ly, e) => {
            e.stopPropagation();
            this.mode = "NORMAL";
            this.sfx.click();
            this.updateSpeedButtons();
            this.saveGameState();
          });
          fastOpt.bg.on("pointerdown", (p, lx, ly, e) => {
            e.stopPropagation();
            this.mode = "FAST";
            this.sfx.click();
            this.updateSpeedButtons();
            this.saveGameState();
          });
          this.updateSpeedButtons();

          rowY += 56;
          children.push(
            this.add
              .text(rowLabelX, rowY, "AUTO", {
                fontSize: "14px",
                fontStyle: "bold",
                color: "#ffd700",
              })
              .setOrigin(0, 0.5),
          );
          const autoYesOpt = makeOptionButton(optAX, rowY, "YES");
          const autoNoOpt = makeOptionButton(optBX, rowY, "NO");
          this.autoYesButton = autoYesOpt;
          this.autoNoButton = autoNoOpt;
          autoYesOpt.bg.on("pointerdown", (p, lx, ly, e) => {
            e.stopPropagation();
            if (!this.autoPlay) {
              this.sfx.click();
              this.toggleAutoPlay();
            }
          });
          autoNoOpt.bg.on("pointerdown", (p, lx, ly, e) => {
            e.stopPropagation();
            if (this.autoPlay) {
              this.sfx.click();
              this.toggleAutoPlay();
            }
          });
          this.updateAutoOptionButtons();

          rowY += 56;
          children.push(
            this.add
              .text(rowLabelX, rowY, "SOUND", {
                fontSize: "14px",
                fontStyle: "bold",
                color: "#ffd700",
              })
              .setOrigin(0, 0.5),
          );
          const soundOnOpt = makeOptionButton(optAX, rowY, "ON");
          const soundOffOpt = makeOptionButton(optBX, rowY, "OFF");
          this.soundOnButton = soundOnOpt;
          this.soundOffButton = soundOffOpt;
          soundOnOpt.bg.on("pointerdown", (p, lx, ly, e) => {
            e.stopPropagation();
            if (!this.sfx.enabled) {
              this.sfx.enabled = true;
              this.sfx.click();
              this.updateSoundOptionButtons();
              this.saveGameState();
            }
          });
          soundOffOpt.bg.on("pointerdown", (p, lx, ly, e) => {
            e.stopPropagation();
            if (this.sfx.enabled) {
              this.sfx.click();
              this.sfx.enabled = false;
              this.updateSoundOptionButtons();
              this.saveGameState();
            }
          });
          this.updateSoundOptionButtons();

          rowY += 52;
          children.push(
            this.add
              .rectangle(boxCenterX, rowY, rightX - dividerX - 10, 1, UI.gold, 0.22)
              .setOrigin(0.5),
          );

          // 投注：文字标签 / 数值框 / +− 按钮均放大 125%，行距均匀、左右留白充足
          rowY += 56;
          const betRowY = rowY;
          children.push(
            this.add
              .text(rowLabelX, betRowY, "BET", {
                fontSize: "18px",
                fontStyle: "bold",
                color: "#ffd700",
              })
              .setOrigin(0, 0.5),
          );
          const bigBoxCenterX = boxCenterX + 34;
          const betBoxX = bigBoxCenterX;
          const betBoxGfx = this.add.graphics().setPosition(betBoxX, betRowY);
          this.drawGradientPanel(
            betBoxGfx,
            155,
            38,
            9,
            this.shadeColor(0x0a0806, 10),
            this.shadeColor(0x0a0806, -6),
            0.95,
            UI.goldDim,
            1,
          );
          children.push(betBoxGfx);
          const betMinus = this.add
            .text(betBoxX - 55, betRowY, "−", {
              fontSize: "22px",
              color: "#ffd700",
              fontStyle: "bold",
            })
            .setOrigin(0.5);
          const betPlus = this.add
            .text(betBoxX + 55, betRowY, "+", {
              fontSize: "22px",
              color: "#ffd700",
              fontStyle: "bold",
            })
            .setOrigin(0.5);
          this.modalBetValue = this.add
            .text(betBoxX, betRowY, this.formatInt(this.bet), {
              fontSize: "19px",
              color: "#ffd700",
              fontStyle: "bold",
            })
            .setOrigin(0.5);
          children.push(betMinus, betPlus, this.modalBetValue);
          // 命中范围放大到 44×44，明显比原本紧贴文字的热区更容易点中；按下有声效
          addHitZone(betMinus, betBoxX - 55, betRowY, 44, 44, () => this.sfx.click(), () => {
            this.changeBet(-this.betStep);
            if (this.modalBetValue)
              this.modalBetValue.setText(this.formatInt(this.bet));
          });
          addHitZone(betPlus, betBoxX + 55, betRowY, 44, 44, () => this.sfx.click(), () => {
            this.changeBet(this.betStep);
            if (this.modalBetValue)
              this.modalBetValue.setText(this.formatInt(this.bet));
          });

          // 筹码：与投注同比例放大 125%，与 BET 行保持清晰间距
          rowY += 58;
          children.push(
            this.add
              .text(rowLabelX, rowY, "CHIPS", {
                fontSize: "18px",
                fontStyle: "bold",
                color: "#ffd700",
              })
              .setOrigin(0, 0.5),
          );
          const chipBoxGfx = this.add.graphics().setPosition(betBoxX, rowY);
          this.drawGradientPanel(
            chipBoxGfx,
            170,
            38,
            9,
            this.shadeColor(0x0a0806, 10),
            this.shadeColor(0x0a0806, -6),
            0.95,
            UI.goldDim,
            1,
          );
          children.push(chipBoxGfx);
          const chipMinus = this.add
            .text(betBoxX - 64, rowY, "−", {
              fontSize: "22px",
              color: "#ffd700",
              fontStyle: "bold",
            })
            .setOrigin(0.5);
          const chipPlus = this.add
            .text(betBoxX + 64, rowY, "+", {
              fontSize: "22px",
              color: "#ffd700",
              fontStyle: "bold",
            })
            .setOrigin(0.5);
          children.push(
            this.add
              .text(betBoxX, rowY, "1000", {
                fontSize: "19px",
                color: "#ffd700",
                fontStyle: "bold",
              })
              .setOrigin(0.5),
          );
          children.push(chipMinus, chipPlus);
          // 同样放大到 44×44 的命中范围；金币音效已有，予以保留
          addHitZone(chipPlus, betBoxX + 64, rowY, 44, 44, null, () => {
            this.sfx.coinChime("out");
            this.balance = Math.round(this.balance + 1000);
            this.updateDisplay();
            this.setMessage("CHIPS +1000");
          });
          addHitZone(chipMinus, betBoxX - 64, rowY, 44, 44, null, () => {
            if (this.balance < 1000) {
              this.setMessage("INSUFFICIENT CHIPS");
              this.sfx.lose();
              return;
            }
            this.sfx.coinChime("in");
            this.balance = Math.round(this.balance - 1000);
            this.updateDisplay();
            this.setMessage("CHIPS -1000");
          });

          // 关闭按钮：放大至 200%，并相应调整位置与外层微光留出的边距保持协调
          const closeX = cx + panelW / 2 - 28;
          const closeY = top + 24;
          const closeBtn = this.add
            .text(closeX, closeY, "✕", {
              fontSize: "32px",
              fontStyle: "bold",
              color: "#ffd700",
            })
            .setOrigin(0.5);
          children.push(closeBtn);

          addHitZone(closeBtn, closeX, closeY, 44, 44, () => this.sfx.click(), () => {
            this.toggleSettingsModal(false);
          });

          // 弹窗内容按 modalScale 放大（遮罩不放大，保持铺满画布）
          const mk = LAYOUT.modalScale;
          const overlayObj = children.shift();
          children.forEach((o) => {
            if (o.type === "Text" && o.setResolution) o.setResolution(Math.min(4, Math.ceil(mk * 1.5)));
          });
          const inner = this.add.container(cx * (1 - mk), cy * (1 - mk)).setScale(mk);
          inner.add(children);
          this.settingsModalGroup.add([overlayObj, inner]);
        };

        SlotGame.prototype.toggleSettingsModal = function(show) {
          if (show && this.modalBetValue) {
            this.modalBetValue.setText(this.formatInt(this.bet));
          }
          this.settingsModalGroup.setVisible(show);
        };

        SlotGame.prototype.updateAutoOptionButtons = function() {
          if (!this.autoYesButton || !this.autoNoButton) return;
          this.setControlActive(
            this.autoYesButton.bg,
            this.autoYesButton.txt,
            this.autoPlay,
          );
          this.setControlActive(
            this.autoNoButton.bg,
            this.autoNoButton.txt,
            !this.autoPlay,
          );
        };

        SlotGame.prototype.updateSoundOptionButtons = function() {
          if (!this.soundOnButton || !this.soundOffButton) return;
          this.setControlActive(
            this.soundOnButton.bg,
            this.soundOnButton.txt,
            this.sfx.enabled,
          );
          this.setControlActive(
            this.soundOffButton.bg,
            this.soundOffButton.txt,
            !this.sfx.enabled,
          );
        };

        SlotGame.prototype.pullLever = function(thenStart = true) {
          if (this.leverState === "down") return;

          this.leverState = "down";
          this.sfx.leverGrip();

          const L = LAYOUT.lever;
          const hand = this.leverHand;
          const tw = this._leverTw;
          const upd = () => this.setLeverProgress(tw.p);

          this.tweens.killTweensOf(hand);
          this.tweens.killTweensOf(tw);
          this._handFollow = false;

          const gx = L.ballX + L.gripDx;
          const gy = L.ballY + L.gripDy;
          const midX = (L.restX + gx) / 2 + L.ballR * 0.25;
          const midY = (L.restY + gy) / 2 - L.ballR * 0.5;

          hand.setText("✋");
          hand.setAlpha(0);
          hand.setPosition(L.restX, L.restY);
          hand.setScale(0.85);
          hand.setAngle(-40);

          // 1) 淡入 + 弧线接近
          this.tweens.add({
            targets: hand,
            alpha: 1,
            scale: 1.05,
            duration: 90,
            ease: "Sine.easeOut",
          });

          this.tweens.add({
            targets: hand,
            x: midX,
            y: midY,
            angle: -18,
            duration: 120,
            ease: "Sine.easeOut",
            onComplete: () => {
              // 2) 落到球头并握紧
              this.tweens.add({
                targets: hand,
                x: gx,
                y: gy,
                angle: -4,
                scale: 0.96,
                duration: 110,
                ease: "Cubic.easeInOut",
                onComplete: () => {
                  hand.setText("✊");
                  this.sfx.leverPull();
                  this._handFollow = true;

                  // 3) 微抬蓄力后重压拉下
                  this.tweens.add({
                    targets: tw,
                    p: -0.07,
                    duration: 50,
                    ease: "Sine.easeOut",
                    onUpdate: upd,
                    onComplete: () => {
                      this.tweens.add({
                        targets: tw,
                        p: 1,
                        duration: 260,
                        ease: "Cubic.easeIn",
                        onUpdate: upd,
                        onComplete: () => {
                          this.cameras.main.shake(110, 0.008);

                          this.tweens.add({
                            targets: tw,
                            p: 0.93,
                            duration: 90,
                            yoyo: true,
                            ease: "Sine.easeOut",
                            onUpdate: upd,
                          });

                          if (thenStart) {
                            this.startSpin();
                          }
                        },
                      });
                    },
                  });
                },
              });
            },
          });
        };

        SlotGame.prototype.resetLever = function() {
          this.leverState = "up";
          this.sfx.leverReset();

          const L = LAYOUT.lever;
          const hand = this.leverHand;
          const tw = this._leverTw;

          this.tweens.killTweensOf(hand);
          this.tweens.killTweensOf(tw);
          this._handFollow = false;

          // 松手：张开 → 滑开淡出
          hand.setText("✋");

          this.tweens.add({
            targets: hand,
            scale: 1.05,
            angle: 8,
            duration: 100,
            ease: "Sine.easeOut",
            onComplete: () => {
              this.tweens.add({
                targets: hand,
                alpha: 0,
                x: L.restX,
                y: L.restY - L.ballR * 0.3,
                angle: -30,
                scale: 0.9,
                duration: 320,
                ease: "Cubic.easeInOut",
                onComplete: () => {
                  if (this.leverHand) {
                    this.leverHand.setText("✋");
                    this.leverHand.setScale(1);
                  }
                },
              });
            },
          });

          // 拉杆弹回
          this.tweens.add({
            targets: tw,
            p: 0,
            duration: 420,
            ease: "Back.easeOut",
            onUpdate: () => this.setLeverProgress(tw.p),
          });

          if (this.leverGlow) this.leverGlow.setAlpha(0);
        };

        SlotGame.prototype.startSpin = function() {
          if (this.isSpinning) return;

          if (this.balance < this.bet) {
            this.setMessage("余额不足，无法开始！");
            this.sfx.lose();
            this.autoPlay = false;
            this.updateAutoOptionButtons();
            this.resetLever();
            return;
          }

          if (this.leverState !== "down") {
            const LV = LAYOUT.lever;
            const tw = this._leverTw;
            this.leverState = "down";
            this.sfx.leverPull();
            this.tweens.killTweensOf(this.leverHand);
            this.tweens.killTweensOf(tw);
            this.leverHand.setText("✊");
            this.leverHand.setAlpha(1);
            this.leverHand.setPosition(LV.ballX + LV.gripDx, LV.ballY + LV.gripDy);
            this._handFollow = true;
            this.tweens.add({
              targets: tw,
              p: 1,
              duration: 200,
              ease: "Cubic.easeIn",
              onUpdate: () => this.setLeverProgress(tw.p),
            });
          }

          this.reels.forEach((reel) => {
            if (reel.intervalEvent) {
              reel.intervalEvent.remove(false);
              reel.intervalEvent = null;
            }

            reel.stopped = true;
            reel.forceStopScheduled = false;
            reel.container.y = LAYOUT.reelY;
          });

          this.isSpinning = true;
          this.stopRequested = false;
          this.stoppedReelsCount = 0;

          this.pendingSpinResult = rollSpinResult();

          this.animateBalanceDecrease(this.bet);

          this.jackpotValue += Math.max(1, Math.round(this.bet * 0.05));
          this.updateDisplay();

          if (this.autoPlay) {
            this.autoPlayRounds++;
            this.setMessage(
              `AUTO SPIN ${this.autoPlayRounds}/${this.maxAutoPlayRounds}`,
              18,
            );
          } else {
            const modeLabel = this.mode === "FAST" ? "FAST" : "NORMAL";
            this.setMessage(`${modeLabel} SPIN • SPACE TO STOP`, 17);
          }

          this.reels.forEach((reel, index) => {
            this.startReelSpin(reel, index);
          });

          this.cameras.main.shake(90, 0.002);
        };

        SlotGame.prototype.animateBalanceDecrease = function(amount) {
          const startBalance = this.balance;
          const endBalance = this.balance - amount;
          const P = LAYOUT.plates;

          this.balance = endBalance;

          this.tweens.addCounter({
            from: startBalance,
            to: endBalance,
            duration: 320,
            ease: "Cubic.easeOut",
            onUpdate: (tween) => {
              fitTextToBox(
                this.balanceValue,
                this.formatInt(tween.getValue()),
                P.valueMaxW,
                P.valueFont,
                P.valueMinFont,
              );
            },
            onComplete: () => this.updateDisplay(),
          });

          this.tweens.add({
            targets: this.balanceValue,
            scale: 1.1,
            duration: 140,
            yoyo: true,
          });
        };

        SlotGame.prototype.startReelSpin = function(reel, index) {
          const settings = this.speedSettings[this.mode];
          const L = LAYOUT;
          const N = L.itemN;
          const stepScale = L.rowH / 64; // 原速度参数是按 64px 行高调的

          if (reel.intervalEvent) {
            reel.intervalEvent.remove(false);
            reel.intervalEvent = null;
          }

          reel.stopped = false;
          reel.forceStopScheduled = false;

          this.setReelFrameStroke(reel, 3, 0x9fe3ff);

          const stopDelay = settings.duration + index * 320;
          const decelWindow = 260; // 停止前的减速窗口（毫秒），让转轮"滑行进站"而不是硬停
          const spinStartTime = this.time.now;

          reel.intervalEvent = this.time.addEvent({
            delay: settings.interval,
            loop: true,
            callback: () => {
              this.sfx.spinTick();

              // 越接近停止时刻，滚动步长越小，形成自然减速的滑行手感
              const remaining = stopDelay - (this.time.now - spinStartTime);
              const decelRatio =
                remaining < decelWindow
                  ? Math.max(0.25, remaining / decelWindow)
                  : 1;
              const step = settings.step * decelRatio * stepScale;

              reel.items.forEach((item) => {
                item.txt.y += step;
                item.bg.y += step;

                // 滚出窗口下沿：换个随机符号，接回最上面（保持行距不变）
                if (item.txt.y > N * L.rowH) {
                  const symbol = Phaser.Utils.Array.GetRandom(SYMBOLS);
                  const ny = item.txt.y - (2 * N + 1) * L.rowH;

                  item.symbol = symbol;
                  item.txt.y = ny;
                  item.bg.y = ny;
                  item.txt.setText(symbol.label);
                  item.txt.setColor(symbol.color);
                }
              });
            },
          });

          this.time.delayedCall(stopDelay, () => {
            // stopReel 内部已对 reel.stopped 做了守卫，急停场景下重复调用是安全的
            this.stopReel(reel, index);
          });
        };

        SlotGame.prototype.stopReel = function(reel, index) {
          if (reel.stopped) return;

          const L = LAYOUT;
          const N = L.itemN;

          reel.stopped = true;

          if (reel.intervalEvent) {
            reel.intervalEvent.remove(false);
            reel.intervalEvent = null;
          }

          const finalSymbol = this.getControlledResult(index);
          reel.value = finalSymbol;

          reel.items.forEach((item, i) => {
            const randomSymbol = Phaser.Utils.Array.GetRandom(SYMBOLS);
            const yy = (i - N) * L.rowH;

            item.symbol = randomSymbol;
            item.txt.y = yy;
            item.bg.y = yy;
            item.txt.setText(randomSymbol.label);
            item.txt.setColor(randomSymbol.color);

            if (i !== N) {
              item.txt.setAlpha(0.35);
              this.tweens.add({
                targets: item.txt,
                alpha: 1,
                duration: 150,
                ease: "Sine.easeOut",
              });
            }
          });

          const center = reel.items[N];

          center.symbol = finalSymbol;
          center.txt.setText(finalSymbol.label);
          center.txt.setColor(finalSymbol.color);
          center.txt.y = 0;
          center.bg.y = 0;

          this.sfx.reelStop();

          this.tweens.add({
            targets: reel.container,
            y: L.reelY + L.bounce,
            duration: 120,
            ease: "Sine.easeOut",
            yoyo: true,
          });

          this.tweens.add({
            targets: center.txt,
            scale: 1.15,
            duration: 140,
            yoyo: true,
          });

          this.setReelFrameStroke(reel, 2, UI.neon);

          this.stoppedReelsCount++;

          if (this.stoppedReelsCount >= this.reels.length) {
            this.time.delayedCall(300, () => {
              this.isSpinning = false;
              this.resetLever();
              this.checkWin();
            });
          }
        };

        SlotGame.prototype.getControlledResult = function(index) {
          if (this.pendingSpinResult && this.pendingSpinResult[index]) {
            return this.pendingSpinResult[index];
          }
          return Phaser.Utils.Array.GetRandom(SYMBOLS);
        };

        SlotGame.prototype.checkWin = function() {
          const [a, b, c] = this.reels.map((reel) => {
            const center = reel.items[LAYOUT.itemN];
            return center.symbol || reel.value;
          });

          const result = evaluateSpinResult(a, b, c, this.bet, this.jackpotValue);

          if (result.type === "jackpot") {
            this.balance += result.win;
            this.lastWin = result.win;
            this.updateDisplay();

            this.setMessage(`JACKPOT! +${this.formatMoney(result.win)}`, 18);
            this.playJackpot();
            this.scheduleAutoPlay();
            return;
          }

          if (result.type === "three") {
            this.balance += result.win;
            this.lastWin = result.win;
            this.updateDisplay();

            this.setMessage(
              `${a.label}${a.label}${a.label} WIN +${this.formatMoney(result.win)}`,
              18,
            );
            this.playBigWin();
            this.scheduleAutoPlay();
            return;
          }

          if (result.type === "pair") {
            this.balance += result.win;
            this.lastWin = result.win;
            this.updateDisplay();

            this.setMessage(
              `PAIR ${result.symbol.label}${result.symbol.label} +${this.formatMoney(result.win)}`,
              18,
            );
            this.playSmallWin();
            this.scheduleAutoPlay();
            return;
          }

          this.updateDisplay();
          this.setMessage("NO WIN — TRY AGAIN");
          this.sfx.lose();
          this.scheduleAutoPlay();
        };

        SlotGame.prototype.scheduleAutoPlay = function() {
          if (!this.autoPlay) return;

          if (
            this.autoPlayRounds >= this.maxAutoPlayRounds ||
            this.balance < this.bet
          ) {
            this.autoPlay = false;
            this.updateAutoOptionButtons();
            this.setMessage("自动模式已结束");
            return;
          }

          this.time.delayedCall(850, () => {
            if (this.autoPlay && !this.isSpinning) {
              this.startSpin();
            }
          });
        };

        SlotGame.prototype.flashLines = function() {
          [this.paylineTop, this.paylineMiddle, this.paylineBottom].forEach(
            (line) => {
              this.tweens.add({
                targets: line,
                alpha: 1,
                scaleX: 1.07,
                duration: 120,
                yoyo: true,
                repeat: 6,
              });
            },
          );
        };

        SlotGame.prototype.playSmallWin = function() {
          this.sfx.smallWin();
          this.flashLines();

          this.reels.forEach((reel) => {
            this.tweens.add({
              targets: reel.container,
              scale: 1.06,
              duration: 140,
              yoyo: true,
              repeat: 2,
            });
          });
        };

        SlotGame.prototype.playBigWin = function() {
          this.sfx.bigWin();
          this.cameras.main.flash(350, 255, 215, 0);
          this.cameras.main.shake(450, 0.009);
          this.flashLines();

          this.reels.forEach((reel) => {
            this.setReelFrameStroke(reel, 6, 0x00ff99);

            this.tweens.add({
              targets: reel.container,
              scale: 1.12,
              duration: 150,
              yoyo: true,
              repeat: 4,
            });
          });

          this.showWinText("BIG WIN!", "#00ff99");
          this.coinExplosion(45);

          this.time.delayedCall(1000, () => {
            this.reels.forEach((reel) =>
              this.setReelFrameStroke(reel, 4, 0xffd700),
            );
          });
        };

        SlotGame.prototype.playJackpot = function() {
          this.sfx.jackpot();
          this.cameras.main.flash(600, 255, 215, 0);
          this.cameras.main.shake(900, 0.018);
          this.flashLines();

          this.tweens.add({
            targets: this.jackpotText,
            scale: 1.12,
            duration: 180,
            yoyo: true,
            repeat: 7,
          });

          if (this.jackpotStars && this.jackpotStars.length) {
            this.jackpotStars.forEach((star) => {
              this.tweens.add({
                targets: star,
                scale: Phaser.Math.FloatBetween(1.8, 2.6),
                alpha: 1,
                duration: 150,
                yoyo: true,
                repeat: 7,
              });
            });
          }

          this.showWinText("JACKPOT!", "#ffd700");
          this.coinExplosion(90);
          this.fireworksBurst(70);

          this.jackpotValue =
            Math.round(this.baseJackpotValue * (this.bet / 50)) +
            Phaser.Math.Between(250, 1250);
          this.updateDisplay();
        };

        SlotGame.prototype.fireworksBurst = function(amount) {
          const colors = ["#ffd700", "#ff6b6b", "#4ecdc4", "#ffe66d", "#ff9ff3", "#54a0ff", "#ffffff"];
          const F = LAYOUT.fx;
          const batch = 12;
          const batches = Math.ceil(amount / batch);
          for (let b = 0; b < batches; b++) {
            this.time.delayedCall(b * 55, () => {
              const count = Math.min(batch, amount - b * batch);
              const ox = F.cx + Phaser.Math.Between(-90, 90) * F.k;
              const oy = F.cy + Phaser.Math.Between(-80, 0) * F.k;
              for (let i = 0; i < count; i++) {
                const col = colors[i % colors.length];
                const p = this.add
                  .text(ox, oy, "✦", {
                    fontSize: `${Math.round(Phaser.Math.Between(14, 26) * F.k)}px`,
                    color: col,
                  })
                  .setOrigin(0.5)
                  .setDepth(60);
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.Between(80, 220) * F.k;
                this.tweens.add({
                  targets: p,
                  x: ox + Math.cos(angle) * dist,
                  y: oy + Math.sin(angle) * dist * 0.7 - Phaser.Math.Between(40, 120) * F.k,
                  alpha: 0,
                  scale: Phaser.Math.FloatBetween(0.4, 1.4),
                  angle: Phaser.Math.Between(-180, 180),
                  duration: Phaser.Math.Between(700, 1300),
                  ease: "Cubic.easeOut",
                  onComplete: () => p.destroy(),
                });
              }
            });
          }
        };

        SlotGame.prototype.showWinText = function(text, color) {
          const W = LAYOUT.win;
          const winText = this.add
            .text(W.x, W.y, text, {
              fontSize: W.font + "px",
              fontStyle: "bold",
              color,
              stroke: "#000000",
              strokeThickness: W.stroke,
              shadow: {
                offsetX: 0,
                offsetY: 0,
                color,
                blur: 16,
                fill: true,
              },
            })
            .setOrigin(0.5)
            .setDepth(50);

          this.tweens.add({
            targets: winText,
            scale: 1.24,
            alpha: 0,
            duration: 1800,
            ease: "Cubic.easeOut",
            onComplete: () => winText.destroy(),
          });
        };

        SlotGame.prototype.coinExplosion = function(amount) {
          const F = LAYOUT.fx;
          const batchSize = 15;
          const batches = Math.ceil(amount / batchSize);

          for (let batch = 0; batch < batches; batch++) {
            this.time.delayedCall(batch * 40, () => {
              const count = Math.min(batchSize, amount - batch * batchSize);

              for (let i = 0; i < count; i++) {
                const coin = this.add
                  .text(
                    Phaser.Math.Between(F.coinX0, F.coinX1),
                    Phaser.Math.Between(F.coinY0, F.coinY1),
                    "●",
                    {
                      fontSize: `${Math.round(Phaser.Math.Between(18, 30) * F.k)}px`,
                      color: "#ffd700",
                      stroke: "#7a3b00",
                      strokeThickness: 1,
                    },
                  )
                  .setOrigin(0.5)
                  .setDepth(50);

                this.tweens.add({
                  targets: coin,
                  x: coin.x + Phaser.Math.Between(-300, 300) * F.k,
                  y: coin.y - Phaser.Math.Between(90, 240) * F.k,
                  alpha: 0,
                  scale: 1.8,
                  angle: Phaser.Math.Between(-360, 360),
                  duration: Phaser.Math.Between(800, 1400),
                  ease: "Cubic.easeOut",
                  onComplete: () => coin.destroy(),
                });
              }
            });
          }
        };

        SlotGame.prototype.updateDisplay = function(skipSave) {
          const P = LAYOUT.plates;
          const J = LAYOUT.jackpot;

          fitTextToBox(
            this.balanceValue,
            this.formatInt(this.balance),
            P.valueMaxW,
            P.valueFont,
            P.valueMinFont,
          );

          if (this.modalBetValue) {
            this.modalBetValue.setText(this.formatInt(this.bet));
          }

          if (this.betValue) {
            fitTextToBox(
              this.betValue,
              this.formatInt(this.bet),
              P.valueMaxW - 90,
              P.valueFont,
              P.valueMinFont,
            );
          }

          fitTextToBox(
            this.lastWinValue,
            this.formatInt(this.lastWin),
            P.valueMaxW,
            P.valueFont,
            P.valueMinFont,
          );

          fitTextToBox(
            this.jackpotText,
            `🏵️ Jackpot ${this.formatMoney(this.jackpotValue)}`,
            J.maxW,
            J.font,
            J.minFont,
          );

          if (!skipSave) this.saveGameState();
        };

        SlotGame.prototype.changeBet = function(amount) {
          if (this.isSpinning) return;

          this.sfx.click();

          this.bet = Math.round(
            Phaser.Math.Clamp(
              this.bet + amount,
              this.minBet,
              this.maxBet,
            ),
          );

          if (this.modalBetValue) {
            this.modalBetValue.setText(this.formatInt(this.bet));
          }
          if (this.betValue) {
            this.betValue.setText(this.formatInt(this.bet));
          }
          this.saveGameState();
        };

        SlotGame.prototype.formatInt = function(value) {
          return String(Math.round(Number(value)));
        };
        SlotGame.prototype.formatMoney = SlotGame.prototype.formatInt;

        SlotGame.prototype.setMessage = function(value, baseFontSize = 20) {
          const s = LAYOUT.msgScale;
          fitTextToBox(
            this.messageText,
            value,
            LAYOUT.messageW - 28,
            baseFontSize * s,
            12 * s,
          );
        };

        SlotGame.prototype.toggleAutoPlay = function() {
          this.autoPlay = !this.autoPlay;

          if (this.autoPlay) {
            this.autoPlayRounds = 0;
            this.updateAutoOptionButtons();
            this.setMessage(`自动模式已开启（${this.maxAutoPlayRounds}次）`);

            if (!this.isSpinning) {
              this.time.delayedCall(350, () => {
                if (this.autoPlay && !this.isSpinning) {
                  this.startSpin();
                }
              });
            }
          } else {
            this.updateAutoOptionButtons();
            this.setMessage("自动模式已关闭");
          }
        };
        SlotGame.prototype.handleSpinInput = function() {
          if (this.inputLocked) return;

          this.inputLocked = true;
          this.time.delayedCall(280, () => {
            this.inputLocked = false;
          });

          if (this.isSpinning) {
            this.requestStop();
            return;
          }

          if (this.leverState === "down") return;

          this.pullLever(true);
        };

        SlotGame.prototype.requestStop = function() {
          if (!this.isSpinning || this.stopRequested) return;

          this.stopRequested = true;
          this.setMessage("STOPPING...");

          this.reels.forEach((reel, index) => {
            if (!reel.stopped && !reel.forceStopScheduled) {
              reel.forceStopScheduled = true;
              this.time.delayedCall(index * 140, () =>
                this.stopReel(reel, index),
              );
            }
          });
        };

        SlotGame.prototype.refreshModeLabel = function() {
          if (!this.modeLabelSimple || !this.modeLabelComplex) return;

          const dimColor = "#6a6a6a";
          const activeText = UI.textDark;
          const isSimple = !!this.focusMode;

          this.modeLabelSimple.setColor(isSimple ? activeText : dimColor);
          this.modeLabelComplex.setColor(isSimple ? dimColor : activeText);

          if (!this.modeChipBg) return;

          const chipW = this._clockChipW || 28;
          const chipH = this._clockChipH || 20;
          const chipR = this._clockChipR || 7;
          const half = this._clockModeHalf || 16;
          const offsetX = isSimple ? -half : half;

          this.modeChipBg.clear();
          this.modeChipBg.fillStyle(UI.activeFill, 0.95);
          this.modeChipBg.fillRoundedRect(
            offsetX - chipW / 2,
            -chipH / 2,
            chipW,
            chipH,
            chipR,
          );
          this.modeChipBg.lineStyle(1, UI.gold, 0.9);
          this.modeChipBg.strokeRoundedRect(
            offsetX - chipW / 2,
            -chipH / 2,
            chipW,
            chipH,
            chipR,
          );
        };

        SlotGame.prototype.toggleFocusMode = function(silent) {
          this.focusMode = !this.focusMode;
          if (!silent) this.sfx.click();

          this.focusHideGroup.forEach((obj) => {
            if (obj) obj.setVisible(!this.focusMode);
          });
          this.refreshModeLabel();
        };

        SlotGame.prototype.updateSpeedButtons = function() {
          this.speedButtons.forEach(({ label, btn, txt }) => {
            this.setControlActive(btn, txt, label === this.mode);
          });
        };

        SlotGame.prototype.createKeyboardControls = function() {
          this.input.keyboard.on("keydown-SPACE", () => {
            this.sfx.click();
            this.handleSpinInput();
          });
        };

        SlotGame.prototype.createAmbientAnimations = function() {
          this.machineGlow.setAlpha(0.15);
          this.tweens.add({
            targets: this.machineGlow,
            alpha: 0.4,
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });

          if (this.paylineTop) this.paylineTop.setAlpha(0.7);
          if (this.paylineMiddle) this.paylineMiddle.setAlpha(0.88);
          if (this.paylineBottom) this.paylineBottom.setAlpha(0.7);

          if (this.paylineMiddle) {
            this.tweens.add({
              targets: this.paylineMiddle,
              alpha: 0.62,
              duration: 1500,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }
        };

        SlotGame.prototype.loadGameState = function() {
          try {
            if (typeof window === "undefined" || !window.localStorage) return;
            const raw = window.localStorage.getItem("wanjin_slot_save");
            if (!raw) return;

            const saved = JSON.parse(raw);
            if (typeof saved.balance === "number" && Number.isFinite(saved.balance)) {
              this.balance = Math.round(saved.balance);
            }
            if (typeof saved.bet === "number" && Number.isFinite(saved.bet)) {
              this.bet = Math.round(saved.bet);
            }
            if (typeof saved.jackpotValue === "number" && Number.isFinite(saved.jackpotValue)) {
              this.jackpotValue = Math.round(saved.jackpotValue);
            }
            if (typeof saved.lastWin === "number" && Number.isFinite(saved.lastWin)) {
              this.lastWin = Math.round(saved.lastWin);
            }
            if (saved.mode === "NORMAL" || saved.mode === "FAST") this.mode = saved.mode;
            if (typeof saved.sfxEnabled === "boolean") this.sfx.enabled = saved.sfxEnabled;
          } catch (err) {
          }
        };

        // immediate=true 立刻落盘，否则 50ms 合并
        SlotGame.prototype.saveGameState = function(immediate) {
          const self = this;
          const run = function () {
            self._saveTimer = 0;
            try {
              if (typeof window === "undefined" || !window.localStorage) return;
              const bal = Math.round(Number(self.balance) || 0);
              const bet = Math.round(Number(self.bet) || 0);
              const jp = Math.round(Number(self.jackpotValue) || 0);
              const lw = Math.round(Number(self.lastWin) || 0);
              const musicEnabled = !!(typeof bgMusic !== "undefined" && bgMusic.enabled);
              const musicPlayMode =
                (typeof bgMusic !== "undefined" && bgMusic.playMode) || "order";
              const musicCurrentNum =
                (typeof bgMusic !== "undefined" && bgMusic.currentNum) || 1;

              const payload = JSON.stringify({
                balance: bal,
                bet: bet,
                jackpotValue: jp,
                lastWin: lw,
                mode: self.mode,
                sfxEnabled: !!(self.sfx && self.sfx.enabled),
                musicEnabled: musicEnabled,
                musicPlayMode: musicPlayMode,
                musicCurrentNum: musicCurrentNum,
              });
              if (self._lastSavePayload === payload) return;
              self._lastSavePayload = payload;

              window.localStorage.setItem("wanjin_slot_save", payload);
              localStorage.setItem("bgMusicEnabled", String(musicEnabled));
              localStorage.setItem("bgMusicPlayMode", musicPlayMode);
              localStorage.setItem("bgMusicCurrentNum", String(musicCurrentNum));
            } catch (err) {
            }
          };

          if (immediate) {
            if (self._saveTimer) {
              clearTimeout(self._saveTimer);
              self._saveTimer = 0;
            }
            run();
            return;
          }
          if (self._saveTimer) return;
          self._saveTimer = setTimeout(run, 50);
        };
