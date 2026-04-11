// ═══════════════════════════════════════════════
// Chaos Harnessing — 混沌馴服系統
// ═══════════════════════════════════════════════
// 進化到 Lv.2+ 的植物有機率「馴服」即將發生的混沌事件，
// 將其轉化為正面效果。不同植物馴服不同類型的事件。

import { isChaosActive } from './chaos.js';

// ── 馴服定義：哪種植物可以馴服哪種混沌 ──────
export const HARNESSES = {
  sunflower: {
    eclipse: {
      name: '逆蝕', emoji: '🌅',
      desc: '日蝕轉化為「極光」：每秒 +8 陽光',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'aurora', sunPerSec: 8 };
      },
    },
    sunshower: {
      name: '陽光共鳴', emoji: '☀️',
      desc: '陽光暴雨轉化為「陽光海嘯」：產量翻倍',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'tsunami', multiplier: 2.0 };
      },
    },
  },
  wallnut: {
    earthquake: {
      name: '扎根', emoji: '🏔️',
      desc: '大地震轉化為「地脈之力」：所有植物 HP +20%',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'earthpower' };
        for (const [key, plant] of state.plants) {
          const bonus = Math.round(plant.maxHp * 0.2);
          plant.hp += bonus;
          plant.maxHp += bonus;
        }
      },
    },
    meteor: {
      name: '鐵壁', emoji: '🛡️',
      desc: '隕石轉化為「流星護盾」：5 秒內植物無敵',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'shield', duration: 5 };
        state.shieldTimer = 5;
      },
    },
  },
  peashooter: {
    mutation: {
      name: '逆向突變', emoji: '🧬',
      desc: '殭屍突變轉化為「基因崩潰」：殭屍 -15% HP',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'genecrash' };
        for (const z of state.zombies) {
          z.hp = Math.round(z.hp * 0.85);
          z.maxHp = Math.round(z.maxHp * 0.85);
        }
      },
    },
  },
  icepea: {
    gravity: {
      name: '冰封引力', emoji: '🌀',
      desc: '重力反轉轉化為「冰渦」：殭屍向中央集中 + 緩速',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'icevortex' };
        for (const z of state.zombies) {
          z.row = 2; // 集中到中間排
          z.speed *= 0.7; // 緩速
        }
      },
    },
  },
  firepea: {
    meteor: {
      name: '隕石鍛造', emoji: '☄️',
      desc: '隕石轉化為「火雨」：殭屍全體燒傷 3 秒',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'fire_rain' };
        for (const z of state.zombies) {
          z.burning = 3;
        }
      },
    },
  },
  oracle: {
    undead: {
      name: '靈魂審判', emoji: '⚖️',
      desc: '亡者歸來轉化為「靈魂收割」：每隻復活殭屍化為 +25 陽光',
      apply: (state) => {
        state.chaosHarnessed = true;
        state.harnessEffect = { type: 'soul_harvest', sunPerUndead: 25 };
      },
    },
  },
};

// ── 計算馴服率 ────────────────────────────────
// 基礎率：Lv.2 = 20%, Lv.3 = 40%
// 遺物加成：+harnessBonus
export function calculateHarnessChance(state, eventType) {
  let totalChance = 0;
  const harnessBonus = state.relicBuffs?.harnessBonus || 0;

  for (const [key, plant] of state.plants) {
    const harnessDef = HARNESSES[plant.type];
    if (!harnessDef || !harnessDef[eventType]) continue;

    const level = plant.level || 1;
    if (level < 2) continue;

    const baseChance = level === 2 ? 0.20 : 0.40;
    totalChance += baseChance;
  }

  // 每株可馴服的植物貢獻，但上限 85%
  totalChance = Math.min(totalChance * (1 + harnessBonus), 0.85);
  return totalChance;
}

// ── 嘗試馴服混沌事件 ──────────────────────────
export function tryHarnessChaos(state, event) {
  if (!event || state.chaosHarnessed) return null;

  const chance = calculateHarnessChance(state, event.id);
  if (Math.random() >= chance) return null;

  // 尋找可以馴服這個事件的植物
  let bestHarness = null;
  let bestLevel = 0;

  for (const [key, plant] of state.plants) {
    const harnessDef = HARNESSES[plant.type];
    if (!harnessDef || !harnessDef[event.id]) continue;
    const level = plant.level || 1;
    if (level >= 2 && level > bestLevel) {
      bestHarness = harnessDef[event.id];
      bestLevel = level;
    }
  }

  if (!bestHarness) return null;

  // 馴服成功！應用正面效果
  bestHarness.apply(state);
  return bestHarness;
}
