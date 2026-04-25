// ═══════════════════════════════════════════════
// Combat System — 含進化加成與混亂效果
// ═══════════════════════════════════════════════
import { rows, cols, ZOMBIES, BOSS_WAVES, DIFFICULTY } from '../config.js';
import { getEvolutionBonus } from './evolution.js';
import { isChaosActive } from './chaos.js';
import { TERRAIN_TYPES, ZOMBIE_UNCONQUERED_BUFFS, isConqueredCell } from './territory.js';

// ── Combo helper — called when a pea hits ──
function registerComboHit(state) {
  state.comboCount = (state.comboCount || 0) + 1;
  state.comboTimer = 2.0;
  if (state.comboCount > (state.maxCombo || 0)) state.maxCombo = state.comboCount;
}

function getComboMultiplier(state) {
  const combo = state.comboCount || 0;
  // Every 5 hits = +10% bonus, capped at +100%
  return 1 + Math.min(combo / 5 * 0.1, 1.0);
}

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
  const attackSpeedBuff = 1 + (state.globalBuffs.attackSpeed || 0) + (state.relicBuffs?.attackSpeed || 0);
  const fertileBuff = isChaosActive(state, 'fertile') ? 1.4 : 1;
  const critChance = state.globalBuffs.critChance || 0;
  const shielded = state.shieldTimer > 0;

  for (const p of [...state.plants.values()]) {
    // 地形攻速加成（Speed Lane / Watchtower 等）
    const terrSpeedMult = 1 + (p.terrAtkBonus || 0);
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
      const sunInterval = 6.2 / (attackSpeedBuff * fertileBuff * terrSpeedMult);
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
      rate /= (attackSpeedBuff * fertileBuff * terrSpeedMult);
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
      const rate = 1.25 / (attackSpeedBuff * fertileBuff * terrSpeedMult);
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

    // 磁力菇 — 吸走殭屍防具
    if (p.type === 'magnet') {
      p.magnetTimer = (p.magnetTimer || 0) + dt;
      if (p.magnetTimer >= 1.5) {
        p.magnetTimer = 0;
        const magnetRange = evo.magnetRange || 1.5;
        // Find closest zombie within range
        let closest = null;
        let closestDist = Infinity;
        for (const z of state.zombies) {
          const dist = Math.abs(z.row - p.row) + Math.abs(z.x - p.col);
          if (dist <= magnetRange && dist < closestDist) {
            closest = z;
            closestDist = dist;
          }
        }
        if (closest) {
          // Strip shield
          if (closest.shield) {
            closest.shield = false;
          }
          // Armor removal for cone/bucket/armored
          if (closest.kind === 'cone' && !closest.armorStripped) {
            closest.hp = Math.round(closest.hp * 0.7);
            closest.armorStripped = true;
          } else if (closest.kind === 'bucket' && !closest.armorStripped) {
            closest.hp = Math.round(closest.hp * 0.6);
            closest.armorStripped = true;
          } else if (closest.kind === 'armored' && !closest.armorStripped) {
            closest.hp = Math.round(closest.hp * 0.6);
            closest.armorStripped = true;
          }
 // Lv3: also deal damage to stripped zombies
 if (evo.magnetDamage) {
 closest.hp -= 25;
 }
 }
 }
 }

 // ── 西瓜投手 — 拋物線濺射 3×3 ──
 if (p.type === 'melon') {
 const targets = state.zombies.filter(z => z.row === p.row && z.x >= p.col - 0.1);
 p.attackTimer += dt;
 const rate = 2.2 / (attackSpeedBuff * fertileBuff * terrSpeedMult);
 if (targets.length > 0 && p.attackTimer >= rate) {
 p.attackTimer = 0;
 const target = targets.reduce((a, b) => a.x > b.x ? a : b);
 const baseDmg = 30 + (evo.bonusDmg || 0);
 const directDmg = evo.freezeSplash ? baseDmg + 15 : baseDmg;
 // Direct hit
 target.hp -= directDmg;
 // Splash
 const splashRowRange = evo.splashRows || 1;
 const splashMult = evo.splashRows >= 3 ? 0.6 : evo.splashRows >= 2 ? 0.5 : 0.4;
 state.zombies.forEach(z => {
 if (z !== target && Math.abs(z.row - target.row) <= splashRowRange && Math.abs(z.x - target.x) <= 0.9) {
 z.hp -= Math.floor(baseDmg * splashMult);
 // Lv3 冰西瓜濺射附帶緩速
 if (evo.freezeSplash) z.slowTimer = Math.max(z.slowTimer || 0, 1.5);
 }
 });
 state.booms.push({ row: target.row, col: Math.round(target.x), life: 0.35, melon: true });
 sfx('boom');
 }
 }

 // ── 地刺 — 地面持續傷害 ──
 if (p.type === 'spikeweed') {
 const baseDmg = 13 + (evo.bonusDmg || 0);
 p.attackTimer += dt;
 if (p.attackTimer >= 0.8) {
 p.attackTimer = 0;
 state.zombies.forEach(z => {
 if (z.row === p.row && Math.abs(z.x - p.col) < 0.55) {
 z.hp -= baseDmg;
 // Lv2+ 附帶減速
 if (evo.slowOnHit) z.slowTimer = Math.max(z.slowTimer || 0, 1.2);
 // Lv3 破甲
 if (evo.armorBreak && z.shield) { z.shield = false; }
 if (evo.armorBreak && z.kind === 'armored' && z.armorHp > 0) { z.armorHp = 0; }
 }
 });
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
      // Combo system: register hit
      registerComboHit(state);
      const comboMult = getComboMultiplier(state);

      // 暴擊
      let finalDmg = pea.damage * comboMult;
      if (state.globalBuffs.critChance > 0 && Math.random() < state.globalBuffs.critChance) {
        finalDmg *= 2;
      }

 if (hit.shield) {
 if (hit.shieldHp && hit.shieldHp > 0) {
 // Boss 護盾：吸收傷害
 hit.shieldHp -= finalDmg;
 if (hit.shieldHp <= 0) {
 hit.shield = false;
 hit.hp += hit.shieldHp; // overflow damage
 hit.shieldHp = 0;
 }
 } else {
 // 普通護盾：一次消耗
 hit.shield = false;
 hit.hp -= Math.max(6, finalDmg * 0.35);
 }
 } else if (hit.kind === 'armored' && hit.armorHp > 0) {
        // Armored zombie shield absorbs damage first
        hit.armorHp -= finalDmg;
        if (hit.armorHp < 0) {
          // Overflow damage goes to HP
          hit.hp += hit.armorHp; // armorHp is negative, so this subtracts
          hit.armorHp = 0;
        }
      } else {
        hit.hp -= finalDmg;
      }

      // 冰緩效果
      if (pea.ice) {
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
 // ── 追蹤殭屍壓力線（最深入的那隻殭屍所在列） ──
 let minZombieCol = 99;
 for (const z of state.zombies) {
 const col = Math.floor(z.x);
 if (col < minZombieCol) minZombieCol = col;
 }
 if (state.territory) {
 state.territory.zombiePressureCol = Math.min(minZombieCol + 1, 9);
 }

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
	const relicSpeedBoost = 1 + (state.relicBuffs?.zombieSpeedBoost || 0);
	// ── 殭屍在未佔領地的巨額強化 ──
	const zCol = Math.round(z.x);
	const unconquered = state.territory && zCol >= 3 && !isConqueredCell(state, z.row, zCol);
	const unconqueredSpeed = unconquered ? ZOMBIE_UNCONQUERED_BUFFS.speedMult : 1;
	const eff = z.speed * bloodBoost * frozenMult * warpMult * relicSpeedBoost * unconqueredSpeed;

    // 找殭屍前方最近的植物（掃描同行所有植物）
    let plant = null;
    let plantKey = null;
    for (const [k, p] of state.plants) {
      if (p.row !== z.row) continue;
      // 殭屍前端到達植物右緣 → 開始咬
      if (z.x <= p.col + 1) {
        if (!plant || p.col > plant.col) {
          plant = p;
          plantKey = k;
        }
      }
    }
    const mower = state.lawnmowers[z.row];

    // 割草機觸發
    if (!mower.used && !mower.active && z.x <= 0.35) {
      mower.active = true;
      sfx('mower');
    }
    if (mower.active) continue;

 const zDef = ZOMBIES[z.kind];
 const isHopper = zDef?.skipPlant;
 const isSieger = zDef?.ranged;

 // ── 跳跳殭屍：遇到植物跳過一格 ──
 if (isHopper && plant && (z.skipCooldown || 0) <= 0) {
 z.x -= 1.1; // 跳到植物後方
 z.skipCooldown = 2; // 2 秒冷卻
 plant = null; // 跳過後不再咬
 }

 // ── 攻城殭屍：遠程攻擊（3 格距離射擊） ──
 if (isSieger) {
 z.rangedTimer = (z.rangedTimer || 0) + dt;
 if (z.rangedTimer >= 2.0) {
 z.rangedTimer = 0;
 // 找同行 3 格內最近的植物遠程攻擊
 let rangedTarget = null;
 let rangedKey = null;
 for (const [key, p] of state.plants) {
 if (p.row === z.row && p.col < Math.floor(z.x) && p.col >= Math.floor(z.x) - 3) {
 if (!rangedTarget || p.col > rangedTarget.col) {
 rangedTarget = p;
 rangedKey = key;
 }
 }
 }
 if (rangedTarget) {
 const rDmg = Math.round((z.biteDmg || 18) * 0.7);
 rangedTarget.hp -= rDmg;
 if (rangedTarget.hp <= 0) state.plants.delete(rangedKey);
 }
 }
 // 攻城殭屍不咬植物，持續移動
 if (!z.frozen) z.x -= eff * dt * 0.7;
 }
 // 咬植物（非跳跳、非攻城才停下咬）
 else if (plant) {
 z.biteTimer += dt;
 if (z.biteTimer >= 0.7) {
 z.biteTimer = 0;
			const diff = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
				const biteScale = diff.biteScale || 1;
				const unconqueredBiteMult = unconquered ? ZOMBIE_UNCONQUERED_BUFFS.biteMult : 1;
				const biteDmg = Math.round((z.biteDmg || ZOMBIES[z.kind]?.bite || 18) * biteScale * unconqueredBiteMult);
 if (state.shieldTimer <= 0) {
 plant.hp -= biteDmg;
 if (plant.hp <= 0) state.plants.delete(plantKey);
 }
 // 堡壘反傷
 const reflect = plant.terrReflect || 0;
 if (reflect > 0) {
 z.hp -= Math.round(biteDmg * reflect);
 }
 }
 } else if (!z.frozen) {
 // 普通移動
 if (isHopper && (z.skipCooldown || 0) > 0) {
 z.skipCooldown -= dt;
 z.x -= eff * dt * 0.5; // 冷卻中減速
 } else {
 z.x -= eff * dt;
 }
 }

 // ── 地形效果（雙向：佔領 vs 未佔領） ──
 if (state.territory) {
 const col = Math.round(z.x);
 const key = `${z.row}-${col}`;
 const terrainId = state.territory.terrain?.[key];
 const terrain = TERRAIN_TYPES[terrainId];
 const conquered = state.territory.conquered.has(key);

 if (conquered) {
 // 植物佔領的地形 → 對殭屍有害
 if (terrain?.poisonSlow) {
 z.slowTimer = Math.max(z.slowTimer || 0, 1.0);
 z.hp -= (terrain.poisonDps || 0) * dt;
 }
 // 聖壇：佔領後殭屍在該格受到額外傷害
		if (terrain?.id === 'altar') {
			z.hp -= 3 * dt;
		}
	}
	if (!conquered && terrain) {
 // 未佔領的地形 → 殭屍受益（前期難度平衡：只在高波次生效）
 if (state.wave >= 4) {
 if (terrain.id === 'speed_lane') {
 // 加速帶：殭屍加速
 z.slowTimer = 0; // 清除緩速
 eff *= 1.12;
 }
 if (terrain.id === 'fortress') {
 // 堡壘：殭屍回血
 z.hp = Math.min(z.maxHp, z.hp + 2 * dt);
 }
 }
 }
	}

		// 殭屍到達左邊且除草機已用 → 標記死亡（由 checkGameEnd 處理遊戲結束）
		if (z.x <= -0.2 && mower.used) { z.hp = 0; continue; }
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

	// ── Boss 技能系統 ──
	for (const z of state.zombies) {
 if (z.kind !== 'boss' || !z.bossSkills) continue;

 // 狂暴：HP 低於閾值時永久觸發
 for (const skill of z.bossSkills) {
 if (skill.type === 'rage' && !z.enraged) {
 const hpRatio = z.hp / z.maxHp;
 if (hpRatio <= (skill.threshold || 0.5)) {
 z.enraged = true;
 z.speed *= 1.3;
 z.biteDmg = Math.round(z.biteDmg * 1.5);
 state.bossRageTriggered = true;
 }
 }
 }

 // 計時型技能
 for (const skill of z.bossSkills) {
 if (skill.type === 'rage') continue; // 已處理
 const timerKey = `skill_${skill.type}`;
 z[timerKey] = (z[timerKey] || 0) + dt;
 if (z[timerKey] >= (skill.interval || 10)) {
 z[timerKey] = 0;

 switch (skill.type) {
 case 'summon': {
 // 召喚 2 隻小兵在 Boss 附近
 const addKinds = z.bossAddKinds || ['normal'];
 for (let i = 0; i < 2; i++) {
 const kind = addKinds[Math.floor(Math.random() * addKinds.length)];
 const base = ZOMBIES[kind];
 if (base) {
 const hpScale = 1 + (state.wave - 1) * 0.14;
 state.zombies.push({
 id: state.nextZombieId++, kind, row: z.row,
 x: Math.min(cols - 0.1, z.x + 0.3 + i * 0.5),
 hp: Math.round(base.hp * hpScale * 0.8),
 maxHp: Math.round(base.hp * hpScale * 0.8),
 speed: base.speed * 1.1, biteTimer: 0, slowTimer: 0,
 angry: false, shield: false, biteDmg: base.bite,
 });
 }
 }
 break;
 }
 case 'shield': {
 // 獲得護盾
 z.shield = true;
 z.shieldHp = 200;
 break;
 }
 case 'heal': {
 // 回復 HP
 const amount = (skill.amount || 0.1) * z.maxHp;
 z.hp = Math.min(z.maxHp, z.hp + amount);
 break;
 }
 case 'destroy': {
 // 摧毀隨機一株植物
 const plants = [...state.plants.entries()];
 if (plants.length > 0) {
 const [key, p] = plants[Math.floor(Math.random() * plants.length)];
 state.plants.delete(key);
 state.booms.push({ row: p.row, col: p.col, life: 0.3 });
 }
 break;
 }
 }
 }
 }
 }

 return true;
}
