import { startGame } from './app';
import { createBrowserPlatform } from './platform';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Missing game canvas');
const app = startGame(createBrowserPlatform(canvas));
if (import.meta.env.DEV) {
  (globalThis as any).__CANDY_FUSION__ = app;
}
if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
