/**
 * Procedural Web Audio synthesizer and Haptics controller for "Ripple".
 * Produces dark-water droplet acoustics, resonant wave impacts, and glassy crystal chimes.
 */
export class SoundAndHaptics {
          ctx                      = null;
          muted          = false;
          hapticsEnabled          = true;
  /** Visual micro-haptic rim pulse [0..1] for desktop tactile feedback */
         visualHapticPulse         = 0;

          ensureContext()                      {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window                                                           ).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

         setMuted(muted         )       {
    this.muted = muted;
  }

         isMuted()          {
    return this.muted;
  }

         setHapticsEnabled(enabled         )       {
    this.hapticsEnabled = enabled;
  }

         isHapticsEnabled()          {
    return this.hapticsEnabled;
  }

         triggerHaptic(pattern                   , visualIntensity         = 0.35)       {
    if (!this.hapticsEnabled) return;
    this.visualHapticPulse = Math.min(1, Math.max(this.visualHapticPulse, visualIntensity));
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  }

         decayVisualHaptic(dt        )       {
    if (this.visualHapticPulse > 0) {
      this.visualHapticPulse = Math.max(0, this.visualHapticPulse - dt * 5.5);
    }
  }

  /**
   * Crisp water droplet tap + subtle surface tension sub-thump.
   */
         playTap()       {
    this.triggerHaptic(8, 0.25);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Droplet pitch-up chirp
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(390, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.065);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);

    // 2. Soft low water tension thump
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, now);
    sub.frequency.exponentialRampToValueAtTime(58, now + 0.08);

    subGain.gain.setValueAtTime(0.11, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.09);
  }

  /**
   * Subtle muted tick when a tap is blocked because a ripple is still active or on the puck.
   */
         playTapBlocked()       {
    this.triggerHaptic(4, 0.12);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.045);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  /**
   * Warm hydro-push thrum when the expanding ripple wave hits the floating puck.
   */
         playWaveImpact(strength        )       {
    const s = Math.max(0.25, Math.min(1, strength));
    this.triggerHaptic(Math.round(10 + s * 10), 0.35 + s * 0.3);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 + s * 65, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16 * s, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Hoop cleared sound:
   * - Clean Shot (centre pass): Crystalline multi-partial glassy chime that ascends with multiplier!
   * - Standard Pass: Warm resonant glass tone.
   */
         playHoopCleared(isClean         , multiplier        )       {
    if (isClean) {
      this.triggerHaptic([12, 26, 20], 0.85);
    } else {
      this.triggerHaptic(14, 0.45);
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Pentatonic root frequencies ascending with multiplier
    const scale = [587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
    const rootFreq = scale[Math.min(scale.length - 1, Math.max(0, multiplier - 1))];

    if (isClean) {
      // Crystalline glassy chime: fundamental + harmonic & bell overtones + shimmer fifth
      const partials = [
        { ratio: 1.0, amp: 0.16, decay: 0.65 },
        { ratio: 1.498, amp: 0.09, decay: 0.55 },
        { ratio: 2.0, amp: 0.11, decay: 0.48 },
        { ratio: 2.756, amp: 0.065, decay: 0.38 },
        { ratio: 4.04, amp: 0.04, decay: 0.26 }
      ];

      for (const p of partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(rootFreq * p.ratio, now);

        gain.gain.setValueAtTime(0.0008, now);
        gain.gain.linearRampToValueAtTime(p.amp, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + p.decay);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + p.decay + 0.02);
      }
    } else {
      // Standard hoop pass: soft warm glass note
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  /**
   * Uplifting two-note shimmer when a counter-ripple saves the puck from the pool's edge.
   */
         playRecovery()       {
    this.triggerHaptic([10, 22, 14], 0.65);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 783.99];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  /**
   * Subtle sonar tick when hoop countdown is below 2 seconds.
   */
         playCountdownTick()       {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Muted ceramic clink (edge contact) or descending glass sigh (hoop timeout).
   */
         playGameOver(reason                                        )       {
    this.triggerHaptic([28, 35, 18], 0.9);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (reason === 'edge_contact') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(92, now + 0.22);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(155, now + 0.32);
    }

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}


//# sourceURL=audio.ts