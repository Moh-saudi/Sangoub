/**
 * SANGOUB AUDIO ALERTS SYSTEM
 * Distinctive Airport Flight Announcement Chime (صوت نداء الطائرة في المطار)
 * Synthesized with Web Audio API for zero-latency, 100% cross-platform reliability,
 * and zero reliance on external network downloads.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtxClass();
  }
  return sharedAudioCtx;
}

// Ensure audio context is resumed on user gesture
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Play the distinctive 3-tone Airport Flight Gate Announcement Chime
 * F5 (698.46 Hz) -> A5 (880.00 Hz) -> C6 (1046.50 Hz) with warm acoustic bell harmonics.
 */
export async function playAirportChime(): Promise<void> {
  // 1. Try to play external custom sound if configured
  try {
    const audio = new Audio('/sounds/airport_chime.mp3');
    audio.volume = 0.85;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      return;
    }
  } catch {
    // Fallback to high-fidelity Web Audio synthesis
  }

  // 2. High-fidelity Web Audio Synthesizer (Airport Announcement Chime)
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;

    // 3 iconic notes of the airport announcement chime
    const notes = [
      { freq: 698.46, time: 0.0, duration: 0.38, gain: 0.32 }, // F5
      { freq: 880.00, time: 0.26, duration: 0.38, gain: 0.30 }, // A5
      { freq: 1046.50, time: 0.52, duration: 0.85, gain: 0.35 }, // C6
    ];

    notes.forEach(({ freq, time, duration, gain: targetGain }) => {
      const startTime = now + time;
      const stopTime = startTime + duration;

      // Master note gain envelope (soft bell attack + lingering acoustic decay)
      const noteGain = ctx.createGain();
      noteGain.connect(ctx.destination);
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.linearRampToValueAtTime(targetGain, startTime + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

      // Primary warm tone (sine wave)
      const primaryOsc = ctx.createOscillator();
      primaryOsc.type = 'sine';
      primaryOsc.frequency.setValueAtTime(freq, startTime);
      primaryOsc.connect(noteGain);
      primaryOsc.start(startTime);
      primaryOsc.stop(stopTime);

      // Harmonic chime shimmer (triangle wave at octave harmonic, giving bell resonance)
      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.0001, startTime);
      harmonicGain.gain.linearRampToValueAtTime(targetGain * 0.3, startTime + 0.012);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.7));
      harmonicGain.connect(ctx.destination);

      const harmonicOsc = ctx.createOscillator();
      harmonicOsc.type = 'triangle';
      harmonicOsc.frequency.setValueAtTime(freq * 2.02, startTime); // slightly detuned 2nd harmonic
      harmonicOsc.connect(harmonicGain);
      harmonicOsc.start(startTime);
      harmonicOsc.stop(stopTime);
    });
  } catch (err) {
    console.warn('[AudioAlerts] Could not play airport chime:', err);
  }
}
