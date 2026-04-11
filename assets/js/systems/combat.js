// ═══════════════════════════════════════════════
// Combat System — 含進化加成與混亂效果
// ═══════════════════════════════════════════════
import { rows, cols, ZOMBIES } from '../config.js';
import { getEvolutionBonus } from './evolution.js';
import { isChaosActive } from './chaos.js';

export function triggerBomb(state, plant, sfx) {
  sfx('boom');
  const evo = getEvolutionBonus(plant.type, plant.level || 1);
  const baseRadius = 1.35;
  const radius = evo.bonusRadius ? baseRadius * 1.5 : baseRadius;
  const baseDmg = 230 + (evo.bonusDmg || 0);
  state.booms.push({ row: plant.row, col: plant.col, life: 0.22 });
  state.zombies.forEach(z => {
    if (Math.abs(z.row - plant.row) <= (evo.hitAllRows ? rows : 1) && Math.abs(z.x - plant.col) <= radius) {
      z.hp -= baseDmg;
    }
  });
}

export function updatePlantsCombat(state, dt, sfx, addSun, removePlant) {
  const attackSpeedBuff = 1 + (state.globalBuffs.attackSpeed || 0);
  const fertileBuff = isChaosActive(state, 'fertile') ? 1.4 : 1;
  const critChance = state.globalBuffs.critChance || 0;

  for (const p of [...state.plants.values()]) {
    // 自癒 buff
    if (state.globalBuffs.regen > 0) {
      p.hp = Math.min(p.maxHp, p.hp + state.globalBuffs.regen * dt);
    }
    // 進化自癒
    const evo = getEvolutionBonus(p.type, p.level || 1);
    if (evo.regen) {
      p.hp = Math.min(p.maxHp, p.hp + evo.regen * dt);
    }
    // 荊棘反傷
    if (evo.reflectDmg && p.thornReflectTimer === undefined) {
      p.thornReflectTimer = 0;
    }

    // 向日葵
    if (p.type === 'sunflower') {
      p.sunTimer += dt;
      const sunInterval = 6.2 / (attackSpeedBuff * fertileBuff);
      if (p.sunTimer >= sunInterval) {
        p.sunTimer = 0;
        const sunValue = Math.round((25 + (evo.bonusSun || 0)) * (1 + (state.globalBuffs.sunIncome || 0)));
        addSun(state, p.col * 95 + 18, p.row * 100 + 10, sunValue, 0.45);
        // 太陽王 AOE 陽光
        if (evo.aoeSun) {
          addSun(state, p.col * 95 + 40, p.row * 100 + 30, Math.round(sunValue * 0.5), 0.5);
        }
      }
    }

    // 豌豆射手 / 雙發 / 冰豆 / 賭徒 / 火焰
    const shooters = ['peashooter', 'repeater', 'icepea', 'gambler', 'firepea'];
    if (shooters.includes(p.type)) {
      const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1);
      p.attackTimer += dt;
      let rate = p.type === 'repeater' ? 0.9 : p.type === 'gambler' ? 1.35 : p.type === 'firepea' ? 1.0 : 1.1;
      rate /= (attackSpeedBuff * fertileBuff);
      if (has && p.attackTimer >= rate) {
        p.attackTimer = 0;
        const baseDmg = 20 + (evo.bonusDmg || 0);
        const extraShot = evo.extraShot ? 1 : 0;

        if (p.type === 'gambler') {
          const roll = Math.random();
          const critDmg = evo.guaranteedCrit ? (evo.critDmg || 80) : 55;
          const weakDmg = 6;
          const normalDmg = 24 + Math.floor(Math.random() * 14) + (evo.bonusDmg || 0);
          const damage = roll > (evo.betterCrit ? 0.75 : 0.9) ? critDmg : roll < 0.2 ? weakDmg : normalDmg;
          state.peas.push({ row: p.row, x: p.col + 0.72, damage, speed: 4.8, ice: false, gambler: true, crit: roll > 0.9, weak: roll < 0.2 });
        } else {
          const shots = (p.type === 'repeater' ? 2 : 1) + extraShot;
          for (let i = 0; i < shots; i++) {
            const isIce = p.type === 'icepea';
            const isFire = p.type === 'firepea' || evo.firePeas;
            const dmg = isIce ? 18 + (evo.bonusDmg || 0) : baseDmg;
            state.peas.push({
              row: p.row, x: p.col + 0.72 - i * 0.12,
              damage: dmg, speed: 4.8,
              ice: isIce, fire: isFire, prism: false,
              splash: isFire ? (evo.splashRadius || 1) : 0,
              burn: evo.burn || false,
            });
          }
        }
        sfx(p.type === 'icepea' ? 'ice' : p.type === 'firepea' ? 'boom' : 'pea');
      }
    }

    // 櫻桃炸彈
    if (p.type === 'bomb') {
      p.explodeTimer -= dt;
      if (p.explodeTimer <= 0) {
        triggerBomb(state, p, sfx);
        removePlant(p.row, p.col);
      }
    }

    // 稜鏡花
    if (p.type === 'prism') {
      let targetRows = [p.row, Math.max(0, p.row - 1), Math.min(rows - 1, p.row + 1)];
      if (evo.hitAllRows) targetRows = [0, 1, 2, 3, 4];
      else if (evo.bonusRows) {
        for (let i = 1; i <= evo.bonusRows; i++) {
          targetRows.push(Math.max(0, p.row - i));
          targetRows.push(Math.min(rows - 1, p.row + i));
        }
        targetRows = [...new Set(targetRows)];
      }
      const hasTarget = state.zombies.some(z => targetRows.includes(z.row) && z.x >= p.col - 0.1);
      p.attackTimer += dt;
      const rate = 1.25 / (attackSpeedBuff * fertileBuff);
      if (hasTarget && p.attackTimer >= rate) {
        p.attackTimer = 0;
        targetRows.forEach((row, idx) => {
          state.peas.push({ row, x: p.col + 0.72, damage: 16 + (evo.bonusDmg || 0), speed: 4.6, ice: false, prism: true });
        });
        sfx('pea');
      }
    }

    // 暗影藤
    if (p.type === 'shadowvine') {
      p.attackTimer += dt;
      const rate = 1.5 / (attackSpeedBuff * fertileBuff);
      if (p.attackTimer >= rate) {
        p.attackTimer = 0;
        const stealRate = evo.stealRate || 0.15;
        const targets = state.zombies.filter(z => {
          if (z.row === p.row && z.x >= p.col - 0.1) return true;
          if (evo.aoeSteal && Math.abs(z.row - p.row) <= 1 && z.x >= p.col - 0.1) return true;
          return false;
        });
        for (const z of targets) {
          const stolen = Math.round(z.maxHp * stealRate * 0.1);
          z.hp -= stolen;
          p.hp = Math.min(p.maxHp, p.hp + Math.round(stolen * 0.5));
        }
      }
    }

    // 預言菇
    if (p.type === 'oracle') {
      p.attackTimer += dt;
      const rate = 2.5 / (attackSpeedBuff * fertileBuff);
      if (p.attackTimer >= rate) {
        p.attackTimer = 0;
        const freezeDur = evo.freezeDuration || 2;
        const targets = state.zombies.filter(z => z.row === p.row && z.x >= p.col - 0.1);
        for (const z of targets) {
          z.slowTimer = Math.max(z.slowTimer || 0, freezeDur);
          z.frozen = true;
          z.frozenTimer = Math.max(z.frozenTimer || 0, freezeDur);
        }
        if (targets.length > 0) sfx('ice');
      }
    }

    // 荊棘牆 — 反傷
    if (p.type === 'thornwall') {
      p.thornReflectTimer = (p.thornReflectTimer || 0) + dt;
      const reflectDmg = (evo.bonusReflect || 3);
      // 持續對咬它的殭屍造成反傷
      const col = Math.floor(p.col);
      const biting = state.zombies.filter(z => z.row === p.row && Math.abs(z.x - (p.col + 0.5)) < 0.95);
      if (biting.length > 0 && p.thornReflectTimer >= 0.7) {
        p.thornReflectTimer = 0;
        for (const z of biting) {
          z.hp -= reflectDmg;
        }
      }
      // Lv3: 發射荊棘彈
      if (evo.thornShot) {
        const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1);
        p.attackTimer += dt;
        if (has && p.attackTimer >= 2.0) {
          p.attackTimer = 0;
          state.peas.push({ row: p.row, x: p.col + 0.72, damage: 12, speed: 4.0, ice: false, prism: false });
          sfx('pea');
        }
      }
    }
  }
}

export function updatePeasCombat(state, dt, sfx) {
  state.peas.forEach(p => p.x += p.speed * dt);
  state.peas = state.peas.filter(p => p.x < cols + 0.4);

  for (const pea of state.peas) {
    const hit = state.zombies.find(z => z.row === pea.row && Math.abs(z.x - pea.x) < 0.28);
    if (hit) {
      // 暴擊
      let finalDmg = pea.damage;
      if (state.globalBuffs.critChance > 0 && Math.random() < state.globalBuffs.critChance) {
        finalDmg *= 2;
      }

      if (hit.shield) {
        hit.shield = false;
        hit.hp -= Math.max(6, finalDmg * 0.35);
      } else {
        hit.hp -= finalDmg;
      }

      // 冰緩效果
      if (pea.ice) {
        const evo = getEvolutionBonus('icepea', 3); // 用基礎冰緩
        const slowDur = 2.8;
        hit.slowTimer = Math.max(hit.slowTimer || 0, slowDur);
        // 凍結機率 (Lv3)
        if (pea.ice && Math.random() < 0.15) {
          hit.frozen = true;
          hit.frozenTimer = 1.5;
        }
      }

      // 火焰濺射
      if (pea.fire && pea.splash > 0) {
        const nearby = state.zombies.filter(z => z !== hit && Math.abs(z.row - hit.row) <= 1 && Math.abs(z.x - hit.x) <= pea.splash);
        for (const z of nearby) {
          z.hp -= Math.round(finalDmg * 0.4);
          if (pea.burn) z.burning = true, z.burnTimer = 3;
        }
      }

      pea.x = 999;
      sfx('hit');
    }
  }
  state.peas = state.peas.filter(p => p.x < cols + 1);
}

export function updateZombieCombat(state, dt, sfx, cellKey) {
  for (const z of state.zombies) {
    // 報紙殭屍暴怒
    if (z.kind === 'paper' && !z.angry && z.hp < z.maxHp * 0.45) z.angry = true, z.speed *= 1.9;

    // 燃燒效果
    if (z.burning) {
      z.burnTimer -= dt;
      z.hp -= 8 * dt;
      if (z.burnTimer <= 0) z.burning = false;
    }

    // 緩速計時
    if (z.slowTimer > 0) z.slowTimer -= dt;

    // 速度計算
    const bloodBoost = state.modifier === 'bloodmoon' ? 1.18 : 1;
    const frozenMult = z.frozen ? 0.05 : z.slowTimer > 0 ? 0.5 : 1;
    const warpMult = z.warpSlow ? 0.5 : 1;
    const evo = getEvolutionBonus('icepea', 3); // slow boost from ice pea evo
    const slowBoost = z.slowTimer > 0 ? 1 : 0;
    const eff = z.speed * bloodBoost * frozenMult * warpMult;

    const col = Math.floor(z.x);
    const key = cellKey(z.row, Math.max(0, col));
    const plant = state.plants.get(key);
    const mower = state.lawnmowers[z.row];

    // 割草機觸發
    if (!mower.used && !mower.active && z.x <= 0.35) {
      mower.active = true;
      sfx('mower');
    }
    if (mower.active) continue;

    // 咬植物
    if (plant && z.x < plant.col + 0.95) {
      z.biteTimer += dt;
      if (z.biteTimer >= 0.7) {
        z.biteTimer = 0;
        const biteDmg = ZOMBIES[z.kind]?.bite || 18;
        plant.hp -= biteDmg;
        if (plant.hp <= 0) state.plants.delete(key);
      }
    } else if (!z.frozen) {
      z.x -= eff * dt;
    }

    // 殭屍到達左邊 → 死亡
    if (z.x <= -0.2 && mower.used) return false;
  }

  // 治療殭屍 (healer) — 治療附近殭屍
  for (const z of state.zombies) {
    if (z.kind === 'healer') {
      z.healTimer = (z.healTimer || 0) + dt;
      if (z.healTimer >= 2.0) {
        z.healTimer = 0;
        const nearby = state.zombies.filter(other => other !== z && Math.abs(other.x - z.x) < 2 && Math.abs(other.row - z.row) <= 1);
        for (const other of nearby) {
          other.hp = Math.min(other.maxHp, other.hp + 15);
        }
      }
    }
    // 死靈法師殭屍 — 定期召喚小殭屍
    if (z.kind === 'necro') {
      z.necroTimer = (z.necroTimer || 0) + dt;
      if (z.necroTimer >= 5.0) {
        z.necroTimer = 0;
        state.zombies.push({
          id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.min(cols - 0.1, z.x + 0.5),
          hp: 45, maxHp: 45, speed: 0.30, biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true,
        });
      }
    }
  }

  return true;
}
