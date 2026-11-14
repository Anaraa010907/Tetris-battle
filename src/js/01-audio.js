// Game audio on one AudioContext.
//
// Every sound effect is decoded once, at load, into an AudioBuffer; playing it
// starts a cheap AudioBufferSourceNode. Creating an Audio element per sound
// makes the phone parse and decode the file again on every hit, and at ten
// sounds a second that alone stalls frames. Music is a single looping element.
//
// Tokens are replaced by base64 data URLs when the artifact is built, and a
// failed optional sound becomes an empty string. The bytes are read straight
// out of the data URL, since the artifact has no network access.
//
// Music and voice lines are carried at the end of the built file so a game
// that starts from a script at the end of <body> is playable before they have
// downloaded. Until the page is parsed their tokens read as a short silent
// clip; the build swaps the real audio into `new Audio(...)` elements and
// `decodeAudioData` calls on its own, so nothing here has to wait for them.
function createAudio({ sounds = {}, music = '', musicVolume = 0.5, maxVoices = 12, minGap = 0.06 } = {}) {
  const Context = window.AudioContext || window.webkitAudioContext;
  const ctx = Context ? new Context() : null; // starts suspended until a gesture
  const master = ctx ? ctx.createGain() : null;
  if (master) master.connect(ctx.destination);
  const buffers = {};
  const lastStart = {};
  let voices = 0;
  let muted = false;
  let musicWanted = false;

  function bytesFromDataUrl(url) {
    const binary = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  for (const [name, url] of Object.entries(sounds)) {
    if (!ctx || !url || !url.startsWith('data:')) continue; // failed optional sound: stay silent
    try {
      // Callback form also works on older iOS Safari.
      const decoding = ctx.decodeAudioData(bytesFromDataUrl(url), (buffer) => { buffers[name] = buffer; }, () => {});
      if (decoding && decoding.catch) decoding.catch(() => {}); // modern browsers also reject the promise
    } catch (_) { /* undecodable: stay silent */ }
  }

  // Created once, never per play, and kept in the document: the host mutes the
  // game by scanning audio and video elements, and a detached element escapes
  // that scan. Contexts are muted by the host without any help.
  const track = music ? new Audio(music) : null;
  if (track) {
    track.loop = true;
    track.volume = musicVolume;
    track.hidden = true;
    (document.body || document.documentElement).append(track);
  }

  function audible() { return !muted && !document.hidden; }

  // Browsers only start audio from a gesture, and iOS can suspend the context
  // again after a call or Siri, so every gesture re-checks it (cheap when running).
  function unlock() {
    if (!audible()) return;
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    if (track && track.paused && musicWanted) track.play().catch(() => {});
  }
  // A touch pointerdown is not a user activation; pointerup, touchend and click are.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    addEventListener(type, unlock, { capture: true, passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (ctx) ctx.suspend().catch(() => {});
      if (track) track.pause();
    } else {
      unlock();
    }
  });

  return {
    // play('hit') or play('coin', { volume: 0.6, rate: 1 + Math.random() * 0.1 })
    play(name, { volume = 1, rate = 1 } = {}) {
      const buffer = buffers[name];
      if (!buffer || !audible() || ctx.state !== 'running' || voices >= maxVoices) return;
      const now = ctx.currentTime;
      if (now - (lastStart[name] ?? -Infinity) < minGap) return; // a burst of hits is one sound
      lastStart[name] = now;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      let output = source;
      if (volume !== 1) {
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        output = gain;
      }
      output.connect(master);
      voices++;
      source.onended = () => { voices--; };
      source.start();
    },
    startMusic() {
      musicWanted = true;
      if (track && audible()) track.play().catch(() => {});
    },
    stopMusic() {
      musicWanted = false;
      if (track) track.pause();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 1;
      // Pause rather than write track.muted, which belongs to the host's mute.
      if (track && muted) track.pause();
      if (!muted) unlock();
    },
    get muted() { return muted; },
    get status(){return {decodedSounds:Object.keys(buffers),contextState:ctx?.state,musicPaused:track?.paused,musicDuration:track?.duration,musicLoop:track?.loop,muted,voices}} ,
  };
}

// Usage: the sounds map holds the exact tokens the audio tools returned, as
// string literals, so the build can replace them with data URLs.
// const audio = createAudio({ sounds: { hit: HIT_TOKEN, coin: COIN_TOKEN }, music: THEME_TOKEN });
// startButton.addEventListener('click', () => { audio.startMusic(); loop.start(); });
// muteButton.addEventListener('click', () => audio.setMuted(!audio.muted));
// audio.play('hit');

const audio=createAudio({sounds:{lock:'@@asset sfx/lock.mp3@@',clear:'@@asset sfx/clear.mp3@@'},music:'data:audio/wav;mable-deferred=duel_music;base64,bWFibGUtZGVmZXJyZWQ6ZHVlbF9tdXNpYw==',musicVolume:.28});
