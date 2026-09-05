/**
 * main —— 入口：开始屏 → 组装对局。
 */

import './ui/styles.css';
import { startGame } from './app/game';
import type { GameHandle } from './app/game';
import { StartScreen } from './ui/panels';
import type { StartOptions } from './ui/panels';

const container = document.getElementById('app') as HTMLDivElement;
let handle: GameHandle | null = null;

function launch(opts: StartOptions): void {
  handle?.dispose();
  handle = startGame(container, opts);
}

new StartScreen(container, launch);
