import { rows } from '../config.js';

export function createGameState(levelKey, level) {
  return {
    levelKey,
    sun: level.sunStart,
    kills: 0,
    wave: 1,
    selectedPlant: 'peashooter',
    shovelMode: false,
    shovelUses: 0,
    plants: new Map(),
    zombies: [],
    peas: [],
    suns: [],
    booms: [],
    lawnmowers: Array.from({ length: rows }, (_, row) => ({ row, x: -0.25, active: false, used: false })),
    spawnTimer: 0,
    sunTimer: 0,
    gameOver: false,
    nextZombieId: 1,
    nextSunId: 1,
    cooldowns: {},
    modifier: 'normal',
    modifierTimer: 0,
    modifierWave: 0,
    // Combo / streak system
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    // Achievement tracking (per-run)
    unlockedAchievements: new Set(),
    wonNormal: false,
    wonHard: false,
    wonSurvival: false,
  };
}

export function initCooldowns(state, plantKeys) {
  state.cooldowns = Object.fromEntries(plantKeys.map(k => [k, 0]));
  return state;
}
