                                                                              
import { cloneConfig, DEFAULT_CONFIG } from './config.js?v=1';
import { createHoopTarget, pickNextHoopPosition } from './hoops.js?v=1';
import {
  allocId,
  createEmptyEvents,
  createInitialPuck,
  stepPhysics,
  trySpawnRipple,
                 
} from './physics.js?v=1';
import { SeededRNG } from './rng.js?v=1';

const STORAGE_KEY_BEST_SCORE = 'ripple_best_score_v1';
const STORAGE_KEY_BEST_HOOPS = 'ripple_best_hoops_v1';

export function createInitialTelemetry()               {
  return {
    tapsTotal: 0,
    tapsBlockedByActiveRipple: 0,
    tapsBlockedOnPuck: 0,
    hoopsCleared: 0,
    cleanShots: 0,
    maxMultiplier: 1,
    recoveries: 0,
    lastWaveTravelMs: 0,
    lastImpactSpeedDelta: 0,
    lastMissDiagnostic: ''
  };
}

export class RippleGame {
         config              ;
         state           ;
          rng           ;
          baseSeed        ;

  constructor(seed         = 20261020, config               = DEFAULT_CONFIG) {
    this.config = cloneConfig(config);
    this.baseSeed = seed >>> 0;
    this.rng = new SeededRNG(this.baseSeed);
    this.state = this.buildFreshState('title', this.baseSeed);
  }

          loadPersistedBest()                                           {
    let bestScore = 0;
    let bestHoops = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        bestScore = parseInt(localStorage.getItem(STORAGE_KEY_BEST_SCORE) || '0', 10) || 0;
        bestHoops = parseInt(localStorage.getItem(STORAGE_KEY_BEST_HOOPS) || '0', 10) || 0;
      }
    } catch {
      // Ignore storage errors in headless/private environments
    }
    return { bestScore, bestHoops };
  }

         savePersistedBest()       {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_BEST_SCORE, String(this.state.bestScore));
        localStorage.setItem(STORAGE_KEY_BEST_HOOPS, String(this.state.bestHoops));
      }
    } catch {
      // Ignore storage errors
    }
  }

          buildFreshState(phase                    , seed        )            {
    this.rng = new SeededRNG(seed);
    const { bestScore, bestHoops } = this.loadPersistedBest();
    const prevBestScore = this.state ? Math.max(bestScore, this.state.bestScore) : bestScore;
    const prevBestHoops = this.state ? Math.max(bestHoops, this.state.bestHoops) : bestHoops;

    const puck = createInitialPuck(this.config);
    const firstHoopPos = pickNextHoopPosition(
      0,
      { x: puck.x, y: puck.y },
      { x: 0, y: -1 },
      this.rng,
      this.config
    );
    const firstHoop = createHoopTarget(
      allocId(),
      0,
      firstHoopPos,
      { x: puck.x, y: puck.y },
      this.config
    );
    const secondHoopPreview = pickNextHoopPosition(
      1,
      firstHoopPos,
      { x: 0, y: -1 },
      this.rng,
      this.config
    );

    return {
      phase,
      score: 0,
      bestScore: prevBestScore,
      bestHoops: prevBestHoops,
      multiplier: 1,
      cleanStreak: 0,
      hoopsCleared: 0,
      runTimeSec: 0,
      puck,
      activeRipple: null,
      currentHoop: firstHoop,
      nextHoopPreview: secondHoopPreview,
      clearedEffects: [],
      ghostTaps: [],
      particles: [],
      callouts: [],
      failureReason: null,
      failureDiagnostic: '',
      failureFreezeTimer: 0,
      telemetry: createInitialTelemetry(),
      seed
    };
  }

  /**
   * Starts or restarts a run immediately.
   */
         startRun(customSeed         )       {
    const nextSeed =
      customSeed !== undefined
        ? customSeed >>> 0
        : (this.state.seed + 0x9e3779b9) >>> 0;
    this.state = this.buildFreshState('playing', nextSeed);
  }

         togglePause()       {
    if (this.state.phase === 'playing') {
      this.state.phase = 'paused';
    } else if (this.state.phase === 'paused') {
      this.state.phase = 'playing';
    }
  }

  /**
   * Handles a tap/click in pool coordinates (x, y).
   * - If in 'title': starts the run and, if the tap is a valid water tap, immediately spawns the opening ripple.
   * - If in 'gameover' (after the brief 180ms death-frame lock): one tap immediately starts a new run!
   * - If in 'playing': attempts to spawn the single active ripple.
   */
         handlePoolTap(poolPos      )             {
    if (this.state.phase === 'title') {
      this.state.phase = 'playing';
      return trySpawnRipple(this.state, poolPos.x, poolPos.y, this.config);
    }

    if (this.state.phase === 'gameover') {
      if (this.state.failureFreezeTimer <= 0) {
        this.startRun();
      }
      return createEmptyEvents();
    }

    if (this.state.phase === 'playing') {
      return trySpawnRipple(this.state, poolPos.x, poolPos.y, this.config);
    }

    return createEmptyEvents();
  }

         step(dt        )             {
    const events = stepPhysics(this.state, dt, this.config, this.rng);
    if (events.hoopCleared || events.runFailed) {
      this.savePersistedBest();
    }
    return events;
  }
}


//# sourceURL=game.ts