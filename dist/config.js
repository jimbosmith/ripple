                                               

export const DEFAULT_CONFIG               = {
  poolRadius: 320,
  puckRadius: 16,
  puckTapExclusionRadius: 24,
  rippleDurationSec: 0.50,
  rippleInitialRadius: 6,
  waveSpeed: 495,
  baseWaveImpulse: 285,
  closeTapBoostRatio: 0.38,
  closeTapRadius: 96,
  minDistanceImpulseRatio: 0.28,
  headOnBrakingFactor: 0.42,
  linearWaterDrag: 0.56,
  quadraticWaterDrag: 0.00115,
  maxPuckSpeed: 580,
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