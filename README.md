# 万锦老虎机

Phaser 3 纯前端老虎机。横屏 1536×1024 / 竖屏 1024×1536，各用一张 Royale 底图。

## 加载顺序

```
phaser.min.js → config.js → layout.js → sound-fx.js → bg-music.js → slot-game.js → app.js
```

| 文件 | 作用 |
|---|---|
| `config.js` | 符号表、概率表、`rollSpinResult` / `evaluateSpinResult` |
| `layout.js` | 横竖屏坐标预设、`UI` 配色、`fitTextToBox` |
| `sound-fx.js` | Web Audio 合成音效 |
| `bg-music.js` | 背景音乐（曲号进度可续播） |
| `slot-game.js` | 主场景逻辑与 UI |
| `app.js` | 启动、横竖屏切换、音频解锁 |
| `styles.css` | 页面壳与画布比例锁定 |
| `assets/` | 底图与拉杆抠图 |

## 资源

- `assets/royale_landscape.webp` / `royale_portrait.webp`（转轴窗口透明）
- `assets/lever_ball_*.png` / `lever_shaft_*.png`

底图中 BALANCE/BET/LAST WIN 文字与原位拉杆已抹除，由代码绘制。

## 玩法要点

- 拉杆 / SPIN / 空格：一点即转，转动中再操作急停
- 仅正中一行判奖；竖屏显示 5 行（上下行压暗）
- 结果先按概率表定类型再倒推符号（RTP ≈ 87%）
- 「简/繁」：隐藏/显示左侧音乐设置面板
- 设置弹窗：赔率、速度、自动 5 次、音效、下注与筹码

## 横竖屏

- 启动按方向选布局；切换时存档 → 淡出 → 改画布尺寸 → 场景重启 → 淡入
- 转动中延迟切换；多轮 `scale.refresh` + 视口居中，避免竖屏上移
- 竖屏 Jackpot 无边框；横屏保留霓虹胶囊

## 存档（localStorage）

- `wanjin_slot_save`：余额、下注、奖池、上次获胜、速度、音效开关
- `bgMusicEnabled` / `bgMusicPlayMode` / `bgMusicCurrentNum` / `bgMusicCurrentTime`

刷新页面后音乐会从上次进度续播（需一次用户手势解锁音频）。

## 调试

- `window.__slotGame` — Phaser.Game
- `window.__slotGameScene` — SlotGame 场景
- `bgMusic` — 背景音乐单例
