import { useEffect } from "react";
import { audioEngine } from "@/lib/audio_engine";

/**
 * Registers cleanup handlers that fire when the user:
 *   - Closes / refreshes the tab  (beforeunload)
 *   - Hides the tab               (visibilitychange → hidden)
 *
 * On visibility-hidden we silence all active notes immediately so audio
 * doesn't bleed into the background. On beforeunload we do a full teardown
 * of all Tone.js nodes, the MIDI audio context, and the Web Audio Context.
 */
export function useAppCleanup() {
  useEffect(() => {
    const handleBeforeUnload = () => {
      audioEngine.releaseAll();
      audioEngine.dispose();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // User switched tabs / minimised — silence all audio immediately
        audioEngine.releaseAll();
        audioEngine.setPedal(false);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Also clean up when the React tree unmounts (dev hot-reload)
      audioEngine.releaseAll();
    };
  }, []);
}
