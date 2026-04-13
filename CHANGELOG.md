# Changelog

## 2026-04-13 v2 — 大量可玩性更新

### 新植物
- 🔥 **火炬樹 (Torchwood)** — 豌豆經過變火球，2x 傷害 + 濺射相鄰殭屍

### 新殭屍
- ⛏️ **礦工殭屍 (Digger)** — 從地下繞過防線，數秒後從左側冒出
- 🚩 **旗子殭屍 (Flag Zombie)** — 預告大波來襲，每 5 波觸發額外殭屍

### 新系統
- 🪏 **鏟子工具** — 移除植物退回 50% 陽光（櫻桃炸彈除外）
- 🔥 **連殺 Combo** — 快速擊殺累計 combo，3x/5x/10x 給 bonus 陽光
- 🏆 **成就系統** — 12 個成就，解鎖時彈出 toast，持久化到 localStorage
- 💾 **最佳紀錄** — 每個難度保存最高擊殺/波數/連殺，localStorage 持久化
- ❄️ **冰雹風暴 (Hailstorm)** — 新 modifier，每 5 波觸發，隨機冰傷植物

### 改進
- 波次公告 toast 顯示大波提示
- 連殺 combo 數字脈衝動畫
- 火球視覺效果（紅色大豌豆 + 火光）
- 礦工殭屍地下狀態半透明模糊效果
- 火炬樹發光 box-shadow
- 遊戲結束顯示最高連殺
- 新音效：ignite / fire_hit / shovel / achievement / combo

## 2026-04-13 v1 — 架構重構

- 架構重構：將 UI event binding 集中到 `ui/bindings.js`
- 架構重構：抽出 game lifecycle / loop 到 `core/loop.js`
- 架構重構：抽出 shop UI 到 `ui/shop-ui.js`，plant placement 到 `systems/placement.js`
- 架構重構：`main.js` 成為純 bootstrap entry
- 架構重構：`game.js` 瘦身為 orchestrator，update pipeline 明確命名 phase
- 新增植物：大嘴花 (Chomper) — 可秒殺一隻殭屍，但咀嚼時間長
- 新增殭屍：旗子殭屍 (Flag Zombie) — 預告大波殭屍來襲
- 新增 UI：波次公告 toast，大波時會紅色高亮
- 新增音效：chomp（大嘴花吞噬聲）
- 新增 CSS：大嘴花咀嚼動畫、旗子殭屍樣式

## 2026-03-14

- 將原本單檔 `index.html` 拆分為外部 CSS / JS
- 進一步升級為 ES module 結構
- 新增戰況列與 modifier 系統（Solar Flare / Iron Fog / Blood Moon）
- 新增創意植物：稜鏡花、賭徒花、大嘴花
- 新增創意殭屍：分裂殭分裂殭屍、帶盾殭屍
