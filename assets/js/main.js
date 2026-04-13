/**
 * main.js — Bootstrap entry
 *
 * Only responsibility: import modules, bind UI, start the game.
 * No business logic lives here.
 */

import { bindAudioControls, bindGameButtons, bindAudioUnlock } from './ui/bindings.js';
import { startGame, bindGameEvents } from './game.js';

bindAudioControls();
bindGameButtons();
bindAudioUnlock();
bindGameEvents();
startGame();
