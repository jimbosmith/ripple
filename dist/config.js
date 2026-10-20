                                               

export const DEFAULT_CONFIG               = {
  poolRadius: 320,
  puckRadius: 16,
  puckTapExclusionRadius: 24,
  rippleDurationSec: 0.50,
  rippleInitialRadius: 6,
  waveSpeed: 490,
  baseWaveImpulse: 255,
  minDistanceImpulseRatio: 0.30,
  headOnBrakingFactor: 0.38,
  linearWaterDrag: 0.58,
  quadraticWaterDrag: 0.0012,
  maxPuckSpeed: 540,
  initialHoopRadius: 54,
  minHoopRadius: 27,
  hoopRadiusTightenRate: 0.055,
  cleanShotCenterRatio: 0.42,
  initialHoopCountdownSec: 7.5,
  minHoopCountdownSec: 3.1,
  countdownTightenRate: 0.065,
  edgeDangerMargin: 44
};

export function cloneConfig(cfg               = DEFAULT_CONFIG)               {
  return { ...cfg };
}


//# sourceURL=config.ts