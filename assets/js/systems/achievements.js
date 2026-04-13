/**
 * systems/achievements.js — Achievement tracking & persistence
 *
 * Checks achievement conditions each frame, shows toast on unlock,
 * persists unlocked set to localStorage.
 */

import { ACHIEVEMENTS } from '../config.js';
import { sfx } from '../audio.js';

const STORAGE_KEY = 'pvz-lite-achievements';

/** Load previously unlocked achievement IDs from localStorage */
export function loadAchievements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save unlocked achievement IDs to localStorage */
function saveAchievements(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch { /* no-op */ }
}

/** Persist best records (kills, wave, maxCombo) per level */
const RECORDS_KEY = 'pvz-lite-records';

export function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRecord(levelKey, kills, wave, maxCombo) {
  try {
    const records = loadRecords();
    const key = levelKey;
    if (!records[key] || kills > (records[key].kills || 0)) {
      records[key] = { kills, wave, maxCombo };
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    }
  } catch { /* no-op */ }
}

/**
 * Check all achievements against current state.
 * Returns newly unlocked achievement IDs.
 */
export function checkAchievements(state) {
  const newUnlocks = [];
  const previouslyUnlocked = loadAchievements();

  for (const ach of ACHIEVEMENTS) {
    if (previouslyUnlocked.includes(ach.id)) continue;
    if (state.unlockedAchievements.has(ach.id)) continue;
    if (ach.check(state)) {
      state.unlockedAchievements.add(ach.id);
      newUnlocks.push(ach);
      previouslyUnlocked.push(ach.id);
    }
  }

  if (newUnlocks.length > 0) {
    saveAchievements(previouslyUnlocked);
  }

  return newUnlocks;
}

/** Show achievement toast */
export function showAchievementToast(achievement) {
  sfx('achievement');
  let container = document.getElementById('achievementContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'achievementContainer';
    container.className = 'achievement-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `<span class="ach-icon">🏆</span> <strong>${achievement.name}</strong><br><span class="ach-desc">${achievement.desc}</span>`;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Remove after 4s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
