import type { SoundKind } from './platform';

export const AUDIO_PATHS = {
  drop: 'assets/audio/drop.mp3',
  merge: 'assets/audio/merge.mp3',
  over: 'assets/audio/over.mp3',
  music: 'assets/audio/music.mp3',
} as const;
const EFFECT_VOLUME = 0.6;
const MUSIC_VOLUME = 0.16;
const EFFECT_MAX_DELAY = 350;

export interface AudioController {
  unlock(): void;
  playSound(kind: SoundKind): void;
  setAudioEnabled(enabled: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setMusicPlaying(playing: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

function diagnostics() {
  const reported = new Set<string>();
  return (key: string, error: unknown) => {
    if (reported.has(key)) return;
    reported.add(key);
    console.warn(`[Candy Fusion audio] ${key}`, error);
  };
}

/** Generated MP3s use Web Audio so short overlapping effects share one unlocked context. */
export function createBrowserAudio(): AudioController {
  const warn = diagnostics();
  let context: AudioContext | undefined;
  let effectsGain: GainNode | undefined, musicGain: GainNode | undefined;
  let disposed = false, unlocked = false, visible = true, effectsEnabled = true, musicEnabled = true, musicWanted = false;
  let musicSource: AudioBufferSourceNode | undefined, musicOffset = 0, musicStarted = 0;
  const buffers = new Map<keyof typeof AUDIO_PATHS, AudioBuffer>();
  const pending = new Map<SoundKind, number>();
  const activeEffects = new Set<AudioBufferSourceNode>();
  try {
    context = new AudioContext();
    effectsGain = context.createGain(); effectsGain.gain.value = EFFECT_VOLUME; effectsGain.connect(context.destination);
    musicGain = context.createGain(); musicGain.gain.value = MUSIC_VOLUME; musicGain.connect(context.destination);
  } catch (error) { warn('AudioContext unavailable', error); }

  function stopMusic() {
    if (!musicSource || !context) return;
    musicOffset += Math.max(0, context.currentTime - musicStarted);
    const source = musicSource; musicSource = undefined;
    try { source.stop(); } catch { /* Already ended. */ }
    source.disconnect();
  }
  function syncMusic() {
    if (!context || !musicGain || disposed) return;
    if (!unlocked || !visible || !musicEnabled || !musicWanted || context.state !== 'running') { stopMusic(); return; }
    const buffer = buffers.get('music');
    if (!buffer || musicSource) return;
    const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
    source.connect(musicGain); musicSource = source; musicStarted = context.currentTime;
    source.start(0, buffer.duration > 0 ? musicOffset % buffer.duration : 0);
  }
  function playEffect(kind: SoundKind) {
    if (!context || !effectsGain || disposed || !unlocked || !visible || !effectsEnabled) return;
    const buffer = buffers.get(kind);
    if (!buffer || context.state !== 'running') { pending.set(kind, Date.now()); return; }
    pending.delete(kind);
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(effectsGain);
    activeEffects.add(source);
    source.onended = () => { activeEffects.delete(source); source.disconnect(); };
    source.start();
  }
  function flush() {
    for (const [kind, requested] of pending) {
      if (Date.now() - requested > EFFECT_MAX_DELAY) pending.delete(kind);
      else if (buffers.has(kind) && context?.state === 'running') playEffect(kind);
    }
    syncMusic();
  }
  if (context) {
    const audioContext = context;
    for (const kind of Object.keys(AUDIO_PATHS) as (keyof typeof AUDIO_PATHS)[]) {
      void fetch(AUDIO_PATHS[kind]).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${AUDIO_PATHS[kind]}`);
        return response.arrayBuffer();
      }).then(bytes => audioContext.decodeAudioData(bytes)).then(buffer => {
        if (disposed) return;
        buffers.set(kind, buffer); flush();
      }).catch(error => warn(`load ${kind}`, error));
    }
  }
  const stopEffects = () => {
    pending.clear();
    for (const source of activeEffects) { try { source.stop(); } catch {} source.disconnect(); }
    activeEffects.clear();
  };
  return {
    unlock() {
      if (!context || disposed || !visible) return;
      unlocked = true;
      void context.resume().then(flush).catch(error => { unlocked = false; warn('browser unlock', error); });
    },
    playSound: playEffect,
    setAudioEnabled(enabled) { effectsEnabled = enabled; if (!enabled) stopEffects(); },
    setMusicEnabled(enabled) { musicEnabled = enabled; syncMusic(); },
    setMusicPlaying(playing) { musicWanted = playing; syncMusic(); },
    setVisible(value) {
      visible = value;
      if (!value) { stopEffects(); stopMusic(); }
      // The app must explicitly resume its paused game before music is wanted again.
      if (!value) musicWanted = false;
    },
    dispose() {
      if (disposed) return;
      disposed = true; stopEffects(); stopMusic(); buffers.clear();
      effectsGain?.disconnect(); musicGain?.disconnect();
      if (context) void context.close().catch(error => warn('browser close', error));
    },
  };
}

interface NativeVoice {
  audio: any;
  ready: boolean;
  busy: boolean;
  pendingAt: number | undefined;
}

/** Native driver keeps setInnerAudioOption effective on iOS, unlike the wx WebAudio driver. */
export function createWechatAudio(runtime: any): AudioController {
  const warn = diagnostics();
  let disposed = false, unlocked = false, visible = true, effectsEnabled = true, musicEnabled = true, musicWanted = false;
  const pools = new Map<SoundKind, NativeVoice[]>();
  let music: NativeVoice | undefined;
  try {
    runtime.setInnerAudioOption?.({ obeyMuteSwitch: false, mixWithOther: true, fail: (error: unknown) => warn('setInnerAudioOption', error) });
  } catch (error) { warn('setInnerAudioOption', error); }

  function playVoice(voice: NativeVoice, kind: string) {
    if (disposed) return;
    voice.pendingAt = undefined; voice.busy = true;
    try { voice.audio.play(); }
    catch (error) { voice.busy = false; warn(`play ${kind}`, error); }
  }
  function syncMusic() {
    if (!music || disposed) return;
    if (!unlocked || !visible || !musicEnabled || !musicWanted) {
      if (music.busy) { music.audio.pause(); music.busy = false; }
      return;
    }
    if (music.ready && !music.busy) playVoice(music, 'music');
  }
  function makeVoice(kind: keyof typeof AUDIO_PATHS, loop = false): NativeVoice | undefined {
    try {
      const audio = runtime.createInnerAudioContext({ useWebAudioImplement: false });
      const voice: NativeVoice = { audio, ready: false, busy: false, pendingAt: undefined };
      audio.autoplay = false; audio.loop = loop;
      audio.volume = loop ? MUSIC_VOLUME : EFFECT_VOLUME;
      // Retained for older base libraries; modern iOS uses global setInnerAudioOption above.
      audio.obeyMuteSwitch = false;
      audio.onCanplay(() => {
        if (disposed) return;
        voice.ready = true;
        if (loop) syncMusic();
        else if (voice.pendingAt !== undefined) {
          const recent = Date.now() - voice.pendingAt <= EFFECT_MAX_DELAY;
          voice.pendingAt = undefined;
          if (recent && unlocked && visible && effectsEnabled) playVoice(voice, kind);
        }
      });
      audio.onEnded(() => { voice.busy = false; });
      audio.onError((error: unknown) => { voice.busy = false; voice.pendingAt = undefined; warn(`native ${kind}`, error); });
      audio.src = AUDIO_PATHS[kind];
      return voice;
    } catch (error) { warn(`create ${kind}`, error); return undefined; }
  }
  for (const [kind, count] of [['drop', 2], ['merge', 3], ['over', 1]] as const) {
    const voices: NativeVoice[] = [];
    for (let i = 0; i < count; i++) { const voice = makeVoice(kind); if (voice) voices.push(voice); }
    pools.set(kind, voices);
  }
  music = makeVoice('music', true);
  // A canplay callback may fire synchronously in a test double or cached runtime.
  syncMusic();
  function stopEffects() {
    for (const pool of pools.values()) for (const voice of pool) {
      voice.pendingAt = undefined;
      if (voice.busy) { voice.audio.stop(); voice.busy = false; }
    }
  }
  return {
    unlock() { if (!disposed && visible) { unlocked = true; syncMusic(); } },
    playSound(kind) {
      if (disposed || !unlocked || !visible || !effectsEnabled) return;
      const pool = pools.get(kind) ?? [];
      // Do not stop a currently playing effect to retrigger it: overlap gets its own voice.
      const voice = pool.find(candidate => !candidate.busy && candidate.pendingAt === undefined);
      if (!voice) return;
      if (voice.ready) playVoice(voice, kind); else voice.pendingAt = Date.now();
    },
    setAudioEnabled(enabled) { effectsEnabled = enabled; if (!enabled) stopEffects(); },
    setMusicEnabled(enabled) { musicEnabled = enabled; syncMusic(); },
    setMusicPlaying(playing) { musicWanted = playing; syncMusic(); },
    setVisible(value) {
      visible = value;
      if (!value) { musicWanted = false; stopEffects(); }
      syncMusic();
    },
    dispose() {
      if (disposed) return;
      stopEffects();
      if (music) music.audio.pause();
      disposed = true;
      for (const pool of pools.values()) for (const voice of pool) voice.audio.destroy();
      music?.audio.destroy(); pools.clear();
    },
  };
}
