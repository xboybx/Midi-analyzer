import React from 'react';
import { getNoteName } from '@/lib/chord_detector';

interface PianoProps {
  activeNotes: number[]; // Array of midi numbers
}

const START_MIDI = 21; // A0 (Standard start)
const END_MIDI = 119;  // B8 (Exactly 99 keys)

const isBlackKey = (midi: number) => {
  const note = midi % 12;
  return [1, 3, 6, 8, 10].includes(note);
};

export default function Piano({ activeNotes }: PianoProps) {
  const keys = [];
  
  for (let i = START_MIDI; i <= END_MIDI; i++) {
    keys.push(i);
  }

  return (
    <div className="piano-container">
      {keys.map((midi) => {
        const isBlack = isBlackKey(midi);
        const isActive = activeNotes.includes(midi);
        const noteName = getNoteName(midi);
        const octave = Math.floor(midi / 12) - 1;
        
        // Match ChordieApp behavior: Idle C keys have permanent indicators at the bottom
        const isC = noteName === "C" && !isBlack;
        
        return (
          <div 
            key={midi} 
            className={`piano-key ${isBlack ? 'black-key' : 'white-key'}`}
          >
             {isActive && <div className="key-highlight"></div>}
             {isActive && !isBlack && <span className="floating-note-label">{noteName}</span>}
             {isActive && isBlack && <span className="floating-note-label" style={{ top: '-46px' }}>{noteName}</span>}
             {isC && <span className="idle-c-label">C{octave}</span>}
          </div>
        );
      })}
    </div>
  );
}
