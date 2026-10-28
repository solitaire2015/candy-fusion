import { createBrowserAudio } from './audio';
export type PointerType = 'down' | 'move' | 'up' | 'cancel';
export type SoundKind = 'drop' | 'merge' | 'over';
export type PointerHandler = (type: PointerType, id: number, x: number, y: number) => void;
export interface Viewport {
  width: number;
  height: number;
  dpr: number;
  safeArea?: { left: number; top: number; right: number; bottom: number };
}
export interface Platform {
  name: 'web' | 'wechat';
  // Canvas/Image interfaces differ across browser and WeChat runtimes.
  canvas: any;
  getViewport(): Viewport;
  createImage(): any;
  onPointer(handler: PointerHandler): () => void;
  onKey(handler: (key: string, down: boolean) => void): () => void;
  onVisibility(handler: (visible: boolean) => void): () => void;
  loadBest(): number;
  saveBest(value: number): void;
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
  playSound(kind: SoundKind): void;
  unlockAudio(): void;
  setAudioEnabled(enabled: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setMusicPlaying(playing: boolean): void;
  vibrate(): void;
}

const STORAGE_KEY = 'candy-fusion.best.v1';
export function normalizeBest(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export function createBrowserPlatform(canvas: HTMLCanvasElement): Platform {
  const audio = createBrowserAudio();
  return {
    name: 'web', canvas,
    getViewport: () => ({ width: window.innerWidth, height: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) }),
    createImage: () => new Image(),
    onPointer(handler) {
      const invoke = (type: PointerType) => (event: PointerEvent) => {
        if (type === 'down') {
          canvas.focus({ preventScroll: true });
          canvas.setPointerCapture(event.pointerId);
        }
        const rect = canvas.getBoundingClientRect();
        handler(type, event.pointerId, event.clientX - rect.left, event.clientY - rect.top);
        if (event.cancelable) event.preventDefault();
      };
      const down = invoke('down'), move = invoke('move'), up = invoke('up'), cancel = invoke('cancel');
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', cancel);
      canvas.addEventListener('lostpointercapture', cancel);
      return () => {
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', cancel);
        canvas.removeEventListener('lostpointercapture', cancel);
      };
    },
    onKey(handler) {
      const invoke = (down: boolean) => (event: KeyboardEvent) => {
        if (event.key.startsWith('Arrow') || event.key === ' ') event.preventDefault();
        // Repeated movement is driven by the game clock; a held drop key must not spam.
        if (down && event.repeat) return;
        handler(event.key, down);
      };
      const down = invoke(true), up = invoke(false);
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    },
    onVisibility(handler) {
      const notify = (visible: boolean) => { audio.setVisible(visible); handler(visible); };
      const visibility = () => notify(document.visibilityState === 'visible' && document.hasFocus());
      const blur = () => notify(false);
      const focus = () => notify(document.visibilityState === 'visible');
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('blur', blur);
      window.addEventListener('focus', focus);
      return () => {
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('blur', blur);
        window.removeEventListener('focus', focus);
        audio.dispose();
      };
    },
    loadBest() {
      try { return normalizeBest(localStorage.getItem(STORAGE_KEY)); } catch { return 0; }
    },
    saveBest(value) {
      try { localStorage.setItem(STORAGE_KEY, String(normalizeBest(value))); } catch { /* Storage may be disabled. */ }
    },
    now: () => performance.now(),
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: id => cancelAnimationFrame(id),
    playSound: kind => audio.playSound(kind),
    unlockAudio: () => audio.unlock(),
    setAudioEnabled: enabled => audio.setAudioEnabled(enabled),
    setMusicEnabled: enabled => audio.setMusicEnabled(enabled),
    setMusicPlaying: playing => audio.setMusicPlaying(playing),
    vibrate() { /* Keep browser feedback quiet; WeChat uses its native API. */ },
  };
}
