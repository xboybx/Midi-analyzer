import React, { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector } from 'vexflow';
import { getNoteName } from '@/lib/chord_detector';

interface SheetMusicProps {
  activeNotes: number[];
}

export default function SheetMusic({ activeNotes }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(290, 200);
    const context = renderer.getContext();
    context.setFont('Arial', 10);

    // x=50 gives the brace connector and clef glyph room on the left side
    const trebleStaff = new Stave(50, 10, 220).addClef("treble").setContext(context);
    trebleStaff.draw();
    
    const bassStaff = new Stave(50, 95, 220).addClef("bass").setContext(context);
    bassStaff.draw();

    // Tie them securely
    new StaveConnector(trebleStaff, bassStaff)
       .setType(3) // 3 represents the BRACE connector in VexFlow 4+
       .setContext(context)
       .draw();

    const parsedTreble: string[] = [];
    const parsedBass: string[] = [];

    // IMPORTANT: VexFlow requires note keys in a StaveNote to be sorted by pitch ascending
    const sortedActive = [...activeNotes].sort((a,b) => a - b);

    // Track indices of accidentals
    const trebleAccidentals: number[] = [];
    const bassAccidentals: number[] = [];

    sortedActive.forEach(midi => {
      let name = getNoteName(midi).toLowerCase();
      const octave = Math.floor(midi / 12) - 1;
      const vfNote = `${name[0]}${name.length > 1 ? '#' : ''}/${octave}`;

      if (midi >= 60) {
         if (name.includes('#')) trebleAccidentals.push(parsedTreble.length);
         parsedTreble.push(vfNote);
      } else {
         if (name.includes('#')) bassAccidentals.push(parsedBass.length);
         parsedBass.push(vfNote);
      }
    });

    try {
      if (parsedTreble.length > 0) {
        const trebleChord = new StaveNote({ clef: "treble", keys: parsedTreble, duration: "w" });
        
        // FIX: Must bind Stave before assigning Accidental Modifiers which require stave calculations
        trebleChord.setStave(trebleStaff); 

        trebleAccidentals.forEach((idx) => {
          trebleChord.addModifier(new Accidental("#"), idx);
        });

        const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([trebleChord]);
        new Formatter().joinVoices([voice]).format([voice], 160);
        voice.draw(context, trebleStaff);
      }
      
      if (parsedBass.length > 0) {
         const bassChord = new StaveNote({ clef: "bass", keys: parsedBass, duration: "w" });
         
         bassChord.setStave(bassStaff); // FIX
         
         bassAccidentals.forEach((idx) => {
          bassChord.addModifier(new Accidental("#"), idx);
        });
        
         const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([bassChord]);
         new Formatter().joinVoices([voice]).format([voice], 160);
         voice.draw(context, bassStaff);
      }
    } catch (err) {
       console.error("VexFlow parsing error on keys:", parsedTreble, parsedBass, err);
    }

  }, [activeNotes]);

  return <div ref={containerRef} style={{ background: '#fff' }} />;
}
