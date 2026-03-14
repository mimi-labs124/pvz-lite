# 2026-03-14 Next Step Review

這份文件是為了讓之後回來看時，可以快速接上目前的拆分思路與優先順序。

## Current state

目前專案已經不再是單檔結構，模組輪廓開始成形：

- `assets/js/core/`
- `assets/js/systems/`
- `assets/js/render/`
- `assets/js/ui/`

已完成的代表性拆分：

- `core/state.js`：state 建立與 cooldown 初始化
- `render/board.js`：棋盤 DOM 建立
- `render/entities.js`：實體渲染
- `systems/combat.js`：主要戰鬥更新
- `systems/spawn.js`：殭屍生成
- `systems/shop.js`：商店成本 / 冷卻 / UI 狀態更新
- `systems/status.js`：戰況與關卡提示
- `systems/economy.js`：陽光相關
- `ui/controls.js`：暫停 / 繼續控制

## Current diagnosis

`game.js` 雖然已經比原本乾淨很多，但仍然同時承擔多種不同層級責任：

- state reset / init
- shop 建立
- board 建立
- plant placement
- mower update
- main update loop
- render dispatch
- game end
- frame scheduling
- event binding

這表示它已經從「萬能垃圾桶」進步成「偏胖 orchestrator」，但還沒有真的瘦下來。

另外，`main.js` 與 `game.js` 的邊界也還沒完全固定：

- `main.js` 目前處理 audio UI / restart / play again / level change
- `game.js` 目前處理 pause 與 board 互動事件

可以跑，但責任分界仍不夠一致。

## Immediate cleanup item

`game.js` 目前還留有一個明顯的拆分殘件：

- `bindAudioUi()`

這個函式目前不完整，像是上一輪拆分時留下的半成品，因此適合作為下一輪整理的起點。

## Recommended priority order

### Priority 1 — 收斂 UI wiring 與 event binding

先把下列責任整理成一致的 UI binding 層：

- audio slider
- restart / play again
- level select
- pause button
- board 上的互動事件（可視情況一起整理）

建議方向：

- 新增 `assets/js/ui/bindings.js`
- 或拆成 `ui/audio.js` + `ui/game-events.js`

目標：

- `main.js` 成為單純 bootstrap entry
- `game.js` 專注在 runtime 與流程串接

### Priority 2 — 抽 game lifecycle / loop

目前這些東西屬於同一群：

- `startGame()`
- `gameEnd()`
- `frame()`
- `isPaused`
- `loopId`
- `lastTime`

它們建議被整理到：

- `assets/js/core/loop.js`
- 或 `assets/js/systems/lifecycle.js`

目標：

- 把 requestAnimationFrame / pause state / timing control 從 `game.js` 剝離
- 讓 `game.js` 更像真正的 orchestrator

### Priority 3 — 抽 placement 與 shop construction

建議後續處理：

- `buildShop()` → `ui/shop.js`
- `selectPlant()` → `ui/shop.js` 或相近模組
- `placePlant()` → `systems/placement.js` 或 `systems/plants.js`

原因：

- `buildShop()` 比較偏 UI 建構
- `placePlant()` 比較偏玩家行為規則與遊戲判定

### Priority 4 — 整理 update pipeline

目前 `update()` 已經接近 pipeline，但還可再明確命名 phase：

- modifier phase
- spawn phase
- economy phase
- combat phase
- mower / board hazard phase
- cleanup phase
- ui sync phase
- end condition checks

這一步不一定要先拆成多檔；先把 function phase 命名清楚就很有價值。

## What NOT to prioritize next

目前不建議優先把 `systems/combat.js` 再細拆成更多檔。

原因：

- 現在的收益不如先整理骨架
- 專案目前真正的痛點在 orchestrator 邊界與 lifecycle / UI wiring
- 再拆 combat 容易提早進入「檔案變多，但骨架沒更清楚」的狀態

## Architectural caution

`systems/shop.js` 目前仍直接操作 DOM（query `.card`）。

短期可接受，但若未來繼續正式化，建議逐步分離：

- system 層：只負責成本 / 冷卻 / 可購買狀態
- ui 層：負責 card DOM 渲染與更新

這不是當前第一優先，但之後值得收斂。

## Suggested next commits

1. **refactor(ui): consolidate UI bindings and remove leftover audio binding stub**
2. **refactor(loop): extract game lifecycle and requestAnimationFrame control**
3. **refactor(game): move shop construction and plant placement out of game.js**

## Summary

下一步最值得做的，不是繼續先拆 combat，
而是優先整理：

- UI / event binding 邊界
- lifecycle / loop 控制
- `game.js` 中仍過胖的 orchestration 責任

這樣後續再拆 placement / shop / pipeline 時，整體會順很多。