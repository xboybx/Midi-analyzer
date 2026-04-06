export type Note = {
  midi: number;
  name: string;
  velocity: number;
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function getNoteName(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

export type ChordResult = {
  primary: string;
  alternates: string[];
};

export function detectChord(activeNotes: number[]): ChordResult | null {
  if (activeNotes.length === 0) return null;
  if (activeNotes.length === 1) {
    return { primary: getNoteName(activeNotes[0]), alternates: [] };
  }
  if (activeNotes.length === 2) {
    const sortedCount = [...activeNotes].sort((a, b) => a - b);
    const diff = sortedCount[1] - sortedCount[0];
    const intervalNames = ["Unison", "Minor 2nd", "Major 2nd", "Minor 3rd", "Major 3rd", "Perfect 4th", "Tritone", "Perfect 5th", "Minor 6th", "Major 6th", "Minor 7th", "Major 7th", "Octave"];
    const name = diff <= 12 ? intervalNames[diff] : `Interval: ${diff} semitones`;
    return { primary: name, alternates: [] };
  }

  // Sort ascending
  const sorted = [...activeNotes].sort((a, b) => a - b);
  
  // Find intervals from the lowest note (bass)
  const root = sorted[0];
  const rootName = getNoteName(root);

  // Normalize intervals relative to root
  const intervals = Array.from(new Set(sorted.map(n => (n - root) % 12))).sort((a, b) => a - b);
  const intervalStr = intervals.join(",");

  // Dictionary of intervals
  const CHORD_DICTIONARY: Record<string, string> = {
    "0,4,7": "Major",
    "0,3,7": "Minor",
    "0,4,7,10": "Dominant 7",
    "0,4,7,11": "Major 7",
    "0,3,7,10": "Minor 7",
    "0,3,6": "Diminished",
    "0,3,6,9": "Diminished 7",
    "0,4,8": "Augmented",
    "0,5,7": "Sus4",
    "0,2,7": "Sus2",
    "0,4,7,9": "Major 6",
    "0,3,7,9": "Minor 6",
    "0,4,7,11,14": "Major 9",
    "0,3,7,10,14": "Minor 9",
    "0,4,7,10,14": "Dominant 9"
  };

  const alternates: string[] = [];
  let primary = "";

  const bassType = CHORD_DICTIONARY[intervalStr];
  if (bassType) {
    primary = `${rootName} ${bassType}`;
  }

  // Handle inversions (try treating each note as root)
  for (let i = 0; i < sorted.length; i++) {
    const potentialRoot = sorted[i];
    const potentialRootName = getNoteName(potentialRoot);
    const intervalsIdx = Array.from(new Set(sorted.map(n => (n - potentialRoot + 120) % 12))).sort((a, b) => a - b);
    const match = CHORD_DICTIONARY[intervalsIdx.join(",")];
    
    if (match) {
      const chordName = potentialRoot === root ? `${potentialRootName} ${match}` : `${potentialRootName} ${match} / ${rootName}`;
      if (!primary) {
        primary = chordName;
      } else if (chordName !== primary) {
        alternates.push(chordName);
      }
    }
  }

  if (!primary && alternates.length > 0) {
     primary = alternates.shift()!;
  }

  if (!primary) {
     primary = "Complex Chord";
  }

  return { primary, alternates: Array.from(new Set(alternates)) };
}
