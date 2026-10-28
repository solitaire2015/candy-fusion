import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import vm from 'node:vm';

test('WeChat bundle supports safe-area touch, desktop mouse/key and lifecycle without browser globals', async () => {
  const result = await build({
    entryPoints: ['src/wechat.ts'], bundle: true, write: false,
    platform: 'neutral', mainFields: ['module', 'main'], format: 'iife', target: 'es2017', minify: true,
  });
  const bundle = result.outputFiles[0].text;
  assert.doesNotMatch(bundle, /\?\.(?!\d)|\?\?/, 'preview packer requires optional/nullish syntax to be lowered');
  let clock = 1000, nextFrame = 0, imagesDrawn = 0, soundPlays = 0;
  const frames = new Map<number, (time: number) => void>();
  const handlers = new Map<string, (event?: any) => void>();
  const sources: string[] = [];
  const audioVoices: any[] = [];
  let audioOptions: any;
  let texts: string[] = [];
  const gradients = { addColorStop() {} };
  const context = new Proxy({
    createLinearGradient: () => gradients,
    createRadialGradient: () => gradients,
    measureText: (value: string) => ({ width: value.length * 10 }),
    drawImage() { imagesDrawn++; },
    fillText(value: string) { texts.push(value); },
  } as Record<string, any>, {
    get(target, key: string) { return key in target ? target[key] : () => {}; },
    set(target, key: string, value) { target[key] = value; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: (type: string) => { assert.equal(type, '2d'); return context; } };
  const wxRuntime: Record<string, any> = {
    createCanvas: () => canvas,
    getWindowInfo: () => ({ windowWidth: 1440, windowHeight: 800, pixelRatio: 2, safeArea: { left: 80, top: 80, right: 1360, bottom: 720 } }),
    createImage: () => ({
      width: 1440, height: 1080,
      set src(value: string) { sources.push(value); (this as any).onload?.(); },
    }),
    getStorageSync: () => 123,
    setStorageSync() {},
    setInnerAudioOption(options: any) { audioOptions = options; },
    createInnerAudioContext(options: any) {
      let ready: (() => void) | undefined;
      const voice = {
        options, path: '', volume: 0, loop: false, obeyMuteSwitch: true, pauses: 0, plays: 0, ended: undefined as (() => void) | undefined,
        set src(value: string) { this.path = value; ready?.(); },
        stop() {}, pause() { this.pauses++; },
        play() { this.plays++; if (!this.loop) soundPlays++; },
        onCanplay(callback: () => void) { ready = callback; },
        onEnded(callback: () => void) { this.ended = callback; }, onError() {}, destroy() {},
      };
      audioVoices.push(voice); return voice;
    },
    vibrateShort() {},
  };
  for (const kind of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'MouseDown', 'MouseMove', 'MouseUp', 'KeyDown', 'KeyUp', 'Hide', 'Show']) {
    wxRuntime[`on${kind}`] = (callback: (event?: any) => void) => handlers.set(kind, callback);
    wxRuntime[`off${kind}`] = () => handlers.delete(kind);
  }
  class FakeDate extends Date { static now() { return clock; } }
  const sandbox = vm.createContext({
    wx: wxRuntime,
    console,
    Date: FakeDate,
    requestAnimationFrame(callback: (time: number) => void) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    setTimeout, clearTimeout,
  });
  // Deliberately no document, window, navigator, HTMLCanvasElement, Image or AudioContext.
  vm.runInContext(bundle, sandbox, { timeout: 3000 });
  assert.equal(canvas.width, 2880);
  assert.equal(canvas.height, 1600);
  assert.deepEqual(sources.sort(), ['assets/candy-atlas-v3.png', 'assets/candy-world-v3.jpg']);
  assert.ok(imagesDrawn >= 14, 'scene draws the background, progression candies, preview and active candy');
  assert.equal(frames.size, 1);
  assert.equal(handlers.size, 11);
  assert.equal(audioOptions.obeyMuteSwitch, false, 'iOS silent switch does not suppress game audio');
  assert.equal(audioVoices.length, 7, 'preload pooled effects and one music voice');
  assert.ok(audioVoices.every(voice => !voice.options.useWebAudioImplement && !voice.obeyMuteSwitch));
  const music = audioVoices.find(voice => voice.path === 'assets/audio/music.mp3');
  assert.ok(music.loop);
  assert.equal(music.plays, 0, 'music waits for the first user gesture');
  function step() {
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id); clock += 1000 / 60; texts = [];
    for (const voice of audioVoices) if (!voice.loop) voice.ended?.();
    callback(clock);
  }
  function tap(x: number, y: number) {
    const event = { changedTouches: [{ identifier: 1, clientX: x + 80, clientY: y + 80 }] };
    handlers.get('TouchStart')!(event);
    handlers.get('TouchEnd')!(event);
  }
  function mouseTap(x: number, y: number, button = 0) {
    const event = { x: x + 80, y: y + 80, button };
    handlers.get('MouseDown')!(event); handlers.get('MouseUp')!(event);
  }
  function advance() { for (let frame = 0; frame < 60; frame++) step(); }
  const before = soundPlays;
  tap(1046, 524);
  assert.equal(soundPlays, before + 1, 'touching drop reaches gameplay and sound');
  assert.equal(music.plays, 1, 'first gameplay gesture starts the music');
  tap(1077, 48); step();
  assert.ok(music.pauses > 0, 'music control pauses only the background loop');
  tap(1077, 48); step();
  assert.equal(music.plays, 2, 'music control can turn the loop on again');
  const initialDraws = imagesDrawn;
  for (let frame = 0; frame < 60; frame++) step();
  assert.ok(imagesDrawn > initialDraws + 60 * 14, 'dropped candy remains in the simulated scene');
  assert.equal(frames.size, 1, 'animation loop never schedules duplicate frames');
  handlers.get('Hide')!(); step();
  assert.ok(music.pauses > 0, 'backgrounding pauses the loop');
  const pausedPlays = soundPlays;
  tap(1046, 524); step();
  assert.equal(soundPlays, pausedPlays, 'backgrounded game blocks another drop');
  handlers.get('Show')!();
  tap(640, 420); step(); // Explicit resume button.
  tap(1046, 524);
  assert.equal(soundPlays, pausedPlays + 1, 'game can resume and drop again');
  advance();
  const mouseBefore = soundPlays;
  mouseTap(1046, 524);
  assert.equal(soundPlays, mouseBefore + 1, 'native desktop mouse coordinates hit the safe-area-adjusted drop button');
  advance();
  mouseTap(1046, 524, 2);
  assert.equal(soundPlays, mouseBefore + 1, 'right mouse button cannot drop candy');

  // A sound toggle is intentionally non-idempotent: duplicate events would turn
  // it back on, so this checks deduplication independently of drop cooldown.
  tap(987, 48); mouseTap(987, 48); // Touch arrives first, synthetic mouse follows.
  advance();
  const muted = soundPlays;
  mouseTap(1046, 524);
  assert.equal(soundPlays, muted, 'synthetic mouse does not toggle sound back on');
  advance();
  mouseTap(987, 48); tap(987, 48); // Mouse arrives first, synthetic touch follows.
  advance();
  const unmuted = soundPlays;
  mouseTap(1046, 524);
  assert.equal(soundPlays, unmuted + 1, 'synthetic touch does not toggle sound off again');

  advance();
  const keyboardBefore = soundPlays;
  const space = { key: ' ', code: 'Space' };
  handlers.get('KeyDown')!(space); handlers.get('KeyDown')!(space);
  assert.equal(soundPlays, keyboardBefore + 1, 'keyboard space drops once');
  advance();
  handlers.get('KeyDown')!(space);
  assert.equal(soundPlays, keyboardBefore + 1, 'held space remains deduplicated beyond the drop cooldown');
  handlers.get('KeyUp')!(space); handlers.get('KeyDown')!(space); handlers.get('KeyUp')!(space);
  assert.equal(soundPlays, keyboardBefore + 2, 'releasing space permits a fresh drop');
  advance();
  const pause = { key: 'p', code: 'KeyP' };
  handlers.get('KeyDown')!(pause); step();
  assert.ok(texts.includes('休息一小会儿'));
  handlers.get('KeyDown')!(pause); step();
  assert.ok(texts.includes('休息一小会儿'), 'repeated pause key cannot resume immediately');
  handlers.get('KeyUp')!(pause); handlers.get('KeyDown')!(pause); handlers.get('KeyUp')!(pause); step();
  assert.ok(!texts.includes('休息一小会儿'));
});
