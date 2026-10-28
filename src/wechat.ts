import { startGame } from './app';
import { createWechatAudio } from './audio';
import { normalizeBest, type Platform, type PointerHandler, type PointerType } from './platform';

// Only this entry point accesses WeChat APIs; the simulation and renderer are shared.
const runtime = wx as any;
const STORAGE_KEY = 'candy-fusion.best.v1';
function createWechatPlatform(): Platform {
  const canvas = runtime.createCanvas();
  const audio = createWechatAudio(runtime);
  const now = () => Date.now();
  const pressedKeys = new Set<string>();
  const bindPointer = (handler: PointerHandler) => {
    const mouseId = -1;
    let lastTouch = -Infinity, lastMouseDown = -Infinity;
    let mouseActive = false, mouseX = 0, mouseY = 0;
    const ignoredTouches = new Set<number>();
    const make = (type: PointerType) => (event: any) => {
      for (const touch of event.changedTouches ?? event.touches ?? []) {
        const id = touch.identifier, x = touch.clientX ?? touch.x, y = touch.clientY ?? touch.y;
        // Some simulators synthesize both streams for one physical click. Keep
        // whichever down event arrived first, without suppressing real multitouch.
        if (type === 'down' && now() - lastMouseDown < 100 && Math.hypot(x - mouseX, y - mouseY) < 8) ignoredTouches.add(id);
        if (ignoredTouches.has(id)) {
          if (type === 'up' || type === 'cancel') ignoredTouches.delete(id);
          continue;
        }
        lastTouch = now();
        if (mouseActive) { handler('cancel', mouseId, mouseX, mouseY); mouseActive = false; }
        handler(type, id, x, y);
      }
    };
    const down = make('down'), move = make('move'), up = make('up'), cancel = make('cancel');
    const mouseDown = (event: any) => {
      if ((event.button !== undefined && event.button !== 0) || now() - lastTouch < 700) return;
      mouseActive = true; lastMouseDown = now(); mouseX = event.x; mouseY = event.y;
      handler('down', mouseId, mouseX, mouseY);
    };
    const mouseMove = (event: any) => {
      if (!mouseActive) return;
      mouseX = event.x; mouseY = event.y; handler('move', mouseId, mouseX, mouseY);
    };
    const mouseUp = (event: any) => {
      if (!mouseActive || (event.button !== undefined && event.button !== 0)) return;
      mouseActive = false; mouseX = event.x; mouseY = event.y;
      handler('up', mouseId, mouseX, mouseY);
    };
    runtime.onTouchStart(down); runtime.onTouchMove(move); runtime.onTouchEnd(up); runtime.onTouchCancel(cancel);
    // PC mouse events are optional on mobile/older base libraries.
    runtime.onMouseDown?.(mouseDown); runtime.onMouseMove?.(mouseMove); runtime.onMouseUp?.(mouseUp);
    return () => {
      runtime.offTouchStart(down); runtime.offTouchMove(move); runtime.offTouchEnd(up); runtime.offTouchCancel(cancel);
      runtime.offMouseDown?.(mouseDown); runtime.offMouseMove?.(mouseMove); runtime.offMouseUp?.(mouseUp);
      if (mouseActive) handler('cancel', mouseId, mouseX, mouseY);
      ignoredTouches.clear(); mouseActive = false;
    };
  };
  return {
    name: 'wechat', canvas,
    getViewport() {
      const info = runtime.getWindowInfo ? runtime.getWindowInfo() : runtime.getSystemInfoSync();
      return { width: info.windowWidth, height: info.windowHeight, dpr: Math.min(info.pixelRatio || 1, 2), safeArea: info.safeArea };
    },
    createImage: () => runtime.createImage(),
    onPointer: bindPointer,
    onKey(handler) {
      const keyFrom = (event: any): string => {
        const key = event.key || event.code || '';
        if (key === 'Space' || key === 'Spacebar') return ' ';
        return /^Key[A-Z]$/.test(key) ? key.slice(3).toLowerCase() : key;
      };
      const down = (event: any) => {
        const key = keyFrom(event);
        if (!key || pressedKeys.has(key)) return;
        pressedKeys.add(key); handler(key, true);
      };
      const up = (event: any) => {
        const key = keyFrom(event);
        if (!key) return;
        pressedKeys.delete(key); handler(key, false);
      };
      runtime.onKeyDown?.(down); runtime.onKeyUp?.(up);
      return () => {
        runtime.offKeyDown?.(down); runtime.offKeyUp?.(up); pressedKeys.clear();
      };
    },
    onVisibility(handler) {
      const hide = () => { pressedKeys.clear(); audio.setVisible(false); handler(false); };
      const show = () => { audio.setVisible(true); handler(true); };
      runtime.onHide(hide); runtime.onShow(show);
      return () => {
        runtime.offHide(hide); runtime.offShow(show);
        audio.dispose();
      };
    },
    loadBest() { try { return normalizeBest(runtime.getStorageSync(STORAGE_KEY)); } catch { return 0; } },
    saveBest(value) { try { runtime.setStorageSync(STORAGE_KEY, normalizeBest(value)); } catch { /* Storage quota must not interrupt gameplay. */ } },
    now,
    requestFrame: callback => requestAnimationFrame(() => callback(now())),
    cancelFrame: id => cancelAnimationFrame(id),
    playSound: kind => audio.playSound(kind),
    unlockAudio: () => audio.unlock(),
    setAudioEnabled: enabled => audio.setAudioEnabled(enabled),
    setMusicEnabled: enabled => audio.setMusicEnabled(enabled),
    setMusicPlaying: playing => audio.setMusicPlaying(playing),
    vibrate() { runtime.vibrateShort?.({ type: 'light', fail: () => {} }); },
  };
}

startGame(createWechatPlatform());
