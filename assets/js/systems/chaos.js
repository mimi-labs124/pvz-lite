// ═══════════════════════════════════════════════
// Chaos System — 混亂事件
// ═══════════════════════════════════════════════
import { CHAOS_EVENTS, cols } from '../config.js';
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

  // ── Chaos Awakening: 遺物影響混沌間隔 ──
  const chaosDelay = state.relicBuffs?.chaosDelay || 0;
  state.nextChaosAt = (18 + Math.random() * 12) * (1 + chaosDelay);

  // ── Chaos Awakening: 混沌珍珠 — 機率反轉 ──
  const invertChance = state.relicBuffs?.chaosInvertChance || 0;
  if (invertChance > 0 && Math.random() < invertChance) {
    state.chaosInverted = true;
    applyInvertedChaosEffect(state, event);
    return { ...event, name: event.name + '（反轉！）', desc: '效果反轉為正面！' };
  }
  state.chaosInverted = false;

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
  state.chaosHarnessed = false;
  state.harnessEffect = null;
  state.chaosInverted = false;
}

// ── Chaos Awakening: 反轉混沌效果 ──────────
function applyInvertedChaosEffect(state, event) {
  switch (event.id) {
    case 'meteor': {
      // 隕石反轉：隨機 3 格植物獲得 +30% HP
      const plantKeys = [...state.plants.keys()];
      const targets = shuffleArray(plantKeys).slice(0, 3);
      for (const key of targets) {
        const p = state.plants.get(key);
        if (p) { p.hp = Math.round(p.hp * 1.3); p.maxHp = Math.round(p.maxHp * 1.3); }
      }
      break;
    }
    case 'mutation': {
      // 突變反轉：殭屍 debuff
      for (const z of state.zombies) {
        z.speed *= 0.85; z.hp = Math.round(z.hp * 0.85);
      }
      break;
    }
    case 'eclipse': {
      // 日蝕反蝕反轉：雙倍陽光掉落 8 秒
      state.globalBuffs.sunIncome = (state.globalBuffs.sunIncome || 0) + 1.0;
      state._eclipseInvertTimer = 8;
      break;
    }
    case 'gravity': {
      // 重力反轉：殭屍被推後 1 格
      for (const z of state.zombies) {
        z.x = Math.min(cols, z.x + 1);
      }
      break;
    }
    case 'fertile': {
      // 肥沃之雨反轉：已經是正面的，攻速再加 10%
      state.globalBuffs.attackSpeed = (state.globalBuffs.attackSpeed || 0) + 0.10;
      break;
    }
    case 'undead': {
      // 亡者歸來反轉：殭屍不復活，改為每隻死亡殭屍 +10 陽光
      state.chaosHarnessed = true;
      state.harnessEffect = { type: 'soul_harvest', sunPerUndead: 10 };
      break;
    }
    case 'sunshower': {
      // 陽光暴雨反轉：已經是正面的，掉落量 +50%
      state.globalBuffs.sunIncome = (state.globalBuffs.sunIncome || 0) + 0.50;
      state._sunshowerInvertTimer = 8;
      break;
    }
    case 'earthquake': {
      // 大地震反轉：植物被排列整齊 + 全體 +10% HP
      for (const [key, plant] of state.plants) {
        const bonus = Math.round(plant.maxHp * 0.10);
        plant.hp += bonus;
        plant.maxHp += bonus;
      }
      break;
    }
  }
}

// 檢查是否在混亂事件中
export function isChaosActive(state, eventId) {
  return state.chaosEvent && state.chaosEvent.id === eventId;
}

// 殭屍死亡時有機率復活 (亡者歸來)
// 靈魂收割馴服：不復活，改給陽光
export function chaosUndeadCheck(state, zombie) {
  if (!isChaosActive(state, 'undead')) return false;
  // 靈魂收割：每隻殭屍死亡給陽光
  if (state.chaosHarnessed && state.harnessEffect?.type === 'soul_harvest') {
    const bonus = state.harnessEffect.sunPerUndead || 25;
    state.sun += bonus;
    return false; // 不復活，改給陽光
  }
  if (Math.random() < 0.2) {
    return true; // 復活!
  }
  return false;
}
