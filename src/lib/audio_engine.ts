import * as Tone from "tone";

// Pre-compute all MIDI note names once at module load.
// This avoids calling Tone.Frequency().toNote() on the hot MIDI path,
// which allocates objects and runs string parsing on every key press.
const MIDI_NOTE_CACHE: string[] = Array.from({ length: 128 }, (_, i) =>
  Tone.Frequency(i, "midi").toNote()
);

export type PianoSoundId = "grand" | "clarinet";

export interface PianoSoundOption {
  id: PianoSoundId;
  label: string;
  description: string;
  baseUrl: string;
  urls: Record<string, string>;
}

// ─── Sample maps ────────────────────────────────────────────────────────────

const SALAMANDER_URLS: Record<string, string> = {
  A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
  A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
  A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
  A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
  A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
  A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
  A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
  A7: "A7.mp3", C8: "C8.mp3",
};

const CLARINET_URLS: Record<string, string> = {
  C3: "C3.mp3", D3: "D3.mp3", E3: "E3.mp3", F3: "F3.mp3",
  G3: "G3.mp3", A3: "A3.mp3", B3: "B3.mp3",
  C4: "C4.mp3", D4: "D4.mp3", E4: "E4.mp3", F4: "F4.mp3",
  G4: "G4.mp3", A4: "A4.mp3", B4: "B4.mp3",
  C5: "C5.mp3", D5: "D5.mp3", E5: "E5.mp3", F5: "F5.mp3",
  G5: "G5.mp3", A5: "A5.mp3", B5: "B5.mp3",
  C6: "C6.mp3",
};

export const PIANO_SOUNDS: PianoSoundOption[] = [
  {
    id: "grand",
    label: "Salamander Grand",
    description: "Rich, warm concert grand piano",
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    urls: SALAMANDER_URLS,
  },
  {
    id: "clarinet",
    label: "Clarinet",
    description: "Warm, breathy clarinet tone",
    baseUrl: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/clarinet-mp3/",
    urls: CLARINET_URLS,
  },
];

// ─── Per-instrument DSP configurations ──────────────────────────────────────

interface InstrumentConfig {
  // Sampler playback
  samplerAttack: number;  // fade-in on triggerAttack (seconds)
  samplerRelease: number;  // fade-out on triggerRelease (seconds)
  // Sustain pedal behaviour
  pedalRelease: number;  // fade time when pedal is finally released
  // Room effect
  reverbDecay: number;  // seconds of reverb tail (0 = none)
  reverbWet: number;  // 0–1 wet mix
  // Output
  volumeDb: number;  // master gain trim
}

const CONFIGS: Record<PianoSoundId, InstrumentConfig> = {
  grand: {
    samplerAttack: 0,      // true hammer-strike: no fade-in at all
    samplerRelease: 0.8,    // natural damper fall
    pedalRelease: 2.0,    // strings ring very long when pedal lifts
    reverbDecay: 2.5,    // concert-hall tail
    reverbWet: 0.22,
    volumeDb: -3,
  },
  clarinet: {
    samplerAttack: 0.02,   // breath takes a moment
    samplerRelease: 0.12,   // wind instrument cuts off quickly
    pedalRelease: 0.25,   // sustain pedal on clarinet is barely noticeable
    reverbDecay: 1.2,    // small room / studio
    reverbWet: 0.15,
    volumeDb: -5,
  },
};

// ─── Engine ─────────────────────────────────────────────────────────────────

class AudioEngine {
  private sampler: Tone.Sampler | null = null;
  private reverb: Tone.Freeverb | null = null;  // algorithmic — zero latency
  private masterVol: Tone.Volume | null = null;

  private isLoaded = false;
  private isLoading = false;
  private loadError: string | null = null;
  private currentSoundId: PianoSoundId | null = null;
  private currentConfig: InstrumentConfig | null = null;

  // Sustain pedal
  private isSustainDown = false;
  private sustainedNotes: Set<number> = new Set();   // notes held open by pedal
  private activeNotes: Set<number> = new Set();   // currently sounding notes

  // ── Public API ─────────────────────────────────────────────────────────────

  async init(soundId: PianoSoundId = "grand"): Promise<{ success: boolean; error?: string }> {
    if (this.isLoaded && this.currentSoundId === soundId) return { success: true };
    if (this.isLoading) return { success: false, error: "Already loading, please wait…" };

    this.isLoading = true;
    this.isLoaded = false;
    this.loadError = null;
    this._teardown();

    const sound = PIANO_SOUNDS.find(s => s.id === soundId)!;
    const config = CONFIGS[soundId];

    try {
      // Set up a low-latency AudioContext BEFORE starting Tone.
      // latencyHint:'playback' asks Chrome/Edge for the smallest possible
      // hardware buffer (typically 128 samples = ~3 ms at 44.1 kHz).
      if (Tone.getContext().state !== "running") {
        const ctx = new AudioContext({ latencyHint: "playback", sampleRate: 44100 });
        Tone.setContext(ctx);
      }
      await Tone.start();

      // ─── CRITICAL: Crush Tone.js's built-in scheduler delay ──────────────
      // By default Tone schedules ALL audio events 100 ms in the future
      // (lookAhead=0.1) so its JS scheduler has time to run. This is the
      // dominant source of perceived latency for live MIDI playing.
      // Setting lookAhead=0.01 (10 ms) keeps glitch protection while
      // removing ~90 ms of intentional delay. updateInterval must be ≤ lookAhead.
      const toneCtx = Tone.getContext() as unknown as Tone.Context;
      toneCtx.lookAhead = 0.01;   // 10 ms — was 100 ms
      toneCtx.updateInterval = 0.01; // scheduler ticks every 10 ms — was 50 ms

      // Build the signal chain: Sampler → Freeverb → Volume → Destination
      // Freeverb is algorithmic (Schroeder/Moorer) — NO convolution IR,
      // so it adds ZERO look-ahead / block latency unlike Tone.Reverb.
      this.masterVol = new Tone.Volume(config.volumeDb).toDestination();
      this.reverb = new Tone.Freeverb({
        roomSize: Math.min(0.9, config.reverbDecay / 3.5),  // map decay → roomSize 0–0.9
        dampening: 3000,
        wet: config.reverbWet,
      });
      this.reverb.connect(this.masterVol);

      return await new Promise(resolve => {
        const timeout = setTimeout(() => {
          this.isLoading = false;
          resolve({ success: false, error: "Timed out loading samples. Check your connection." });
        }, 30_000);

        this.sampler = new Tone.Sampler({
          urls: sound.urls,
          baseUrl: sound.baseUrl,
          attack: config.samplerAttack,
          release: config.samplerRelease,
          onload: () => {
            clearTimeout(timeout);
            this.sampler!.connect(this.reverb!);
            this.isLoaded = true;
            this.isLoading = false;
            this.currentSoundId = soundId;
            this.currentConfig = config;
            resolve({ success: true });
          },
          onerror: (err: any) => {
            clearTimeout(timeout);
            this.isLoading = false;
            const msg = `Failed to load samples: ${err}`;
            this.loadError = msg;
            resolve({ success: false, error: msg });
          },
        });
      });
    } catch (err: any) {
      this.isLoading = false;
      return { success: false, error: err?.message ?? "Unknown error" };
    }
  }

  noteOn(midi: number, velocity = 0.7) {
    if (!this.isReady) return;
    // Re-pressing a sustained note: remove from release queue first
    this.sustainedNotes.delete(midi);
    this.activeNotes.add(midi);

    try {
      const note = MIDI_NOTE_CACHE[midi] ?? Tone.Frequency(midi, "midi").toNote();
      const vel = Math.max(0.01, Math.min(1, velocity));
      // Tone.now() is correct here: after zeroing lookAhead it schedules
      // events at the current audio clock — effectively immediate.
      this.sampler!.triggerAttack(note, Tone.now(), vel);
    } catch (_) { }
  }

  noteOff(midi: number) {
    if (!this.isReady) return;
    this.activeNotes.delete(midi);

    if (this.isSustainDown) {
      // Park the note — let the pedal decide when to release
      this.sustainedNotes.add(midi);
    } else {
      this._releaseNote(midi);
    }
  }

  setPedal(down: boolean) {
    this.isSustainDown = down;

    if (!down && this.isReady) {
      // Pedal lifted — smoothly release all sustained notes
      const releaseTime = this.currentConfig?.pedalRelease ?? 1.0;
      this.sustainedNotes.forEach(midi => {
        try {
          const note = Tone.Frequency(midi, "midi").toNote();
          // Schedule the release slightly in the future for a smoother transition
          this.sampler!.triggerRelease(note, `+${releaseTime * 0.05}`);
        } catch (_) { }
      });
      this.sustainedNotes.clear();
    }
  }

  releaseAll() {
    try { this.sampler?.releaseAll(); } catch (_) { }
    this.sustainedNotes.clear();
    this.activeNotes.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _releaseNote(midi: number) {
    try {
      const note = MIDI_NOTE_CACHE[midi] ?? Tone.Frequency(midi, "midi").toNote();
      this.sampler?.triggerRelease(note, Tone.now());
    } catch (_) { }
  }

  private _teardown() {
    this.releaseAll();
    try { this.sampler?.dispose(); } catch (_) { }
    try { this.reverb?.dispose(); } catch (_) { }
    try { this.masterVol?.dispose(); } catch (_) { }
    this.sampler = null;
    this.reverb = null;
    this.masterVol = null;
    this.isLoaded = false;
    this.currentSoundId = null;
    this.currentConfig = null;
  }

  /** Full shutdown — call on page unload */
  dispose() {
    this._teardown();
    try {
      Tone.getTransport().stop();
      Tone.getContext().dispose();
    } catch (_) { }
  }

  private get isReady() {
    return this.isLoaded && !!this.sampler;
  }

  get status() {
    return {
      isLoaded: this.isLoaded,
      isLoading: this.isLoading,
      error: this.loadError,
      currentSoundId: this.currentSoundId,
    };
  }
}

export const audioEngine = new AudioEngine();
