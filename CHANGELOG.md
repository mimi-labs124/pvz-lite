# Changelog

## 2026-03-14
- 將原本單檔 `index.html` 拆分為外部 CSS / JS
- 進一步升級為 ES module 結構：
  - `assets/js/config.js`
  - `assets/js/audio.js`
  - `assets/js/dom.js`
  - `assets/js/game.js`
  - `assets/js/main.js`
- 保留 `versions/index-2026-03-14.html` 作為單檔版備份
- 新增戰況列（battle status）與 modifier tag
- 加入創意波次 modifier：
  - `Solar Flare`：陽光掉落更快、向日葵產出變多、雙發射手折扣
  - `Iron Fog`：陽光變慢、節奏更硬、向日葵更貴
- 戰況列會根據 modifier / 危險程度切換視覺狀態
- 卡牌現在會顯示 modifier 後的實際成本與提示
- 新增 `暫停 / 繼續` 控制
- 新增關卡提示 pill（level hint）
- 新增創意植物：`稜鏡花`，可同時打中相鄰列，讓站位更有意思
- 新增後期帶盾殭屍變體，提升中後期壓力與火力分配需求
- 新增 `賭徒花`：高波動輸出，可能暴擊也可能打很爛
- 新增 `分裂殭屍`：擊殺後會裂成兩隻小殭屍
- 新增 `Blood Moon`：殭屍更快，但擊殺回更多陽光
- 開始將 `game.js` 拆分為 `systems/status.js`、`systems/spawn.js`、`systems/shop.js`
- 持續拆分為 `core/`、`systems/`、`render/`、`ui/` 結構，新增 `systems/modifiers.js`、`systems/cleanup.js`、`render/entities.js`、`ui/controls.js`、`systems/combat.js`
