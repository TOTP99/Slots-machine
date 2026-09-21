/* 万锦老虎机 — Phaser3 + config/layout/sound-fx/bg-music（需先加载） */

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
          this.machineScaleGroup = null;
          this.machineScaleAnchor = { x: 0, y: 0 };

          this.speedSettings = {
            NORMAL: { duration: 1700, interval: 40, step: 18 },
            FAST: { duration: 1000, interval: 22, step: 20 },
          };
        }

        create() {
          window.__slotGameScene = this;
          this.machineScaleGroup = this.add.container(0, 0);
          this.createBackdrop();
          this.createHeader();
          this.loadGameState(); // 读取本机浏览器存档：余额 / 下注 / 奖池
          this.createPaytableButton();
          this.createMachine();
          this.createReels();
          this.createBottomPanels(); // 含"上次获胜"格，四分播报屏统一在此创建
          this.createRightControls();
          this.machineScaleGroup.sort("depth");
          this.createSettingsModal(); // 赔率 + 速度 / 自动五次 / 音效 设置弹窗
          this.createKeyboardControls();
          this.createAmbientAnimations();
          this.machineScaleAnchor = { x: LAYOUT.machineX, y: LAYOUT.machineY };
          this.toggleFocusMode(true); // 默认进入「简」：藏左侧面板，机身放大 115%
          this.updateDisplay();
          if (window.__portraitMode) {
            this.setPortraitMode(true);
          }
        }

}

        // 径向背景：同心圆近似渐变（中心暖暗 → 边缘近黑，自带暗角）
        SlotGame.prototype.createBackdrop = function() {
          const cx = GAME_WIDTH / 2;
          const cy = GAME_HEIGHT / 2;
          const maxR = Math.hypot(cx, cy) + 20;

          const centerColor = Phaser.Display.Color.ValueToColor(0x181206);
          const edgeColor = Phaser.Display.Color.ValueToColor(0x030202);

          const gfx = this.add.graphics().setDepth(-1000);
          this._backdropGfx = gfx;
          const steps = 48;
          for (let i = steps; i >= 0; i--) {
            const t = i / steps; // 1=边缘, 0=中心
            const r = maxR * t;
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
              centerColor,
              edgeColor,
              steps,
              i,
            );
            gfx.fillStyle(
              Phaser.Display.Color.GetColor(color.r, color.g, color.b),
              1,
            );
            gfx.fillCircle(cx, cy, r);
          }
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

        SlotGame.prototype.createPanel = function(x, y, width, height, fill = UI.panel, alpha = 0.96, hideGroup = null, scaleGroup = null) {
          const radius = Math.min(PANEL_RADIUS, height / 2, width / 2);
          const topColor = this.shadeColor(fill, 22);
          const bottomColor = this.shadeColor(fill, -16);

          const glow = this.add.graphics().setPosition(x, y);
          glow.fillStyle(UI.goldDim, 0.12);
          glow.fillRoundedRect(-(width + 8) / 2, -(height + 8) / 2, width + 8, height + 8, radius + 4);

          const panel = this.add.graphics().setPosition(x, y);
          this.drawGradientPanel(panel, width, height, radius, topColor, bottomColor, alpha, UI.gold, 1.4);

          if (hideGroup) hideGroup.push(glow, panel);
          if (scaleGroup) scaleGroup.add([glow, panel]);

          return panel;
        };

        SlotGame.prototype.setControlActive = function(bg, txt, active) {
          const fill = active ? UI.activeFill : 0x1a140c;
          const top = this.shadeColor(fill, active ? 16 : 10);
          const bottom = this.shadeColor(fill, -8);
          const stroke = active ? UI.gold : UI.goldDim;
          const w = bg._btnW || 58;
          const h = bg._btnH || 28;
          this.drawGradientPanel(bg, w, h, 8, top, bottom, 0.95, stroke, active ? 1.5 : 1);
          txt.setColor(active ? UI.textDark : UI.cream);
        };

        SlotGame.prototype.createHeader = function() {
          this.createJackpotSparkle(480, LAYOUT.jackpotY, 420, 46);

          this.jackpotText = this.add
            .text(
              480,
              LAYOUT.jackpotY,
              `🏵️ Jackpot ${this.formatMoney(this.jackpotValue)}`,
              {
                fontSize: "29px",
                fontStyle: "bold",
                fontFamily: 'Arial, sans-serif',
                color: "#f0d58a",
                stroke: "#090b0b",
                strokeThickness: 1,
                shadow: { offsetX: 0, offsetY: 1, color: "#9b7a3e", blur: 6, fill: true },
              },
            )
            .setOrigin(0.5);
        };

        SlotGame.prototype.createJackpotSparkle = function(cx, cy, w, h) {
          const count = 19;
          this.jackpotStars = [];
          for (let i = 0; i < count; i++) {
            const sx = cx - w / 2 + Phaser.Math.Between(8, w - 8);
            const sy = cy - h / 2 + Phaser.Math.Between(4, h - 4);
            const points = Phaser.Math.RND.pick([4, 4, 5]);
            const outerR = Phaser.Math.Between(3, 6);
            const star = this.add
              .star(sx, sy, points, Math.max(1, outerR - 3), outerR, 0xfff3c4, 0.9)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(0);
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
          const mx = LAYOUT.machineX;
          const my = LAYOUT.machineY;
          const shellRadius = 26;

          this.machineGlow = this.add.rectangle(
            mx,
            my,
            LAYOUT.machineOuterW + 14,
            LAYOUT.machineOuterH + 10,
            UI.gold,
            0.1,
          );

          const outerShell = this.add.graphics().setPosition(mx, my);
          this.drawGradientPanel(
            outerShell,
            LAYOUT.machineOuterW + 6,
            LAYOUT.machineOuterH + 6,
            shellRadius,
            this.shadeColor(UI.goldDim, -10),
            this.shadeColor(UI.goldDim, -55),
            0.85,
            UI.gold,
            2.5,
          );

          const darkShell = this.add.graphics().setPosition(mx, my);
          this.drawGradientPanel(
            darkShell,
            LAYOUT.machineOuterW,
            LAYOUT.machineOuterH,
            shellRadius - 4,
            this.shadeColor(0x101714, 12),
            this.shadeColor(0x101714, -22),
            1,
            UI.goldDim,
            2,
          );

          const innerPanel = this.add.graphics().setPosition(mx, my);
          this.drawGradientPanel(
            innerPanel,
            LAYOUT.machineInnerW,
            LAYOUT.machineInnerH,
            shellRadius - 10,
            this.shadeColor(UI.panelDeep, 16),
            this.shadeColor(UI.panelDeep, -12),
            1,
            UI.goldDim,
            1.5,
          );

          const reelWindow = this.add.graphics().setPosition(mx, my);
          this.drawGradientPanel(
            reelWindow,
            452,
            170,
            14,
            0x000000,
            0x141416,
            1,
            UI.goldDim,
            2,
          );
          const reelInnerShadow = this.add.graphics().setPosition(mx, my);
          reelInnerShadow.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
          reelInnerShadow.fillRoundedRect(-226, -85, 452, 34, { tl: 14, tr: 14, bl: 0, br: 0 });
          reelInnerShadow.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
          reelInnerShadow.fillRoundedRect(-226, 51, 452, 34, { tl: 0, tr: 0, bl: 14, br: 14 });

          this.paylineTop = this.add
            .rectangle(mx, my - 64, 448, 2, UI.goldDim, 0.7)
            .setDepth(5);

          this.paylineMiddle = this.add
            .rectangle(mx, my, 448, 5, UI.gold, 0.88)
            .setDepth(5);

          this.paylineBottom = this.add
            .rectangle(mx, my + 64, 448, 2, UI.goldDim, 0.7)
            .setDepth(5);

          const makeLineLabel = (lx) => {
            const chip = this.add.graphics().setPosition(lx, my);
            this.drawGradientPanel(
              chip,
              46,
              24,
              12,
              this.shadeColor(UI.ruby, 20),
              this.shadeColor(UI.rubyDim, -10),
              0.92,
              UI.gold,
              1,
            );
            const label = this.add
              .text(lx, my, "🏵️", {
                fontSize: "13px",
                fontStyle: "bold",
                color: "#f4ead0",
              })
              .setOrigin(0.5);
            return [chip, label];
          };
          const leftLabelParts = makeLineLabel(226);
          const rightLabelParts = makeLineLabel(714);

          this.machineScaleGroup.add([
            this.machineGlow,
            outerShell,
            darkShell,
            innerPanel,
            reelWindow,
            reelInnerShadow,
            this.paylineTop,
            this.paylineMiddle,
            this.paylineBottom,
            ...leftLabelParts,
            ...rightLabelParts,
          ]);
        };

        SlotGame.prototype.setReelFrameStroke = function(reel, strokeWidth, strokeColor) {
          if (!reel || !reel.frame) return;
          this.drawGradientPanel(
            reel.frame,
            LAYOUT.reelFrameW,
            LAYOUT.reelFrameH,
            16,
            this._reelFrameTop,
            this._reelFrameBottom,
            1,
            strokeColor,
            strokeWidth,
          );
        };

        SlotGame.prototype.createReels = function() {
          this._reelFrameTop = this.shadeColor(0x090b0b, 14);
          this._reelFrameBottom = this.shadeColor(0x090b0b, -20);

          LAYOUT.reelXs.forEach((x, reelIndex) => {
            const frame = this.add.graphics().setPosition(x, LAYOUT.reelY).setDepth(2);
            this.drawGradientPanel(
              frame,
              LAYOUT.reelFrameW,
              LAYOUT.reelFrameH,
              16,
              this._reelFrameTop,
              this._reelFrameBottom,
              1,
              UI.goldDim,
              2,
            );

            const maskShape = this.add.graphics();
            maskShape.fillStyle(0xffffff);
            maskShape.fillRect(
              x - LAYOUT.reelFrameW / 2 + 5,
              LAYOUT.reelY - LAYOUT.reelFrameH / 2 + 4,
              LAYOUT.reelFrameW - 10,
              LAYOUT.reelFrameH - 8,
            );

            const mask = maskShape.createGeometryMask();
            maskShape.setVisible(false);

            const container = this.add.container(x, LAYOUT.reelY).setDepth(3);
            container.setMask(mask);

            this.machineScaleGroup.add([frame, maskShape, container]);

            const items = [];

            for (let i = -2; i <= 2; i++) {
              const symbol = Phaser.Utils.Array.GetRandom(SYMBOLS);

              const bg = this.add.circle(0, i * 64, 30, 0x000000, 1);

              const txt = this.add
                .text(0, i * 64, symbol.label, {
                  fontSize: symbol.label.length > 1 ? "42px" : "52px",
                  fontStyle: "bold",
                  color: symbol.color,
                  stroke: "#090b0b",
                  strokeThickness: 2,
                  shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 3, fill: true },
                })
                .setOrigin(0.5);

              container.add([bg, txt]);
              items.push({ bg, txt, symbol });
            }

            this.reels.push({
              frame,
              container,
              items,
              value: SYMBOLS[reelIndex],
              intervalEvent: null,
              stopped: true,
              forceStopScheduled: false,
            });
          });
        };

        SlotGame.prototype.createBottomPanels = function() {
          const totalW = LAYOUT.messageW;
          const gap = 5;
          const cellW = (totalW - gap * 3) / 4;
          const startX = LAYOUT.messageX - totalW / 2 + cellW / 2;
          const xs = [0, 1, 2, 3].map((i) => startX + i * (cellW + gap));
          const makeDisplayCell = (x) =>
            this.createPanel(x, LAYOUT.messageY, cellW, LAYOUT.messageH, UI.panel, 0.94, null, this.machineScaleGroup);

          makeDisplayCell(xs[0]);
          makeDisplayCell(xs[3]);
          this.createPanel(
            (xs[1] + xs[2]) / 2,
            LAYOUT.messageY,
            cellW * 2 + gap,
            LAYOUT.messageH,
            UI.panel,
            0.94,
            null,
            this.machineScaleGroup,
          );

          const balanceLabel = this.add
            .text(xs[0], LAYOUT.messageY - 10, "BALANCE", {
              fontSize: "10px",
              fontStyle: "bold",
              color: UI.cream,
              letterSpacing: 1,
            })
            .setOrigin(0.5);
          this.balanceValue = this.add
            .text(xs[0], LAYOUT.messageY + 10, this.formatInt(this.balance), {
              fontSize: "17px",
              fontStyle: "bold",
              color: "#f4ead0",
            })
            .setOrigin(0.5);

          this.messageText = this.add
            .text((xs[1] + xs[2]) / 2, LAYOUT.messageY, "READY TO SPIN", {
              fontSize: "16px",
              fontStyle: "bold",
              color: "#e8dfc8",
              align: "center",
              wordWrap: { width: cellW * 2 + gap - 14 },
            })
            .setOrigin(0.5);

          const lastWinLabel = this.add
            .text(xs[3], LAYOUT.messageY - 10, "LAST WIN", {
              fontSize: "10px",
              fontStyle: "bold",
              color: UI.cream,
              letterSpacing: 1,
            })
            .setOrigin(0.5);
          this.lastWinValue = this.add
            .text(xs[3], LAYOUT.messageY + 10, this.formatInt(this.lastWin), {
              fontSize: "17px",
              fontStyle: "bold",
              color: "#f4ead0",
            })
            .setOrigin(0.5);

          this.machineScaleGroup.add([
            balanceLabel,
            this.balanceValue,
            this.messageText,
            lastWinLabel,
            this.lastWinValue,
          ]);

          // 兼容旧逻辑：投注值现在由控制弹窗中的 BET 行承载。
        };

        SlotGame.prototype.createPaytableButton = function() {
          const x = LAYOUT.paytableX;
          const y = LAYOUT.paytableY;
          const w = LAYOUT.paytableW;
          const h = LAYOUT.paytableH;

          this.createPanel(x, y, w, h, 0x0c0a08, 0.96, this.focusHideGroup);

          this.updateLiveClock();
          this.clockTimer = setInterval(() => this.updateLiveClock(), 250);

          // 长方形面板内自上而下均匀排布：
          // 💿 → 播放三键 → 曲号 → 双行 PAYTABLE / SETTING 按键
          // 原因：emoji 实际绘制高度常大于 fontSize，若中心点太靠上会被圆角面板裁切
          // 顶部至少留出 ~36px（半高 + 圆角内边距），再按剩余高度均分其余元素
          const iconFont = 50; // 原 56，缩小约 10%
          const iconHalf = iconFont * 0.55; // emoji 视觉半高略大于字号一半
          const topSafe = 14; // 圆角与描边内边距
          const frameH = 52;
          const bottomSafe = 14;

          // 整体间距压缩至原来的 75%，内容块在面板内上下居中
          // 内容跨度固定按"原始面板高 306"折算，与当前 LAYOUT.paytableH 解耦，
          // 这样以后单独缩小面板高度只会收窄上下留白，不会连带把内容再压小
          const SPACING_SCALE = 0.75;
          const REFERENCE_PANEL_H = 306;
          const fullContentSpan = REFERENCE_PANEL_H - topSafe - bottomSafe - 2;
          const contentSpan = fullContentSpan * SPACING_SCALE;
          const contentTop = y - contentSpan / 2;
          const contentBottom = y + contentSpan / 2;

          const micY = contentTop + iconHalf;
          const btnCenterY = contentBottom - frameH / 2;

          // 中间区域（播放键 + 曲号）在图标底边与按钮顶边之间居中均分
          const midTop = micY + iconHalf + 10 * SPACING_SCALE;
          const midBottom = btnCenterY - frameH / 2 - 10 * SPACING_SCALE;
          const midSpan = Math.max(midBottom - midTop, 1);
          const tY = midTop + midSpan * 0.32;
          const trackY = midTop + midSpan * 0.72;

          // 唱片图标
          const micIcon = this.add
            .text(x, micY, "💿", { fontSize: iconFont + "px" })
            .setOrigin(0.5);
          this.focusHideGroup.push(micIcon);

          // 播放控制：⏮️  ⏸️/▶️  ⏭️
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

          // 曲号
          this.sideTrackLabel = this.add
            .text(x, trackY, "01 / 56", {
              fontSize: "19px", // 原 15px，放大约 29%
              fontStyle: "bold",
              color: "#ffd700",
            })
            .setOrigin(0.5);
          this.refreshTrackLabel();
          this.focusHideGroup.push(this.sideTrackLabel);

          // 曲目切换时同步刷新曲号
          bgMusic.onTrackChange(() => this.refreshTrackLabel());

          // 双行一体金框按键：PAYTABLE / SETTING → 打开赔率+设置弹窗
          // 宽度收窄约 10%
          const frameW = Math.round((w - 24) * 0.9);
          const frame = this.add.graphics().setPosition(x, btnCenterY);
          const drawCtrlFrame = (strokeWidth, strokeColor) =>
            this.drawGradientPanel(
              frame,
              frameW,
              frameH,
              12,
              this.shadeColor(0x120a04, 14),
              this.shadeColor(0x120a04, -8),
              0.92,
              strokeColor,
              strokeWidth,
            );
          drawCtrlFrame(1, UI.gold);
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
            })
            .setOrigin(0.5);

          const openCtrl = () => {
            this.sfx.click();
            this.toggleSettingsModal(true);
          };
          frame.on("pointerdown", openCtrl);
          frame.on("pointerover", () => {
            drawCtrlFrame(2, 0xffd700);
            ctrlLabel.setScale(1.05);
          });
          frame.on("pointerout", () => {
            drawCtrlFrame(1, UI.gold);
            ctrlLabel.setScale(1);
          });
          ctrlLabel.setInteractive({ useHandCursor: true });
          ctrlLabel.on("pointerdown", openCtrl);
          this.focusHideGroup.push(frame, ctrlLabel);
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
          const lx = LAYOUT.rightPanelX;
          const pivotY = 355;

          this.createRightClockToggle(lx);

          // 拉杆：赌场风机械组件（金边底座 + 抛光金属杆 + 红宝石球头）
          // 槽体：暗金托板 + 深槽 + 双侧铆钉
          const plate = this.add
            .rectangle(lx, 318, 44, 128, 0x1a1408)
            .setStrokeStyle(2, 0xc9a227);
          const plateInner = this.add
            .rectangle(lx, 318, 36, 118, 0x0c0a06)
            .setStrokeStyle(1, 0x5c4818);
          const grooveOuter = this.add
            .rectangle(lx, 315, 18, 108, 0x2a2210)
            .setStrokeStyle(1, 0x8a7040);
          const grooveSlot = this.add
            .rectangle(lx, 315, 8, 100, 0x050403)
            .setStrokeStyle(1, 0x3a3010);
          const grooveHighlight = this.add
            .rectangle(lx + 5, 315, 2, 96, 0xffe8a0)
            .setAlpha(0.28);
          // 槽两侧装饰铆钉
          [[lx - 14, 270], [lx + 14, 270], [lx - 14, 360], [lx + 14, 360]].forEach(([rx, ry]) => {
            this.add.circle(rx, ry, 3.5, 0x3a3010).setStrokeStyle(1, 0xd4af37);
            this.add.circle(rx - 0.8, ry - 0.8, 1.2, 0xffe8a0, 0.45);
          });

          // 底部固定轴：多层金属环 + 中心螺钉感
          this.add.circle(lx, pivotY, 22, 0x2a2210).setStrokeStyle(2, 0x8a7040);
          this.add.circle(lx, pivotY, 17, 0x1a1a1a).setStrokeStyle(2, 0xffd700);
          this.add.circle(lx, pivotY, 11, 0x4a4a4a).setStrokeStyle(1, 0xc0c0c0);
          this.add.circle(lx, pivotY, 6, 0x222222).setStrokeStyle(1, 0xffd700);
          this.add.circle(lx - 1.5, pivotY - 1.5, 2, 0xffffff, 0.5);

          // 拉杆容器（绕底部轴旋转）——动画逻辑不变
          this.leverContainer = this.add.container(lx, pivotY);

          // 杆身阴影（偏右下，增强立体）
          const armShadow = this.add
            .rectangle(2.5, -46, 16, 100, 0x000000, 0.45)
            .setOrigin(0.5);

          // 杆身外金边
          const armRim = this.add
            .rectangle(0, -48, 14, 98, 0xc9a227)
            .setOrigin(0.5);

          // 杆身主金属
          const arm = this.add
            .rectangle(0, -48, 11, 94, 0x6e6e72)
            .setOrigin(0.5);

          // 杆身渐层高光 / 暗边
          const armShine = this.add
            .rectangle(-2.5, -48, 3.5, 88, 0xf5f5f7)
            .setOrigin(0.5)
            .setAlpha(0.55);
          const armEdge = this.add
            .rectangle(3.5, -48, 2.5, 90, 0x2a2a2e)
            .setOrigin(0.5)
            .setAlpha(0.65);

          // 杆身金色环箍（三道，更像真赌场拉杆）
          const collarYs = [-18, -48, -78];
          const collars = collarYs.map((cy) => {
            const outer = this.add
              .rectangle(0, cy, 18, 7, 0x8a7040)
              .setOrigin(0.5)
              .setStrokeStyle(1, 0xffd700);
            const inner = this.add
              .rectangle(0, cy, 16, 3, 0xffe566)
              .setOrigin(0.5)
              .setAlpha(0.55);
            return [outer, inner];
          });

          // 球头：外金环 → 深红金属 → 亮红芯 → 多层高光
          // （外金环的默认色也是 hover/离开热区时的"复位色"，务必和下方
          //  leverHit 的 pointerout 处理保持一致，避免第一次 hover 后颜色回不去）
          this.leverHandle = this.add
            .circle(0, -100, 26, LEVER_HANDLE_IDLE_FILL)
            .setStrokeStyle(2, 0xffd700);

          const handleGoldRing = this.add
            .circle(0, -100, 22, 0xb8860b)
            .setStrokeStyle(1.5, 0xffe566);

          const handleBody = this.add.circle(0, -100, 18, 0x6b0000);

          this.leverHandleInner = this.add.circle(0, -100, 12, 0xb00018);

          const handleCore = this.add.circle(0, -100, 6, 0xe01830);

          // 主高光（左上）
          const handleHighlight = this.add
            .circle(-7, -108, 7, 0xffffff, 0.75);
          // 次高光
          const handleHighlight2 = this.add
            .circle(6, -94, 3.5, 0xffe8a0, 0.4);
          // 底部反光
          const handleBounce = this.add
            .circle(2, -90, 5, 0xff6b6b, 0.22);

          // 球头底部与杆身衔接的小金颈
          const neck = this.add
            .rectangle(0, -84, 12, 10, 0xc9a227)
            .setOrigin(0.5);
          const neckInner = this.add
            .rectangle(0, -84, 8, 6, 0x5c4010)
            .setOrigin(0.5);

          const leverParts = [
            armShadow,
            armRim,
            arm,
            armShine,
            armEdge,
            neck,
            neckInner,
            this.leverHandle,
            handleGoldRing,
            handleBody,
            this.leverHandleInner,
            handleCore,
            handleHighlight,
            handleHighlight2,
            handleBounce,
          ];
          collars.forEach(([o, i]) => leverParts.push(o, i));
          this.leverContainer.add(leverParts);
          this.leverContainer.setAngle(-18); // 略微倾斜的“待拉”姿态

          // 手柄高光缓慢呼吸
          this.tweens.add({
            targets: handleHighlight,
            alpha: 0.35,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.tweens.add({
            targets: handleCore,
            alpha: 0.75,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });

          // 手（默认隐藏，从侧上方飞入抓住手柄）
          this.handRestX = lx + 55;
          this.handRestY = 205;
          this.handGripX = lx - 8;
          this.handGripY = 263;

          this.leverHand = this.add
            .text(this.handRestX, this.handRestY, "✋", {
              fontSize: "40px",
            })
            .setOrigin(0.35, 0.35)
            .setAlpha(0)
            .setDepth(20)
            .setAngle(-25);

          // 拉杆可点击热区
          this.leverHit = this.add
            .rectangle(lx, 295, 120, 150, 0x000000, 0.01)
            .setInteractive({ useHandCursor: true });

          // 拉杆 / SPIN / 空格 统一：一点即转，转动中再点急停
          this.leverHit.on("pointerdown", () => {
            this.sfx.init();
            this.sfx.warmup();
            this.handleSpinInput();
          });

          this.leverHit.on("pointerover", () => {
            if (this.leverState === "up" && !this.isSpinning) {
              this.leverHandle.setFillStyle(0xffd700);
              this.leverHandle.setStrokeStyle(3, 0xffffff);
            }
          });

          this.leverHit.on("pointerout", () => {
            if (this.leverState !== "down") {
              this.leverHandle.setFillStyle(LEVER_HANDLE_IDLE_FILL);
              this.leverHandle.setStrokeStyle(2, 0xffd700);
            }
          });

          // 拉杆整体（底座、槽、轴、杆身、热区、提示文字）不加入放大分组，
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

          this.rightClockToggleBg = this.add.graphics().setPosition(lx, cy);
          this.drawRoundedPanel(
            this.rightClockToggleBg,
            btnW,
            btnH,
            btnRadius,
            UI.ruby,
            2,
            0x1a140c,
            0.92,
          );

          this.rightClockText = this.add
            .text(lx, clockY, "--:--", {
              fontSize: "21px",
              fontStyle: "bold",
              color: "#ffd700",
              stroke: "#000000",
              strokeThickness: 1,
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

          this.rightClockToggleHit = this.add
            .rectangle(lx, cy, btnW, btnH, 0x000000, 0.01)
            .setInteractive({ useHandCursor: true });

          this.rightClockToggleHit.on("pointerover", () => {
            this.drawRoundedPanel(
              this.rightClockToggleBg,
              btnW,
              btnH,
              btnRadius,
              UI.ruby,
              3.2,
              0x1a140c,
              0.92,
            );
          });
          this.rightClockToggleHit.on("pointerout", () => {
            this.drawRoundedPanel(
              this.rightClockToggleBg,
              btnW,
              btnH,
              btnRadius,
              UI.ruby,
              2,
              0x1a140c,
              0.92,
            );
          });
          this.rightClockToggleHit.on("pointerdown", () => {
            this.tweens.add({
              targets: this.rightClockToggleBg,
              scaleX: 0.94,
              scaleY: 0.94,
              duration: 80,
              yoyo: true,
              ease: "Sine.easeInOut",
            });
            this.toggleFocusMode();
          });
        };

        SlotGame.prototype.createSettingsModal = function() {
          const cx = GAME_WIDTH / 2;
          const cy = GAME_HEIGHT / 2;
          const panelW = 560;
          const panelH = 400;
          const top = cy - panelH / 2;

          this.settingsModalGroup = this.add
            .container(0, 0)
            .setDepth(100)
            .setVisible(false);

          const children = [];

          const overlayKey = "settingsOverlayGradient";
          if (!this.textures.exists(overlayKey)) {
            const rt = this.textures.createCanvas(overlayKey, GAME_WIDTH, GAME_HEIGHT);
            const ctx = rt.getContext();
            const grad = ctx.createRadialGradient(
              cx, cy, 0,
              cx, cy, Math.hypot(cx, cy),
            );
            grad.addColorStop(0, "rgba(0,0,0,0.32)");
            grad.addColorStop(0.55, "rgba(0,0,0,0.6)");
            grad.addColorStop(1, "rgba(0,0,0,0.86)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            rt.refresh();
          }
          const overlay = this.add
            .image(0, 0, overlayKey)
            .setOrigin(0)
            .setInteractive();
          overlay.on("pointerdown", () => this.toggleSettingsModal(false));
          children.push(overlay);

          // 外层微光：圆角版，呼应弹窗本体的圆角
          const modalGlow = this.add.graphics().setPosition(cx, cy);
          modalGlow.fillStyle(UI.gold, 0.08);
          modalGlow.fillRoundedRect(-(panelW + 9) / 2, -(panelH + 9) / 2, panelW + 9, panelH + 9, 22);
          modalGlow.lineStyle(1, UI.goldDim, 0.9);
          modalGlow.strokeRoundedRect(-(panelW + 9) / 2, -(panelH + 9) / 2, panelW + 9, panelH + 9, 22);
          children.push(modalGlow);

          // 弹窗主体：圆角渐变（视觉层），叠加一个透明的矩形热区专门负责拦截点击——
          // 圆角 Graphics 本身不支持精确的圆角点击判定，用不可见矩形兜底最省事可靠。
          const panelVisual = this.add.graphics().setPosition(cx, cy);
          this.drawGradientPanel(
            panelVisual,
            panelW,
            panelH,
            20,
            this.shadeColor(0x0e0a06, 16),
            this.shadeColor(0x0e0a06, -10),
            0.98,
            UI.gold,
            2,
          );
          children.push(panelVisual);

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
          const paySpacing = 43;
          // 8 行中心跨度 = 7 * spacing；上下对称留白，避免内容整体偏上
          const contentSpan = (payRows.length - 1) * paySpacing;
          const payStart = top + (panelH - contentSpan) / 2;
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
              this.shadeColor(0x1a140c, 10),
              this.shadeColor(0x1a140c, -8),
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

          this.settingsModalGroup.add(children);
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

          this.tweens.killTweensOf(this.leverHand);
          this.tweens.killTweensOf(this.leverContainer);

          // 从侧上方飞入并握住
          const midX = (this.handRestX + this.handGripX) / 2 + 8;
          const midY = (this.handRestY + this.handGripY) / 2 - 18;

          this.leverHand.setText("✋");
          this.leverHand.setAlpha(0);
          this.leverHand.setPosition(this.handRestX, this.handRestY);
          this.leverHand.setScale(0.85);
          this.leverHand.setAngle(-40);

          // 1) 淡入 + 弧线接近
          this.tweens.add({
            targets: this.leverHand,
            alpha: 1,
            scale: 1.05,
            duration: 90,
            ease: "Sine.easeOut",
          });

          this.tweens.add({
            targets: this.leverHand,
            x: midX,
            y: midY,
            angle: -18,
            duration: 120,
            ease: "Sine.easeOut",
            onComplete: () => {
              // 2) 落到手柄并握紧
              this.tweens.add({
                targets: this.leverHand,
                x: this.handGripX,
                y: this.handGripY,
                angle: -4,
                scale: 0.96,
                duration: 110,
                ease: "Cubic.easeInOut",
                onComplete: () => {
                  this.leverHand.setText("✊");
                  this.sfx.leverPull();

                  // 3) 微抬蓄力后重压拉下
                  this.tweens.add({
                    targets: this.leverHand,
                    y: this.handGripY - 5,
                    scale: 0.94,
                    duration: 50,
                    ease: "Sine.easeOut",
                    onComplete: () => {
                      this.tweens.add({
                        targets: this.leverHand,
                        x: this.handGripX + 14,
                        y: this.handGripY + 72,
                        angle: 32,
                        scale: 0.88,
                        duration: 260,
                        ease: "Cubic.easeIn",
                        onComplete: () => {
                          this.tweens.add({
                            targets: this.leverHand,
                            y: this.handGripY + 68,
                            scale: 0.92,
                            duration: 90,
                            ease: "Sine.easeOut",
                          });
                        },
                      });
                    },
                  });

                  this.tweens.add({
                    targets: this.leverContainer,
                    angle: -22,
                    duration: 50,
                    ease: "Sine.easeOut",
                    onComplete: () => {
                      this.tweens.add({
                        targets: this.leverContainer,
                        angle: 55,
                        duration: 260,
                        ease: "Cubic.easeIn",
                        onComplete: () => {
                          this.cameras.main.shake(110, 0.008);

                          this.tweens.add({
                            targets: this.leverContainer,
                            angle: 48,
                            duration: 90,
                            yoyo: true,
                            ease: "Sine.easeOut",
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

          this.tweens.killTweensOf(this.leverHand);
          this.tweens.killTweensOf(this.leverContainer);

          // 松手：张开 → 滑开淡出
          this.leverHand.setText("✋");

          this.tweens.add({
            targets: this.leverHand,
            scale: 1.05,
            angle: 8,
            duration: 100,
            ease: "Sine.easeOut",
            onComplete: () => {
              this.tweens.add({
                targets: this.leverHand,
                alpha: 0,
                x: this.handRestX,
                y: this.handRestY - 10,
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

          this.tweens.add({
            targets: this.leverContainer,
            angle: -18,
            duration: 420,
            ease: "Back.easeOut",
          });

          this.leverHandle.setFillStyle(LEVER_HANDLE_IDLE_FILL);
          this.leverHandle.setStrokeStyle(2, 0xffd700);
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

          // 自动模式等非手动拉杆路径：若拉杆未下，补一段简短甩下动画
          if (this.leverState !== "down") {
            this.leverState = "down";
            this.sfx.leverPull();
            this.leverHand.setText("✊");
            this.leverHand.setAlpha(1);
            this.leverHand.setPosition(this.handGripX, this.handGripY);
            this.tweens.add({
              targets: this.leverContainer,
              angle: 48,
              duration: 200,
              ease: "Cubic.easeIn",
            });
            this.tweens.add({
              targets: this.leverHand,
              y: this.handGripY + 70,
              x: this.handGripX + 12,
              angle: 28,
              scale: 0.9,
              duration: 200,
            });
          }

          this.reels.forEach((reel) => {
            if (reel.intervalEvent) {
              reel.intervalEvent.remove(false);
              reel.intervalEvent = null;
            }

            reel.stopped = true;
            reel.forceStopScheduled = false;
            reel.container.y = this.getReelCenterY();
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
                LAYOUT.balanceW - 35,
                21,
                13,
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

          if (reel.intervalEvent) {
            reel.intervalEvent.remove(false);
            reel.intervalEvent = null;
          }

          reel.stopped = false;
          reel.forceStopScheduled = false;

          this.setReelFrameStroke(reel, 3, UI.goldBright);

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
              const step = settings.step * decelRatio;

              reel.items.forEach((item) => {
                item.txt.y += step;
                item.bg.y += step;

                if (item.txt.y > 128) {
                  const symbol = Phaser.Utils.Array.GetRandom(SYMBOLS);

                  item.symbol = symbol;
                  item.txt.y = -128;
                  item.bg.y = -128;
                  item.txt.setText(symbol.label);
                  item.txt.setColor(symbol.color);
                  item.txt.setFontSize(symbol.label.length > 1 ? 42 : 52);
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

          reel.stopped = true;

          if (reel.intervalEvent) {
            reel.intervalEvent.remove(false);
            reel.intervalEvent = null;
          }

          const finalSymbol = this.getControlledResult(index);
          reel.value = finalSymbol;

          reel.items.forEach((item, i) => {
            const randomSymbol = Phaser.Utils.Array.GetRandom(SYMBOLS);

            item.symbol = randomSymbol;
            item.txt.y = (i - 2) * 64;
            item.bg.y = (i - 2) * 64;
            item.txt.setText(randomSymbol.label);
            item.txt.setColor(randomSymbol.color);
            item.txt.setFontSize(randomSymbol.label.length > 1 ? 42 : 52);

            // 非中奖行的符号淡入落位，避免"瞬间贴图切换"的生硬感
            if (i !== 2) {
              item.txt.setAlpha(0.35);
              this.tweens.add({
                targets: item.txt,
                alpha: 1,
                duration: 150,
                ease: "Sine.easeOut",
              });
            }
          });

          const center = reel.items[2];

          center.symbol = finalSymbol;
          center.txt.setText(finalSymbol.label);
          center.txt.setColor(finalSymbol.color);
          center.txt.setFontSize(finalSymbol.label.length > 1 ? 42 : 52);
          center.txt.y = 0;
          center.bg.y = 0;

          this.sfx.reelStop();

          this.tweens.add({
            targets: reel.container,
            y: this.getReelCenterY() + 7,
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

          this.setReelFrameStroke(reel, 2, UI.goldDim);

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
            const center = reel.items[2];
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
          const batch = 12;
          const batches = Math.ceil(amount / batch);
          for (let b = 0; b < batches; b++) {
            this.time.delayedCall(b * 55, () => {
              const count = Math.min(batch, amount - b * batch);
              const ox = Phaser.Math.Between(380, 560);
              const oy = Phaser.Math.Between(160, 240);
              for (let i = 0; i < count; i++) {
                const col = colors[i % colors.length];
                const p = this.add
                  .text(ox, oy, "✦", {
                    fontSize: `${Phaser.Math.Between(14, 26)}px`,
                    color: col,
                  })
                  .setOrigin(0.5)
                  .setDepth(60);
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.Between(80, 220);
                this.tweens.add({
                  targets: p,
                  x: ox + Math.cos(angle) * dist,
                  y: oy + Math.sin(angle) * dist * 0.7 - Phaser.Math.Between(40, 120),
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
          const winText = this.add
            .text(470, 145, text, {
              fontSize: "60px",
              fontStyle: "bold",
              color,
              stroke: "#000000",
              strokeThickness: 9,
              shadow: {
                offsetX: 0,
                offsetY: 0,
                color,
                blur: 16,
                fill: true,
              },
            })
            .setOrigin(0.5);

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
          const batchSize = 15;
          const batches = Math.ceil(amount / batchSize);

          for (let batch = 0; batch < batches; batch++) {
            this.time.delayedCall(batch * 40, () => {
              const count = Math.min(batchSize, amount - batch * batchSize);

              for (let i = 0; i < count; i++) {
                const coin = this.add
                  .text(
                    Phaser.Math.Between(350, 590),
                    Phaser.Math.Between(200, 310),
                    "●",
                    {
                      fontSize: `${Phaser.Math.Between(18, 30)}px`,
                      color: "#ffd700",
                      stroke: "#7a3b00",
                      strokeThickness: 1,
                    },
                  )
                  .setOrigin(0.5);

                this.tweens.add({
                  targets: coin,
                  x: coin.x + Phaser.Math.Between(-300, 300),
                  y: coin.y - Phaser.Math.Between(90, 240),
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
          if (this.balanceValue) {
            fitTextToBox(
              this.balanceValue,
              this.formatInt(this.balance),
              LAYOUT.balanceW - 35,
              21,
              13,
            );
          }
          if (this.modalBetValue) {
            this.modalBetValue.setText(this.formatInt(this.bet));
          }
          if (this.lastWinValue) {
            fitTextToBox(
              this.lastWinValue,
              this.formatInt(this.lastWin),
              LAYOUT.lastWinW - 35,
              21,
              13,
            );
          }
          if (this.jackpotText) {
            fitTextToBox(
              this.jackpotText,
              `🏵️ Jackpot ${this.formatMoney(this.jackpotValue)}`,
              320,
              24,
              16,
            );
          }
          if (this.portraitMode) this.syncPortraitHUD();
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
          this.saveGameState();
        };

        SlotGame.prototype.formatInt = function(value) {
          return String(Math.round(Number(value)));
        };
        SlotGame.prototype.formatMoney = SlotGame.prototype.formatInt;

        SlotGame.prototype.setMessage = function(value, baseFontSize = 20) {
          if (this.messageText) {
            fitTextToBox(
              this.messageText,
              value,
              LAYOUT.messageW - 28,
              baseFontSize,
              12,
            );
          }
          if (this.portraitMode && typeof window.syncPortraitHUD === "function") {
            window.syncPortraitHUD({ message: value });
          }
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

          // 拉杆正在下落动画中，忽略重复点击
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

          const scale = this.focusMode ? 1.15 : 1;
          const cx = this.machineScaleAnchor.x;
          const cy = this.machineScaleAnchor.y;
          const targetProps = {
            scaleX: scale,
            scaleY: scale,
            x: cx * (1 - scale),
            y: cy * (1 - scale),
          };
          if (silent) {
            this.machineScaleGroup.setScale(scale, scale);
            this.machineScaleGroup.setPosition(
              targetProps.x,
              targetProps.y
            );
          } else {
            this.tweens.add({
              targets: this.machineScaleGroup,
              ...targetProps,
              duration: 260,
              ease: "Sine.easeInOut",
            });
          }
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
          this.machineGlow.setAlpha(0.07);
          this.tweens.add({
            targets: this.machineGlow,
            alpha: 0.13,
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


        SlotGame.prototype.getReelCenterY = function() {
          if (this.portraitMode && this._portraitReelLayout) {
            return this._portraitReelLayout.cy;
          }
          return LAYOUT.reelY;
        };

        SlotGame.prototype.syncPortraitHUD = function() {
          if (typeof window.syncPortraitHUD !== "function") return;
          window.syncPortraitHUD({
            balance: this.formatInt(this.balance),
            bet: this.formatInt(this.bet),
            lastWin: this.formatInt(this.lastWin),
            jackpot: this.formatMoney(this.jackpotValue),
            message: (this.messageText && this.messageText.text) || "",
          });
        };

        SlotGame.prototype.setPortraitMode = function(on) {
          this.portraitMode = !!on;

          if (this.cameras && this.cameras.main) {
            this.cameras.main.setBackgroundColor(on ? "rgba(0,0,0,0)" : "#030202");
          }
          if (this._backdropGfx) this._backdropGfx.setVisible(!on);

          const hideExtras = [];
          if (this.focusHideGroup) hideExtras.push.apply(hideExtras, this.focusHideGroup);
          if (this.jackpotText) hideExtras.push(this.jackpotText);
          if (this.jackpotStars) hideExtras.push.apply(hideExtras, this.jackpotStars);
          if (this.balanceValue) hideExtras.push(this.balanceValue);
          if (this.lastWinValue) hideExtras.push(this.lastWinValue);
          if (this.messageText) hideExtras.push(this.messageText);
          if (this.leverContainer) hideExtras.push(this.leverContainer);
          if (this.leverHit) hideExtras.push(this.leverHit);
          if (this.leverHand) hideExtras.push(this.leverHand);
          if (this.machineGlow) hideExtras.push(this.machineGlow);

          hideExtras.forEach((obj) => {
            if (!obj) return;
            try {
              if (on) {
                if (obj._portraitPrevVis === undefined) {
                  obj._portraitPrevVis = obj.visible !== false;
                }
                obj.setVisible(false);
              } else if (obj._portraitPrevVis !== undefined) {
                obj.setVisible(!!obj._portraitPrevVis);
                delete obj._portraitPrevVis;
              }
            } catch (e) {}
          });

          if (this.machineScaleGroup && this.machineScaleGroup.list) {
            const keep = new Set();
            if (this.reels) {
              this.reels.forEach((r) => {
                if (r.container) keep.add(r.container);
                if (r.frame) keep.add(r.frame);
              });
            }
            if (this.paylineTop) keep.add(this.paylineTop);
            if (this.paylineMiddle) keep.add(this.paylineMiddle);
            if (this.paylineBottom) keep.add(this.paylineBottom);

            this.machineScaleGroup.list.forEach((obj) => {
              if (!obj) return;
              if (on) {
                if (obj._portraitPrevVis === undefined) {
                  obj._portraitPrevVis = obj.visible !== false;
                }
                obj.setVisible(keep.has(obj));
              } else if (obj._portraitPrevVis !== undefined) {
                obj.setVisible(!!obj._portraitPrevVis);
                delete obj._portraitPrevVis;
              }
            });
          }

          if (on && this.reels && this.reels.length) {
            const n = this.reels.length;
            const gap = 6;
            const frameW = Math.floor((GAME_WIDTH - gap * (n - 1)) / n);
            const frameH = Math.floor(GAME_HEIGHT * 0.92);
            const startX = frameW / 2;
            const cy = GAME_HEIGHT / 2;
            this._portraitReelLayout = { frameW, frameH, cy };
            this.reels.forEach((reel, i) => {
              const x = startX + i * (frameW + gap);
              if (reel.frame) {
                reel.frame.setPosition(x, cy);
                this.drawGradientPanel(
                  reel.frame,
                  frameW - 6,
                  frameH,
                  10,
                  this._reelFrameTop || 0x090b0b,
                  this._reelFrameBottom || 0x090b0b,
                  0.25,
                  UI.goldDim,
                  1,
                );
              }
              if (reel.container) reel.container.setPosition(x, cy);
            });
            if (this.paylineTop) {
              this.paylineTop.setPosition(GAME_WIDTH / 2, cy - 64).setVisible(true);
              this.paylineTop.width = GAME_WIDTH - 16;
            }
            if (this.paylineMiddle) {
              this.paylineMiddle.setPosition(GAME_WIDTH / 2, cy).setVisible(true);
              this.paylineMiddle.width = GAME_WIDTH - 16;
            }
            if (this.paylineBottom) {
              this.paylineBottom.setPosition(GAME_WIDTH / 2, cy + 64).setVisible(true);
              this.paylineBottom.width = GAME_WIDTH - 16;
            }
            if (this.machineScaleGroup) {
              this.machineScaleGroup.setScale(1);
              this.machineScaleGroup.setPosition(0, 0);
            }
          }

          if (on) this.syncPortraitHUD();
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

        /**
         * 写入存档。
         * @param {boolean} [immediate] true 时立刻落盘；否则 50ms 合并写入
         */
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
