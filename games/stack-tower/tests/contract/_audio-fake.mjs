/**
 * 契约测试假件：AudioContextLike / Storage / 时钟 / sfx-pack buffer（零依赖，确定性）。
 * 仅供 m21 契约族使用；断言语义见各 spec 文件。
 */

/** 假 AudioContext：记录 source/osc 创建与 playbackRate/frequency，手动驱动 state 与时钟 */
export function createFakeAudioCtx({ sampleRate = 44100, startSuspended = true } = {}) {
  const sources = [];
  const oscillators = [];
  let state = startSuspended ? 'suspended' : 'running';
  let currentTime = 0;

  const makeGain = () => ({
    gain: { value: 0, setValueAtTime() {} },
    connect() {},
  });

  const ctx = {
    get state() {
      return state;
    },
    get currentTime() {
      return currentTime;
    },
    destination: { fake: 'destination' },
    sampleRate,
    async resume() {
      state = 'running';
    },
    createGain: makeGain,
    createBuffer(channels, length, rate) {
      return { duration: length / rate, channels, sampleRate: rate };
    },
    createBufferSource() {
      const src = {
        playbackRate: { value: 1 },
        onended: null,
        connect() {},
        started: false,
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(src);
      return src;
    },
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect() {},
        start() {},
        stop() {},
      };
      oscillators.push(osc);
      return osc;
    },
    async decodeAudioData(data) {
      return { duration: data.byteLength / 8000, channels: 1, sampleRate };
    },
  };
  return {
    ctx,
    sources,
    oscillators,
    setState(s) {
      state = s;
    },
    tickTime(ms) {
      currentTime += ms / 1000;
    },
  };
}

/** 手动时钟（manager now 注入） */
export function createFakeClock() {
  let now = 0;
  return { now: () => now, advance(ms) { now += ms; } };
}

/** Map 版 localStorage */
export function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => Object.fromEntries(map),
  };
}

/** 假 sfx-pack buffer 表（全部事件可解码，时长取 voices 表） */
export function fakeBufferLoader(durationByEvent = {}) {
  return async (eventId) => ({ duration: durationByEvent[eventId] ?? 0.09 });
}
