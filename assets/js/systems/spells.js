// ═══════════════════════════════════════════════
// Spell System — 主動法術
// ═══════════════════════════════════════════════
import { SPELLS } from '../config.js';

export function canCastSpell(state, spellId) {
  if (!state.unlockedSpells.includes(spellId)) return false;
  if ((state.spellCooldowns[spellId] || 0) > 0) return false;
  return true;
}

export function castSpell(state, spellId) {
  if (!canCastSpell(state, spellId)) return false;
  const spell = SPELLS[spellId];
  if (!spell) return false;

  state.spellCooldowns[spellId] = spell.cooldown;

  switch (spellId) {
    case 'frostwave':
      // 凍結全場殭屍 3 秒
      for (const z of state.zombies) {
        z.slowTimer = Math.max(z.slowTimer || 0, 3);
        z.frozen = true;
        z.frozenTimer = 3;
      }
      return { type: 'frostwave', msg: '❄️ 冰霜之浪！全場凍結 3 秒！' };

    case 'sunburst':
      // 獲得 150 陽光
      const sunBonus = Math.round(150 * (1 + (state.globalBuffs.sunIncome || 0)));
      state.sun += sunBonus;
      return { type: 'sunburst', msg: `☀️ 陽光爆發！獲得 ${sunBonus} 陽光！` };

    case 'timewarp':
      // 殭屍減速 50% 持續 8 秒
      for (const z of state.zombies) {
        z.warpSlow = true;
        z.warpTimer = 8;
      }
      return { type: 'timewarp', msg: '⏳ 時間扭曲！殭屍減速 8 秒！' };

    case 'plantSwap': {
      // 交換兩棵植物 — 標記為等待選擇
      state.swapMode = true;
      state.swapFirst = null;
      return { type: 'plantswap', msg: '🔄 點選兩棵植物來交換位置！' };
    }

    case 'annihilate': {
      // 消滅血量最低的 3 隻殭屍
      const sorted = [...state.zombies].sort((a, b) => a.hp - b.hp);
      const targets = sorted.slice(0, 3);
      for (const z of targets) {
        z.hp = -999;
      }
      return { type: 'annihilate', msg: `⚡ 殲滅光束！消滅了 ${targets.length} 隻殭屍！` };
    }

    default:
      return false;
  }
}

export function updateSpellCooldowns(state, dt) {
  for (const spellId of state.unlockedSpells) {
    if (state.spellCooldowns[spellId] > 0) {
      state.spellCooldowns[spellId] = Math.max(0, state.spellCooldowns[spellId] - dt);
    }
  }
}

// 更新法術效果
export function updateSpellEffects(state, dt) {
  for (const z of state.zombies) {
    // 凍結效果
    if (z.frozenTimer > 0) {
      z.frozenTimer -= dt;
      if (z.frozenTimer <= 0) z.frozen = false;
    }
    // 時間扭曲效果
    if (z.warpTimer > 0) {
      z.warpTimer -= dt;
      if (z.warpTimer <= 0) z.warpSlow = false;
    }
  }
}
