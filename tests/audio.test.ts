import assert from 'node:assert/strict';
import test from 'node:test';
import { AUDIO_PATHS, createBrowserAudio, createWechatAudio } from '../src/audio';

function nativeFixture() {
  const voices: any[] = [];
  let options: any;
  const runtime = {
    setInnerAudioOption(value: unknown) { options = value; },
    createInnerAudioContext(value: unknown) {
      const callbacks: Record<string, (...args: any[]) => void> = {};
      const voice = {
        options: value, src: '', loop: false, volume: 0, obeyMuteSwitch: true,
        plays: 0, stops: 0, pauses: 0, destroyed: false,
        play() { this.plays++; }, stop() { this.stops++; }, pause() { this.pauses++; }, destroy() { this.destroyed = true; },
        onCanplay(fn: () => void) { callbacks.canplay = fn; },
        onEnded(fn: () => void) { callbacks.ended = fn; },
        onError(fn: (error: unknown) => void) { callbacks.error = fn; },
        emit(name: string) { callbacks[name]?.(); },
      };
      voices.push(voice); return voice;
    },
  };
  const audio = createWechatAudio(runtime);
  const music = () => voices.find(voice => voice.src === AUDIO_PATHS.music)!;
  const effects = () => voices.filter(voice => voice.src !== AUDIO_PATHS.music);
  return { audio, voices, music, effects, get options() { return options; } };
}

test('wx audio config overrides iOS silent switch using the compatible native driver', () => {
  const f = nativeFixture();
  assert.equal(f.options.obeyMuteSwitch, false);
  assert.equal(f.options.mixWithOther, true);
  assert.equal(f.voices.length, 7);
  for (const voice of f.voices) {
    assert.deepEqual(voice.options, { useWebAudioImplement: false });
    assert.equal(voice.obeyMuteSwitch, false);
    assert.ok(voice.src.endsWith('.mp3'));
  }
  assert.equal(f.music().loop, true);
  assert.ok(f.music().volume < f.effects()[0].volume);
  f.audio.dispose();
  assert.ok(f.voices.every(voice => voice.destroyed));
});

test('wx queues first effect until canplay and pools overlapping effects without stop/play races', () => {
  const f = nativeFixture();
  f.audio.unlock(); f.audio.playSound('drop');
  const drop = f.voices.filter(voice => voice.src === AUDIO_PATHS.drop);
  assert.equal(drop[0].plays, 0, 'do not assume newly assigned src is immediately playable');
  drop[0].emit('canplay');
  assert.equal(drop[0].plays, 1, 'first gesture effect is kept while loading');
  drop[1].emit('canplay'); f.audio.playSound('drop');
  assert.equal(drop[1].plays, 1, 'overlap uses its own preloaded voice');
  f.audio.playSound('drop');
  assert.equal(drop[0].stops + drop[1].stops, 0, 'no immediate stop/play on active voices');
  drop[0].emit('ended'); f.audio.playSound('drop'); assert.equal(drop[0].plays, 2);
  f.audio.dispose();
});

test('wx music follows gesture, game pause, separate switches and visibility', () => {
  const f = nativeFixture();
  for (const voice of f.voices) voice.emit('canplay');
  const music = f.music();
  f.audio.setMusicPlaying(true); assert.equal(music.plays, 0, 'wait for user gesture');
  f.audio.unlock(); assert.equal(music.plays, 1);
  f.audio.setAudioEnabled(false); assert.equal(music.pauses, 0, 'effects mute does not mute music');
  f.audio.playSound('drop'); assert.equal(f.effects().reduce((sum, voice) => sum + voice.plays, 0), 0);
  f.audio.setMusicEnabled(false); assert.equal(music.pauses, 1);
  f.audio.setMusicEnabled(true); assert.equal(music.plays, 2);
  f.audio.setMusicPlaying(false); assert.equal(music.pauses, 2);
  f.audio.setMusicPlaying(true); assert.equal(music.plays, 3);
  f.audio.setVisible(false); assert.equal(music.pauses, 3);
  f.audio.unlock(); f.audio.setVisible(true); assert.equal(music.plays, 3, 'return from background never auto-resumes paused game music');
  f.audio.setMusicPlaying(true); assert.equal(music.plays, 4);
  f.audio.dispose();
});

test('browser decodes generated files once, supports overlap and pauses music independently', async () => {
  const originalContext = globalThis.AudioContext;
  const originalFetch = globalThis.fetch;
  const nodes: any[] = [];
  const paths: string[] = [];
  let fake: any;
  class Context {
    currentTime = 0; state = 'suspended'; destination = {}; closed = false;
    constructor() { fake = this; }
    createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
    createBufferSource() {
      const node = { buffer: undefined, loop: false, starts: 0, stops: 0, connect() {}, disconnect() {}, start() { this.starts++; }, stop() { this.stops++; } };
      nodes.push(node); return node;
    }
    decodeAudioData() { return Promise.resolve({ duration: 30 }); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
  }
  globalThis.AudioContext = Context as any;
  globalThis.fetch = (async (path: string) => { paths.push(path); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; }) as any;
  try {
    const audio = createBrowserAudio();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(paths.sort(), Object.values(AUDIO_PATHS).sort());
    audio.setMusicPlaying(true); assert.equal(nodes.length, 0);
    audio.unlock(); await Promise.resolve();
    const music = nodes.find(node => node.loop);
    assert.equal(music.starts, 1);
    audio.playSound('merge'); audio.playSound('merge');
    assert.equal(nodes.filter(node => !node.loop).length, 2, 'each effect gets an independent source');
    audio.setAudioEnabled(false); assert.equal(music.stops, 0);
    audio.setMusicPlaying(false); assert.equal(music.stops, 1);
    audio.setVisible(false); audio.setVisible(true); audio.unlock(); await Promise.resolve();
    assert.equal(nodes.filter(node => node.loop).length, 1, 'visibility alone does not restart music');
    audio.setMusicPlaying(true); assert.equal(nodes.filter(node => node.loop).length, 2);
    audio.dispose(); assert.equal(fake.closed, true);
  } finally {
    globalThis.AudioContext = originalContext; globalThis.fetch = originalFetch;
  }
});

test('late wx canplay cannot resurrect a muted or backgrounded queued effect', () => {
  const f = nativeFixture();
  const merge = f.voices.filter(voice => voice.src === AUDIO_PATHS.merge);
  f.audio.unlock(); f.audio.playSound('merge');
  f.audio.setAudioEnabled(false); merge[0].emit('canplay');
  assert.equal(merge[0].plays, 0);
  f.audio.setAudioEnabled(true); f.audio.playSound('merge');
  assert.equal(merge[0].plays, 1);
  f.audio.playSound('merge'); f.audio.setVisible(false); merge[1].emit('canplay');
  assert.equal(merge[1].plays, 0);
  f.audio.dispose();
});
