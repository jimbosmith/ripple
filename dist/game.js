                                                                              
import { cloneConfig, DEFAULT_CONFIG } from './config.js?v=2';
import { createHoopTarget, pickNextHoopPosition } from './hoops.js?v=2';
import {
  allocId,
  createEmptyEvents,
  createInitialPuck,
  stepPhysics,
  trySpawnRipple,
                 
} from './physics.js?v=2';
import { SeededRNG } from './rng.js?v=2';

const STORAGE_KEY_BEST_SCORE = 'ripple_best_score_v1';
const STORAGE_KEY_BEST_HOOPS = 'ripple_best_hoops_v1';
const STORAGE_KEY_BEST_CLEAN = 'ripple_best_clean_v1';
const STORAGE_KEY_BEST_MULT = 'ripple_best_mult_v1';

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

          loadPersistedBest()   
                      
                      
                           
                           
    {
    let bestScore = 0;
    let bestHoops = 0;
    let bestCleanShots = 0;
    let bestMultiplier = 1;
    try {
      if (typeof localStorage !== 'undefined') {
        bestScore = parseInt(localStorage.getItem(STORAGE_KEY_BEST_SCORE) || '0', 10) || 0;
        bestHoops = parseInt(localStorage.getItem(STORAGE_KEY_BEST_HOOPS) || '0', 10) || 0;
        bestCleanShots = parseInt(localStorage.getItem(STORAGE_KEY_BEST_CLEAN) || '0', 10) || 0;
        bestMultiplier = parseInt(localStorage.getItem(STORAGE_KEY_BEST_MULT) || '1', 10) || 1;
      }
    } catch {
      // Ignore storage errors
    }
    return { bestScore, bestHoops, bestCleanShots, bestMultiplier };
  }

         savePersistedBest()       {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_BEST_SCORE, String(this.state.bestScore));
        localStorage.setItem(STORAGE_KEY_BEST_HOOPS, String(this.state.bestHoops));
        localStorage.setItem(STORAGE_KEY_BEST_CLEAN, String(this.state.bestCleanShots));
        localStorage.setItem(STORAGE_KEY_BEST_MULT, String(this.state.bestMultiplier));
      }
    } catch {
      // Ignore storage errors
    }
  }

          buildFreshState(phase                    , seed        )            {
    this.rng = new SeededRNG(seed);
    const persisted = this.loadPersistedBest();
    const prevBestScore = this.state
      ? Math.max(persisted.bestScore, this.state.bestScore)
      : persisted.bestScore;
    const prevBestHoops = this.state
      ? Math.max(persisted.bestHoops, this.state.bestHoops)
      : persisted.bestHoops;
    const prevBestClean = this.state
      ? Math.max(persisted.bestCleanShots, this.state.bestCleanShots)
      : persisted.bestCleanShots;
    const prevBestMult = this.state
      ? Math.max(persisted.bestMultiplier, this.state.bestMultiplier)
      : persisted.bestMultiplier;

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
      bestCleanShots: prevBestClean,
      bestMultiplier: prevBestMult,
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