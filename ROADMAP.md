# Roadmap

## Near-term
- 改善手機版操作體驗（觸控選植物 + 放置的流程）
- 增加 flag zombie 特殊行為：出現時觸發額外 1~2 隻殭屍
- 微調大嘴花平衡（咀嚼時間、是否可吃巨人）
- 把 CSS 再依 layout / components / game board 拆分
- 繼續調整戰況提示與波次節奏
- 將遊戲平衡參數整理成可單獨調整的設定檔

## Mid-term
- 加入更多植物 / 殭屍 / 關卡內容
- 增加更清楚的 UI 狀態提示（冷卻倒數、即將到來的 modifier）
- 加入存檔功能（localStorage）
- 加入成就系統
- shop.js DOM 操作分離：system 層只管成本/冷卻，UI 層負責渲染

## Longer-term
- 若需要，再升級成更完整的前端專案（例如 Vite）
- 將美術/音效資源拆到 `assets/` 下管理
- 加入 PWA 支援
