"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMidi } from "@/lib/midi";
import { detectChord } from "@/lib/chord_detector";
import { audioEngine, PIANO_SOUNDS, type PianoSoundId } from "@/lib/audio_engine";
import { useAppCleanup } from "@/lib/use_app_cleanup";
import Piano from "@/components/Piano";
import Fretboard from "@/components/Fretboard";
import SheetMusic from "@/components/SheetMusic";

type AudioState = "idle" | "loading" | "loaded" | "error";

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSoundPickerOpen, setIsSoundPickerOpen] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [selectedSound, setSelectedSound] = useState<PianoSoundId>("grand");
  const [pendingSound, setPendingSound] = useState<PianoSoundId>("grand");
  const soundPickerRef = useRef<HTMLDivElement>(null);

  useAppCleanup();

  const midiCallbacks = {
    onNoteOn: useCallback((midi: number, velocity: number) => {
      audioEngine.noteOn(midi, velocity);
    }, []),
    onNoteOff: useCallback((midi: number) => {
      audioEngine.noteOff(midi);
    }, []),
    onSustain: useCallback((active: boolean) => {
      audioEngine.setPedal(active);
    }, []),
  };

  const { activeNotes, devices, error: midiError, sustainActive } = useMidi(midiCallbacks);
  const currentChord = detectChord(activeNotes);
  const deviceNames = devices.length > 0 ? devices.join(", ") : null;

  const loadSound = async (soundId: PianoSoundId) => {
    setAudioState("loading");
    setAudioError(null);
    audioEngine.releaseAll();

    const result = await audioEngine.init(soundId);
    if (result.success) {
      setAudioState("loaded");
      setSelectedSound(soundId);
    } else {
      setAudioState("error");
      setAudioError(result.error ?? "Unknown error loading samples.");
    }
  };

  // Close sound picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (soundPickerRef.current && !soundPickerRef.current.contains(e.target as Node)) {
        setIsSoundPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentSoundLabel = PIANO_SOUNDS.find(s => s.id === selectedSound)?.label ?? "Grand Piano";

  return (
    <div className="app-container">
      {/* ─── HEADER ─── */}
      <header className="top-header">
        <div className="logo-section">
          <img src="/128.png" alt="Logo" className="logo-image" />
          <h1 className="app-title">Chord Analyzer</h1>
        </div>

        <div className="device-info">
          <span className="device-label">MIDI:</span>
          {midiError ? (
            <span className="header-error-badge">⚠ {midiError}</span>
          ) : deviceNames ? (
            <span className="device-name">{deviceNames}</span>
          ) : (
            <span className="device-none">No device detected</span>
          )}
        </div>

        <div className="header-controls">
          {/* 🔊 Enable / Loading / Error */}
          {audioState === "idle" && (
            <button className="enable-audio-btn" onClick={() => loadSound(selectedSound)}>
              🔊 Enable Sound
            </button>
          )}
          {audioState === "loading" && (
            <span className="audio-loading-badge">⌛ Loading {currentSoundLabel}…</span>
          )}

          {/* The green badge IS the sound picker — click to switch */}
          {audioState === "loaded" && (
            <div className="sound-picker-wrap" ref={soundPickerRef}>
              <button
                className="audio-active-badge clickable"
                onClick={() => setIsSoundPickerOpen(v => !v)}
                title="Click to switch instrument"
              >
                🎹 {currentSoundLabel} ▾
              </button>
              {isSoundPickerOpen && (
                <div className="options-menu">
                  <div className="options-section-title">Switch Instrument</div>
                  {PIANO_SOUNDS.map(sound => (
                    <button
                      key={sound.id}
                      className={`options-item ${selectedSound === sound.id ? "active" : ""}`}
                      onClick={() => { loadSound(sound.id); setIsSoundPickerOpen(false); }}
                    >
                      <strong>{sound.label}</strong>
                      <span>{sound.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {audioState === "error" && (
            <button className="enable-audio-btn error" onClick={() => loadSound(selectedSound)} title={audioError ?? ""}>
              ⚠ Retry Sound
            </button>
          )}

          <button className="settings-btn" onClick={() => { setIsSettingsOpen(true); setPendingSound(selectedSound); }}>
            ⚙️
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="content-pane">
        <div className="sheet-music-pane">
          <h3 className="key-indicator">Key: C</h3>
          <SheetMusic activeNotes={activeNotes} />
          <div className="sustain-indicator">
            <div className={`status-dot ${sustainActive ? "active" : ""}`} />
            <span className={sustainActive ? "sustain-on" : ""}>Sustain</span>
          </div>
        </div>

        <div className="fretboard-pane">
          <div className="chord-display-area">
            {currentChord ? (
              <>
                <div className="main-chord-text">{currentChord.primary}</div>
                <div className="alt-chord-text">
                  {currentChord.alternates.map((alt, i) => <div key={i}>{alt}</div>)}
                </div>
              </>
            ) : (
              <div className="main-chord-text chord-placeholder">READY</div>
            )}
          </div>
          <Fretboard activeNotes={activeNotes} />
        </div>
      </div>

      {/* ─── PIANO ─── */}
      <div className="piano-wrapper">
        <div className="support-indicator">
          <span className={`status-dot ${devices.length > 0 ? "active" : ""}`} />
          <span>Support/Midi</span>
          {audioState === "error" && (
            <span className="piano-audio-error" title={audioError ?? ""}>· ⚠ Audio failed</span>
          )}
        </div>
        <Piano activeNotes={activeNotes} />
      </div>

      {/* ─── SETTINGS MODAL ─── */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>×</button>
            </div>

            {/* Audio Engine Status */}
            <div className="settings-status-row">
              <span className="settings-label">Audio Engine</span>
              <span className={`settings-value ${audioState === "loaded" ? "ok" : audioState === "error" ? "err" : ""}`}>
                {audioState === "loaded" ? `✓ Active — ${currentSoundLabel}` : audioState === "loading" ? "Loading…" : audioState === "error" ? `✗ ${audioError}` : "Inactive"}
              </span>
            </div>

            {/* Piano Sound Selection */}
            <div className="settings-section">
              <label className="settings-section-title">Piano Sound</label>
              <div className="piano-sound-grid">
                {PIANO_SOUNDS.map(sound => (
                  <button
                    key={sound.id}
                    className={`piano-sound-card ${pendingSound === sound.id ? "selected" : ""}`}
                    onClick={() => setPendingSound(sound.id)}
                  >
                    <span className="sound-card-name">{sound.label}</span>
                    <span className="sound-card-desc">{sound.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Future: Sheet Clef */}
            <div className="settings-section">
              <label className="settings-section-title">Sheet Clef <span className="coming-soon">coming soon</span></label>
              <select className="settings-select" disabled>
                <option>Grand Staff</option>
                <option>Treble Only</option>
                <option>Bass Only</option>
              </select>
            </div>

            {/* Future: Piano Range */}
            <div className="settings-section">
              <label className="settings-section-title">Piano Range <span className="coming-soon">coming soon</span></label>
              <select className="settings-select" disabled>
                <option>99 Keys</option>
                <option>88 Keys</option>
                <option>61 Keys</option>
              </select>
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
              <button
                className="modal-apply-btn"
                onClick={() => { loadSound(pendingSound); setIsSettingsOpen(false); }}
                disabled={audioState === "loading"}
              >
                {pendingSound !== selectedSound ? "Apply & Load Sound" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
