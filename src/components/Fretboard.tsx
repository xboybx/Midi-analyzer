import React, { useMemo } from 'react';
import { getNoteName } from '@/lib/chord_detector';

interface FretboardProps {
  activeNotes: number[];
}

const STRINGS = [
  { note: 'E', midiOffset: 64 }, // High E (string 1, top)
  { note: 'B', midiOffset: 59 },
  { note: 'G', midiOffset: 55 },
  { note: 'D', midiOffset: 50 },
  { note: 'A', midiOffset: 45 },
  { note: 'E', midiOffset: 40 }, // Low E (string 6, bottom)
];

const NUM_FRETS = 21;

// Geometry constants (all in SVG user units = px)
const LABEL_W  = 28;   // width of the string-name column
const NUT_W    = 8;    // extra thickness for the nut
const FRET_W   = 38;   // width per fret slot
const STRING_H = 28;   // vertical gap between strings
const TOP_PAD  = 16;   // top padding before first string
const BOT_PAD  = 24;   // space below last string for fret numbers
const DOT_R    = 5;    // fret-marker dot radius
const NOTE_R   = 11;   // note bead radius

// Fret positions where dots appear (standard guitar markers)
const SINGLE_DOTS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOTS = [12];

const SVG_W = LABEL_W + NUT_W + FRET_W * NUM_FRETS + 4;
const SVG_H = TOP_PAD + STRING_H * (STRINGS.length - 1) + BOT_PAD + 20;

function fretX(fret: number): number {
  // Left edge of the fret slot
  return LABEL_W + NUT_W + fret * FRET_W;
}

function stringY(sIdx: number): number {
  return TOP_PAD + sIdx * STRING_H;
}

// Center X of a fret cell (between fret bar and next fret bar)
function noteCenterX(fret: number): number {
  if (fret === 0) return LABEL_W + NUT_W / 2; // on the nut itself
  return LABEL_W + NUT_W + (fret - 0.5) * FRET_W;
}

export default function Fretboard({ activeNotes }: FretboardProps) {
  const { fingering, matches } = useMemo(() => {
    const fingering: Record<number, { stringIdx: number; fret: number }> = {};
    const usedStrings = new Set<number>();
    let matches = 0;

    [...activeNotes]
      .sort((a, b) => b - a)
      .forEach(midi => {
        let bestS = -1, bestFret = 999;
        for (let s = 0; s < STRINGS.length; s++) {
          if (usedStrings.has(s)) continue;
          const fret = midi - STRINGS[s].midiOffset;
          if (fret >= 0 && fret <= NUM_FRETS && fret < bestFret) {
            bestFret = fret;
            bestS = s;
          }
        }
        if (bestS !== -1) {
          fingering[midi] = { stringIdx: bestS, fret: bestFret };
          usedStrings.add(bestS);
          matches++;
        }
      });

    return { fingering, matches };
  }, [activeNotes]);

  const activeStrings = new Set(Object.values(fingering).map(f => f.stringIdx));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      <svg
        width={SVG_W}
        height={SVG_H}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* ── String labels ── */}
        {STRINGS.map((str, sIdx) => (
          <text
            key={`label-${sIdx}`}
            x={LABEL_W / 2}
            y={stringY(sIdx) + 5}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fontFamily="'Quicksand', sans-serif"
            fill="#222"
          >
            {str.note}
          </text>
        ))}

        {/* ── Nut ── */}
        <rect
          x={LABEL_W}
          y={stringY(0)}
          width={NUT_W}
          height={stringY(STRINGS.length - 1) - stringY(0)}
          fill="#111"
        />

        {/* ── Fret bar lines ── */}
        {Array.from({ length: NUM_FRETS + 1 }).map((_, fIdx) => {
          const x = LABEL_W + NUT_W + fIdx * FRET_W;
          return (
            <line
              key={`fret-${fIdx}`}
              x1={x} y1={stringY(0)}
              x2={x} y2={stringY(STRINGS.length - 1)}
              stroke="#555"
              strokeWidth={fIdx === 0 ? 0 : 1.5}
            />
          );
        })}

        {/* ── String lines ── */}
        {STRINGS.map((_, sIdx) => {
          const y = stringY(sIdx);
          const isActive = activeStrings.has(sIdx);
          return (
            <line
              key={`string-${sIdx}`}
              x1={LABEL_W + NUT_W}
              y1={y}
              x2={LABEL_W + NUT_W + NUM_FRETS * FRET_W}
              y2={y}
              stroke={isActive ? '#e53935' : '#333'}
              strokeWidth={isActive ? 2.5 : 1.5}
            />
          );
        })}

        {/* ── Outer border ── */}
        <rect
          x={LABEL_W + NUT_W}
          y={stringY(0)}
          width={NUM_FRETS * FRET_W}
          height={stringY(STRINGS.length - 1) - stringY(0)}
          fill="none"
          stroke="#333"
          strokeWidth={2}
        />

        {/* ── Fret position markers ── */}
        {SINGLE_DOTS.filter(f => f <= NUM_FRETS).map(fret => (
          <circle
            key={`dot-${fret}`}
            cx={noteCenterX(fret)}
            cy={stringY(2) + STRING_H / 2}
            r={DOT_R}
            fill="#ccc"
            stroke="#bbb"
          />
        ))}
        {DOUBLE_DOTS.filter(f => f <= NUM_FRETS).map(fret => (
          <React.Fragment key={`double-${fret}`}>
            <circle cx={noteCenterX(fret)} cy={stringY(1) + STRING_H / 2} r={DOT_R} fill="#ccc" stroke="#bbb" />
            <circle cx={noteCenterX(fret)} cy={stringY(3) + STRING_H / 2} r={DOT_R} fill="#ccc" stroke="#bbb" />
          </React.Fragment>
        ))}

        {/* ── Fret number labels ── */}
        {Array.from({ length: NUM_FRETS + 1 }).map((_, fIdx) => (
          <text
            key={`fnum-${fIdx}`}
            x={fIdx === 0 ? LABEL_W + NUT_W / 2 : noteCenterX(fIdx)}
            y={stringY(STRINGS.length - 1) + 18}
            textAnchor="middle"
            fontSize="11"
            fill="#999"
            fontFamily="'Quicksand', sans-serif"
          >
            {fIdx}
          </text>
        ))}

        {/* ── Note beads ── */}
        {Object.entries(fingering).map(([midiStr, { stringIdx, fret }]) => {
          const midi = parseInt(midiStr);
          const cx = fret === 0 ? LABEL_W + NUT_W / 2 : noteCenterX(fret);
          const cy = stringY(stringIdx);
          return (
            <React.Fragment key={`note-${midi}`}>
              <circle cx={cx} cy={cy} r={NOTE_R} fill="#a5cbf5" stroke="#4c8ef5" strokeWidth={1.5} />
              <text
                x={cx} y={cy + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fontFamily="'Quicksand', sans-serif"
                fill="#111"
              >
                {getNoteName(midi)}
              </text>
            </React.Fragment>
          );
        })}
      </svg>

      {/* Info row */}
      <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#888' }}>
        Calculated: {Math.max(1, activeNotes.length)} &mdash; Displaying: #1 of 1 &nbsp;|&nbsp;
        Notes matched: {matches} / {activeNotes.length}
      </div>
    </div>
  );
}
