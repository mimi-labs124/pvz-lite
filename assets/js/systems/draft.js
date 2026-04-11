// ═══════════════════════════════════════════════
// Draft System — 波次間抽牌
// ═══════════════════════════════════════════════
import { DRAFT_POOL, PLANTS, SPELLS } from '../config.js';
import { shuffleArray, randomPick } from '../core/helpers.js';

// 生成 3 張候選牌
export function generateDraftCards(state) {
  const cards = [];
  const wave = state.wave;

  // 權重池
  const pool = [];

  // ── 植物牌 ──
  // 已有的植物：提供「進化催化」卡
  // 沒有的植物：提供「獲得」卡
  for (const plantId of DRAFT_POOL.plants_t1) {
    pool.push({ type: 'plant', id: plantId, weight: state.deck.includes(plantId) ? 15 : 25 });
  }
  if (wave >= 3) {
    for (const plantId of DRAFT_POOL.plants_t2) {
      pool.push({ type: 'plant', id: plantId, weight: state.deck.includes(plantId) ? 10 : 18 });
    }
  }
  if (wave >= 6) {
    for (const plantId of DRAFT_POOL.plants_t3) {
      pool.push({ type: 'plant', id: plantId, weight: state.deck.includes(plantId) ? 5 : 10 });
    }
  }

  // ── 強化牌 ──
  for (const mut of DRAFT_POOL.mutations) {
    // 已有的強化不重複給
    const alreadyHas = state.globalBuffs[mut.stat] >= mut.value && mut.value > 0;
    if (!alreadyHas) {
      pool.push({ type: 'mutation', id: mut.id, weight: 20 });
    }
  }

  // ── 法術牌 ──
  for (const spellId of DRAFT_POOL.spell_cards) {
    if (!state.unlockedSpells.includes(spellId)) {
      const spellDef = SPELLS[spellId];
      if (wave >= spellDef.unlockWave) {
        pool.push({ type: 'spell', id: spellId, weight: 12 });
      }
    }
  }

  // 從池中抽 3 張不重複
  const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
  const picked = [];
  const used = new Set();

  for (let i = 0; i < 3 && picked.length < pool.length; i++) {
    let r = Math.random() * totalWeight;
    for (const item of pool) {
      if (used.has(item.type + item.id)) continue;
      r -= item.weight;
      if (r <= 0) {
        used.add(item.type + item.id);
        picked.push(item);
        break;
      }
    }
  }

  // 如果沒抽滿 3 張，補上
  while (picked.length < 3 && picked.length < pool.length) {
    const remaining = pool.filter(p => !used.has(p.type + p.id));
    if (remaining.length === 0) break;
    const pick = randomPick(remaining);
    used.add(pick.type + pick.id);
    picked.push(pick);
  }

  return picked.map(p => {
    if (p.type === 'plant') {
      const def = PLANTS[p.id];
      const owned = state.deck.includes(p.id);
      return {
        type: 'plant',
        id: p.id,
        name: def.name,
        emoji: def.emoji,
        desc: owned ? '進化催化：場上此植物 XP +40' : `加入牌組`,
        cost: def.cost,
        owned,
      };
    }
    if (p.type === 'mutation') {
      const mut = DRAFT_POOL.mutations.find(m => m.id === p.id);
      return { type: 'mutation', id: mut.id, name: mut.name, emoji: mut.emoji, desc: mut.desc, stat: mut.stat, value: mut.value };
    }
    if (p.type === 'spell') {
      const spell = SPELLS[p.id];
      return { type: 'spell', id: p.id, name: spell.name, emoji: spell.emoji, desc: spell.desc, cooldown: spell.cooldown };
    }
  }).filter(Boolean);
}

// 應用選中的牌
export function applyDraftCard(state, card) {
  if (card.type === 'plant') {
    if (card.owned) {
      // 進化催化：給場上所有此類植物 +40 XP
      for (const [key, plant] of state.plants) {
        if (plant.type === card.id) {
          plant.xp = (plant.xp || 0) + 40;
        }
      }
    } else {
      // 加入牌組
      state.deck.push(card.id);
      state.cooldowns[card.id] = 0;
    }
  }
  if (card.type === 'mutation') {
    // 疊加全局 buff
    state.globalBuffs[card.stat] = (state.globalBuffs[card.stat] || 0) + card.value;
  }
  if (card.type === 'spell') {
    if (!state.unlockedSpells.includes(card.id)) {
      state.unlockedSpells.push(card.id);
      state.spellCooldowns[card.id] = 0;
    }
  }
}
