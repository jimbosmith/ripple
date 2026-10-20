export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type FailureReason = 'edge_contact' | 'hoop_timeout' | null;

export interface Vec2 {
  x: number;
  y: number;
}

export interface WakePoint {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speed: number;
  cleanGlow: number;
}

export interface PuckState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** 2.5D visual tilt X/Y induced by wave passage and acceleration */
  tiltX: number;
  tiltY: number;
  tiltVx: number;
  tiltVy: number;
  /** Vertical buoyancy bob offset [-1..1] */
  bobZ: number;
  bobVz: number;
  /** Recent wake trail points in pool coordinates */
  wake: WakePoint[];
  /** Closest distance to the pool rim during the current edge-approach (for recovery detection) */
  minRimDistDuringApproach: number;
  /** Whether the puck was recently heading dangerously fast toward the rim */
  inEdgeDanger: boolean;
  /** Time since last wave impact (seconds) */
  timeSinceHit: number;
  /** Intensity of the last wave hit for rim glow feedback [0..1.5] */
  lastHitIntensity: number;
}

export interface RippleWave {
  id: number;
  x: number;
  y: number;
  age: number;
  duration: number;
  currentRadius: number;
  prevRadius: number;
  maxRadius: number;
  waveSpeed: number;
  hasImpactedPuck: boolean;
  impactStrength: number;
  isCloseHardHit: boolean;
  impactPoint: Vec2 | null;
}

export interface GhostTapFeedback {
  x: number;
  y: number;
  age: number;
  duration: number;
  reason: 'ripple_active' | 'on_puck' | 'outside_pool';
}

export interface HoopTarget {
  id: number;
  index: number;
  x: number;
  y: number;
  /** Outer pass-through radius of the illuminated hoop */
  radius: number;
  /** Inner bullseye radius for a Clean Shot (+multiplier, glassy chime, flash) */
  cleanRadius: number;
  /** Total countdown seconds allotted for this hoop */
  maxTimer: number;
  /** Remaining countdown seconds */
  timer: number;
  /** Spawn fade-in animation [0..1] */
  spawnAnim: number;
  /** Whether countdown has started (on Hoop #1, starts after first tap or after brief grace) */
  timerActive: boolean;
}

export interface ClearedHoopEffect {
  x: number;
  y: number;
  radius: number;
  cleanRadius: number;
  isClean: boolean;
  multiplier: number;
  pointsAwarded: number;
  age: number;
  duration: number;
}

export interface WaterParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  maxAge: number;
  color: string;
  alpha: number;
}

export interface FloatingCallout {
  id: number;
  text: string;
  subtext?: string;
  x: number;
  y: number;
  age: number;
  duration: number;
  kind: 'clean' | 'normal' | 'recovery' | 'warning' | 'info';
}

export interface RippleConfig {
  /** Logical radius of the circular pool basin */
  poolRadius: number;
  /** Radius of the floating puck */
  puckRadius: number;
  /** Minimum distance from puck center required to tap (you never touch the puck itself) */
  puckTapExclusionRadius: number;
  /** Crucial rule: only one ripple can exist at a time (~0.50s commitment) */
  rippleDurationSec: number;
  /** Initial radius of a newly tapped ripple */
  rippleInitialRadius: number;
  /** Expansion speed of the circular ripple wavefront (pool units / sec) */
  waveSpeed: number;
  /** Base outward impulse velocity imparted to the puck (pool units / sec) */
  baseWaveImpulse: number;
  /** Extra impulse multiplier when tapping close to the puck (within closeTapRadius) */
  closeTapBoostRatio: number;
  /** Distance threshold from puck center within which the close-tap power boost applies */
  closeTapRadius: number;
  /** Minimum fraction of baseWaveImpulse at the outer edge of the ripple's reach */
  minDistanceImpulseRatio: number;
  /** Extra opposing-velocity absorption when a wave hits the puck head-on (braking assist) */
  headOnBrakingFactor: number;
  /** Linear hydrodynamic water damping (1/s) */
  linearWaterDrag: number;
  /** Quadratic hydrodynamic drag for high speeds */
  quadraticWaterDrag: number;
  /** Maximum puck speed clamp (pool units / sec) */
  maxPuckSpeed: number;
  /** Starting hoop radius (Hoop 1) */
  initialHoopRadius: number;
  /** Minimum hoop radius at high hoop counts */
  minHoopRadius: number;
  /** Rate at which hoop radius tightens per hoop cleared */
  hoopRadiusTightenRate: number;
  /** Fraction of hoop radius that counts as the "centre" for a Clean Shot [0..1] */
  cleanShotCenterRatio: number;
  /** Starting countdown duration for Hoop 1 (seconds) */
  initialHoopCountdownSec: number;
  /** Minimum base countdown at high hoop counts (seconds) */
  minHoopCountdownSec: number;
  /** Countdown reduction rate per hoop cleared */
  countdownTightenRate: number;
  /** Rim distance threshold for triggering an "Edge Recovery" save callout */
  edgeDangerMargin: number;
}

export interface RunTelemetry {
  tapsTotal: number;
  tapsBlockedByActiveRipple: number;
  tapsBlockedOnPuck: number;
  hoopsCleared: number;
  cleanShots: number;
  maxMultiplier: number;
  recoveries: number;
  lastWaveTravelMs: number;
  lastImpactSpeedDelta: number;
  lastMissDiagnostic: string;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  bestScore: number;
  bestHoops: number;
  bestCleanShots: number;
  bestMultiplier: number;
  multiplier: number;
  cleanStreak: number;
  hoopsCleared: number;
  runTimeSec: number;
  puck: PuckState;
  activeRipple: RippleWave | null;
  currentHoop: HoopTarget;
  nextHoopPreview: Vec2;
  clearedEffects: ClearedHoopEffect[];
  ghostTaps: GhostTapFeedback[];
  particles: WaterParticle[];
  callouts: FloatingCallout[];
  failureReason: FailureReason;
  failureDiagnostic: string;
  failureFreezeTimer: number;
  telemetry: RunTelemetry;
  seed: number;
}
