import { useState, useEffect, useCallback, useRef } from 'react';
import { Note, getNoteName } from './chord_detector';

// Callbacks so page.tsx can wire up the audio engine without importing it here
export interface MidiCallbacks {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
  onSustain?: (active: boolean) => void;
}

export function useMidi(callbacks?: MidiCallbacks) {
  const [activeNotes, setActiveNotes] = useState<Map<number, Note>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<string[]>([]);
  const [sustainActive, setSustainActive] = useState<boolean>(false);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks; // Always up to date without re-subscribing

  const onMIDIMessage = useCallback((event: any) => {
    const data = event.data;
    if (!data || data.length < 3) return;

    const status = data[0];
    // Ignore MIDI clock (0xF8) and active sensing (0xFE) spam
    if (status === 0xF8 || status === 0xFE) return;

    const command = status >> 4;
    const data1 = data[1];
    const data2 = data[2];

    const isNoteOn  = command === 9 && data2 > 0;
    const isNoteOff = command === 8 || (command === 9 && data2 === 0);
    const isSustain = command === 0x0B && data1 === 64;

    if (isNoteOn) {
      setActiveNotes(prev => {
        const next = new Map(prev);
        next.set(data1, { midi: data1, name: getNoteName(data1), velocity: data2 });
        return next;
      });
      cbRef.current?.onNoteOn?.(data1, data2 / 127);

    } else if (isNoteOff) {
      setActiveNotes(prev => {
        const next = new Map(prev);
        next.delete(data1);
        return next;
      });
      cbRef.current?.onNoteOff?.(data1);

    } else if (isSustain) {
      const active = data2 >= 64;
      setSustainActive(active);
      cbRef.current?.onSustain?.(active);
    }
  }, []);

  useEffect(() => {
    let midiAccess: any = null;

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setError("Web MIDI API is not supported in this browser. Try Chrome, Edge, or Brave.");
      return;
    }

    navigator.requestMIDIAccess().then(
      (access: any) => {
        midiAccess = access;

        const attach = (input: any) => {
          input.addEventListener('midimessage', onMIDIMessage);
          input.onmidimessage = onMIDIMessage;
        };

        const refreshDevices = () => {
          const inputs = Array.from(access.inputs.values()) as any[];
          setDevices(inputs.map((i: any) => i.name));
          return inputs;
        };

        refreshDevices().forEach(attach);

        access.onstatechange = (e: any) => {
          refreshDevices();
          if (e.port.state === 'connected' && e.port.type === 'input') {
            attach(e.port);
          }
        };
      },
      () => {
        setError("MIDI access denied. Please allow MIDI access in your browser permissions.");
      }
    );

    return () => {
      if (midiAccess) {
        (Array.from(midiAccess.inputs.values()) as any[]).forEach((input: any) => {
          input.removeEventListener('midimessage', onMIDIMessage);
          input.onmidimessage = null;
        });
      }
    };
  }, [onMIDIMessage]);

  return {
    activeNotes: Array.from(activeNotes.keys()),
    rawNotes: Array.from(activeNotes.values()),
    devices,
    error,
    sustainActive,
  };
}
