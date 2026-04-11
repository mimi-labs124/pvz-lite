// ═══════════════════════════════════════════════
// Chaos System — 混亂事件
// ═══════════════════════════════════════════════
import { CHAOS_EVENTS } from '../config.js';
import { randomPick, shuffleArray, cellKey } from '../core/helpers.js';

// 檢查是否該觸發混亂事件
export function checkChaosTrigger(state, dt) {
  if (state.chaosEvent) {
    // 已有事件進行中
    state.chaosTimer -= dt;
    if (state.chaosTimer <= 0) {
      endChaosEvent(state);
    }
    return null;
  }

  state.chaosCooldown = (state.chaosCooldown || 0) + dt;
  if (state.chaosCooldown >= state.nextChaosAt) {
    return triggerChaosEvent(state);
  }
  return null;
}

// 觸發混亂事件
function triggerChaosEvent(state) {
  const event = randomPick(CHAOS_EVENTS);
  state.chaosEvent = event;
  state.chaosTimer = event.duration || 1;
  state.chaosCooldown = 0;
  state.nextChaosAt = 18 + Math.random() * 12; // 下次 18~30 秒

  applyChaosEffect(state, event);
  return event;
}

// 應用混亂事件效果
function applyChaosEffect(state, event) {
  switch (event.id) {
    case 'meteor': {
      // 隨機摧毀 3 格植物
      const plantKeys = [...state.plants.keys()];
      const targets = shuffleArray(plantKeys).slice(0, 3);
      for (const key of targets) {
        state.plants.delete(key);
      }
      break;
    }
    case 'mutation': {
      // 殭屍隨機 buff
      for (const z of state.zombies) {
        const roll = Math.random();
        if (roll < 0.3) { z.speed *= 1.2; z.hp = Math.round(z.hp * 1.15); z.maxHp = Math.round(z.maxHp * 1.15); }
        else if (roll < 0.6) { z.biteDmg = (z.biteDmg || 18) + 5; }
      }
      break;
    }
    case 'eclipse':
      // 陽光停止 — 在 update loop 裡檢查 chaosEvent.id
      break;
    case 'gravity': {
      // 殭屍隨機換排
      for (const z of state.zombies) {
        if (Math.random() < 0.4) {
          z.row = Math.floor(Math.random() * 5);
        }
      }
      break;
    }
    case 'fertile':
      // 植物攻速 +40% — 在 combat 裡檢查
      break;
    case 'undead':
      // 亡者歸來 — 在 cleanup 裡處理
      break;
    case 'sunshower':
      // 陽光暴雨 — 在 economy 裡處理
      break;
    case 'earthquake': {
      // 大地震 — 隨機兩排的植物左右位移
      const affectedRows = shuffleArray([0, 1, 2, 3, 4]).slice(0, 2);
      for (const row of affectedRows) {
        const toMove = [];
        for (const [key, plant] of state.plants) {
          if (plant.row === row) toMove.push({ key, plant });
        }
        for (const { key, plant } of toMove) {
          const newCol = Math.max(0, Math.min(8, plant.col + (Math.random() < 0.5 ? -1 : 1)));
          if (!state.plants.has(cellKey(plant.row, newCol))) {
            state.plants.delete(key);
            plant.col = newCol;
            state.plants.set(cellKey(plant.row, newCol), plant);
          }
        }
      }
      break;
    }
  }
}

// 結束混亂事件
function endChaosEvent(state) {
  state.chaosEvent = null;
  state.chaosTimer = 0;
}

// 檢查是否在混亂事件中
export function isChaosActive(state, eventId) {
  return state.chaosEvent && state.chaosEvent.id === eventId;
}

// 殭屍死亡時有機率復活 (亡者歸來)
export function chaosUndeadCheck(state, zombie) {
  if (isChaosActive(state, 'undead') && Math.random() < 0.2) {
    return true; // 復活!
  }
  return false;
}
