import { createApp, type App } from './app';

declare global {
  interface Window {
    /** Debug handle for playtesting: state and events from the console. */
    spaceBridge?: App;
  }
}

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #game canvas');

window.spaceBridge = createApp({ canvas });
