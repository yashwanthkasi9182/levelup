let context: AudioContext | null = null;
export function playSound(level = false) {
  try {
    context ??= new AudioContext();
    void context.resume();
    const notes = level ? [392, 493.88, 587.33, 783.99] : [659.25, 987.77];
    notes.forEach((frequency, i) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      const t = context!.currentTime + i * 0.09;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.075, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(context!.destination);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  } catch {
    /* Audio is optional when unsupported or blocked by the browser. */
  }
}
