type ToneKind = "success" | "error";

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isMusicActive = false;
  private musicTimer: number | null = null;

  private ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (!this.context) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) {
        return null;
      }

      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);

      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
    }

    return this.context;
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) {
      return false;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    return true;
  }

  async startMusic(enabled: boolean, multiplier = 2) {
    if (!enabled || this.isMusicActive) {
      return;
    }

    const context = this.ensureContext();
    const musicGain = this.musicGain;
    if (!context || !musicGain) {
      return;
    }

    await this.unlock();

    const now = context.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(0, now);
    musicGain.gain.linearRampToValueAtTime(0.62, now + 0.45);

    const tracks: Record<number, { notes: number[]; waveform: OscillatorType[]; step: number }> = {
      2: { notes: [261.63, 329.63, 392, 523.25], waveform: ["triangle", "sine"], step: 0.3 },
      3: { notes: [293.66, 369.99, 440, 554.37], waveform: ["triangle", "triangle"], step: 0.28 },
      4: { notes: [329.63, 392, 493.88, 659.25], waveform: ["square", "triangle"], step: 0.26 },
      5: { notes: [392, 440, 523.25, 659.25], waveform: ["sine", "triangle"], step: 0.27 },
      6: { notes: [220, 277.18, 329.63, 392], waveform: ["sine", "sine"], step: 0.34 },
      7: { notes: [293.66, 440, 587.33, 783.99], waveform: ["triangle", "sine"], step: 0.24 },
      8: { notes: [246.94, 329.63, 369.99, 493.88], waveform: ["square", "triangle"], step: 0.29 },
      9: { notes: [261.63, 311.13, 392, 466.16], waveform: ["triangle", "square"], step: 0.31 },
    };

    const track = tracks[multiplier] ?? tracks[2];
    const sequence = [...track.notes, track.notes[1], track.notes[3], track.notes[2]];
    const loopDuration = sequence.length * track.step + 0.55;

    sequence.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = track.waveform[index % track.waveform.length];
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * track.step);
      gain.gain.linearRampToValueAtTime(0.24, now + index * track.step + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * track.step + 0.42);
      oscillator.connect(gain);
      gain.connect(musicGain);
      oscillator.start(now + index * track.step);
      oscillator.stop(now + index * track.step + 0.44);
    });

    this.isMusicActive = true;

    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
    }

    this.musicTimer = window.setTimeout(() => {
      this.isMusicActive = false;
      this.startMusic(enabled, multiplier);
    }, loopDuration * 1000 - 80);
  }

  stopMusic() {
    if (!this.musicGain || !this.context) {
      return;
    }

    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0, now + 0.3);
    this.isMusicActive = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  async playTone(kind: ToneKind, enabled: boolean) {
    if (!enabled) {
      return;
    }

    const context = this.ensureContext();
    const master = this.master;
    if (!context || !master) {
      return;
    }

    await this.unlock();

    const start = context.currentTime;

    if (kind === "success") {
      [
        { freq: 392, end: 523.25, at: 0, duration: 0.18, type: "triangle" as OscillatorType },
        { freq: 523.25, end: 783.99, at: 0.12, duration: 0.24, type: "sine" as OscillatorType },
      ].forEach((tone) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.freq, start + tone.at);
        oscillator.frequency.exponentialRampToValueAtTime(tone.end, start + tone.at + tone.duration);
        gain.gain.setValueAtTime(0.0001, start + tone.at);
        gain.gain.linearRampToValueAtTime(0.24, start + tone.at + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + tone.duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(start + tone.at);
        oscillator.stop(start + tone.at + tone.duration + 0.02);
      });
      return;
    }

    [
      { freq: 280, end: 220, at: 0, duration: 0.18 },
      { freq: 220, end: 174.61, at: 0.16, duration: 0.22 },
      { freq: 174.61, end: 130.81, at: 0.34, duration: 0.28 },
    ].forEach((tone) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(tone.freq, start + tone.at);
      oscillator.frequency.exponentialRampToValueAtTime(tone.end, start + tone.at + tone.duration);
      gain.gain.setValueAtTime(0.0001, start + tone.at);
      gain.gain.linearRampToValueAtTime(0.16, start + tone.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + tone.duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start + tone.at);
      oscillator.stop(start + tone.at + tone.duration + 0.03);
    });
  }
}
