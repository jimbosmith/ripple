import test from 'node:test';
import assert from 'node:assert/strict';
import { RippleGame } from '../src/game.ts';
import { computeHoopCountdown, computeHoopRadius } from '../src/hoops.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { buildShareMessage, buildShareSnapshot, SHARE_GAME_URL } from '../src/share.ts';

test('1. You never touch the puck itself — direct taps on the puck are rejected', () => {
  const game = new RippleGame(101);
  game.startRun(101);

  const puckX = game.state.puck.x;
  const puckY = game.state.puck.y;

  // Tap directly on the puck center
  const events = game.handlePoolTap({ x: puckX, y: puckY });
  assert.equal(events.tapAccepted, false);
  assert.equal(events.tapRejectedReason, 'on_puck');
  assert.equal(game.state.activeRipple, null);
  assert.equal(game.state.telemetry.tapsBlockedOnPuck, 1);
});

test('2. Crucial rule: only one ripple can exist at a time (~0.5s commitment)', () => {
  const game = new RippleGame(102);
  game.startRun(102);

  // First valid water tap to the left of the puck
  const tap1 = game.handlePoolTap({ x: game.state.puck.x - 60, y: game.state.puck.y });
  assert.equal(tap1.tapAccepted, true);
  assert.notEqual(game.state.activeRipple, null);
  assert.equal(game.state.activeRipple?.duration, 0.5);

  // Step 0.20s (still inside the 0.50s commitment window)
  game.step(0.20);
  assert.notEqual(game.state.activeRipple, null);

  // Second tap during commitment must be rejected
  const tap2 = game.handlePoolTap({ x: game.state.puck.x + 60, y: game.state.puck.y });
  assert.equal(tap2.tapAccepted, false);
  assert.equal(tap2.tapRejectedReason, 'ripple_active');
  assert.equal(game.state.telemetry.tapsBlockedByActiveRipple, 1);

  // Advance past the remaining 0.31s so the first ripple expires
  game.step(0.32);
  assert.equal(game.state.activeRipple, null);

  // Now a new tap is accepted immediately
  const tap3 = game.handlePoolTap({ x: game.state.puck.x - 55, y: game.state.puck.y });
  assert.equal(tap3.tapAccepted, true);
  assert.notEqual(game.state.activeRipple, null);
});

test('3. Directional wave-push physics: tap left -> moves right, tap behind -> accelerates, tap ahead -> brakes', () => {
  const game = new RippleGame(103);
  game.startRun(103);

  // Place puck on the left side at rest so two strong pushes have plenty of pool runway
  game.state.puck.x = -140;
  game.state.puck.y = 0;
  game.state.puck.vx = 0;
  game.state.puck.vy = 0;
  // Move hoop away so we test pure kinematics
  game.state.currentHoop.x = 0;
  game.state.currentHoop.y = -220;

  // A) Tap to its left (-205, 0) -> wave travels to puck and pushes it right (+x)
  const tapLeft = game.handlePoolTap({ x: -205, y: 0 });
  assert.equal(tapLeft.tapAccepted, true);

  // Immediately after tap (before wave arrives), puck is still at rest
  game.step(0.02);
  assert.equal(game.state.puck.vx, 0);

  // Step until ripple finishes (0.52s)
  game.step(0.50);
  assert.ok(game.state.puck.vx > 80, `Expected puck to move right (+vx), got vx=${game.state.puck.vx}`);
  assert.ok(Math.abs(game.state.puck.vy) < 1e-4);

  const speedAfterFirstPush = game.state.puck.vx;

  // B) Tap slightly behind the moving puck to accelerate it
  const tapBehind = game.handlePoolTap({
    x: game.state.puck.x - 42,
    y: game.state.puck.y
  });
  assert.equal(tapBehind.tapAccepted, true);
  // Step until wave hits puck
  for (let i = 0; i < 20; i++) {
    const ev = game.step(0.015);
    if (ev.waveImpactedPuck) break;
  }
  assert.ok(
    game.state.puck.vx > speedAfterFirstPush,
    `Expected tap behind moving puck to accelerate it (${game.state.puck.vx} > ${speedAfterFirstPush})`
  );

  // Expire current ripple
  game.step(0.50);
  const speedBeforeBrake = game.state.puck.vx;
  assert.ok(speedBeforeBrake > 60);

  // C) Tap ahead of the moving puck to brake it
  const tapAhead = game.handlePoolTap({
    x: game.state.puck.x + 52,
    y: game.state.puck.y
  });
  assert.equal(tapAhead.tapAccepted, true);
  for (let i = 0; i < 20; i++) {
    const ev = game.step(0.015);
    if (ev.waveImpactedPuck) break;
  }
  assert.ok(
    game.state.puck.vx < speedBeforeBrake * 0.4,
    `Expected tap ahead to brake puck (${game.state.puck.vx} < ${speedBeforeBrake * 0.4})`
  );
});

test('4. Clean Shots vs off-center hoop passage, multiplier streak, and next hoop spawning elsewhere', () => {
  const game = new RippleGame(104);
  game.startRun(104);

  const firstHoopPos = { x: game.state.currentHoop.x, y: game.state.currentHoop.y };

  // Tap directly behind the puck (0, 68) -> pushes puck straight up through center of Hoop #1 (0, -96)
  const tap = game.handlePoolTap({ x: 0, y: 105 });
  assert.equal(tap.tapAccepted, true);

  let clearedClean = false;
  for (let i = 0; i < 90; i++) {
    const ev = game.step(1 / 60);
    if (ev.hoopCleared) {
      clearedClean = ev.cleanShot;
      break;
    }
  }

  assert.equal(game.state.hoopsCleared, 1);
  assert.equal(clearedClean, true, 'Passing dead-center through hoop #1 must trigger a Clean Shot');
  assert.equal(game.state.multiplier, 2, 'Clean Shot must increment score multiplier to x2');
  assert.ok(game.state.score >= 300);

  // Verify the next hoop appeared elsewhere
  const secondHoopPos = { x: game.state.currentHoop.x, y: game.state.currentHoop.y };
  const hoopShiftDist = Math.hypot(
    secondHoopPos.x - firstHoopPos.x,
    secondHoopPos.y - firstHoopPos.y
  );
  assert.ok(hoopShiftDist > 100, `Next hoop must spawn elsewhere (moved ${hoopShiftDist}px)`);
});

test('5. Progressive difficulty: hoops tighten and countdowns shorten over sequence', () => {
  const r0 = computeHoopRadius(0, DEFAULT_CONFIG);
  const r5 = computeHoopRadius(5, DEFAULT_CONFIG);
  const r15 = computeHoopRadius(15, DEFAULT_CONFIG);

  assert.ok(r0 > r5 && r5 > r15, `Expected hoop radii to tighten: ${r0} > ${r5} > ${r15}`);
  assert.ok(r15 >= DEFAULT_CONFIG.minHoopRadius);

  const t0 = computeHoopCountdown(0, 200, DEFAULT_CONFIG);
  const t5 = computeHoopCountdown(5, 200, DEFAULT_CONFIG);
  const t15 = computeHoopCountdown(15, 200, DEFAULT_CONFIG);

  assert.ok(t0 > t5 && t5 > t15, `Expected hoop countdowns to shorten: ${t0} > ${t5} > ${t15}`);
});

test('6. Failure conditions (edge contact & countdown timeout) and instant one-tap restart', () => {
  const game = new RippleGame(106);
  game.startRun(106);

  // A) Edge contact failure
  game.state.puck.x = 0;
  game.state.puck.y = game.config.poolRadius - game.config.puckRadius - 5;
  game.state.puck.vx = 0;
  game.state.puck.vy = 120;

  const evEdge = game.step(0.1);
  assert.equal(evEdge.runFailed, true);
  assert.equal(game.state.phase, 'gameover');
  assert.equal(game.state.failureReason, 'edge_contact');
  assert.ok(game.state.failureDiagnostic.length > 0);

  // Wait past brief 0.18s death freeze timer, then verify ONE TAP restarts immediately
  game.step(0.20);
  game.handlePoolTap({ x: 20, y: 20 });
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.hoopsCleared, 0);

  // B) Hoop countdown expiration failure
  game.state.currentHoop.timerActive = true;
  game.state.currentHoop.timer = 0.05;
  const evTimeout = game.step(0.10);
  assert.equal(evTimeout.runFailed, true);
  assert.equal(game.state.phase, 'gameover');
  assert.equal(game.state.failureReason, 'hoop_timeout');
});

test('7. Edge Recovery: a counter-ripple near the pool rim saves a fast-approaching puck', () => {
  const game = new RippleGame(107);
  game.startRun(107);

  // Move hoop out of the way
  game.state.currentHoop.x = -180;
  game.state.currentHoop.y = -180;

  // Place puck near the right rim heading fast toward the edge
  game.state.puck.x = game.config.poolRadius - game.config.puckRadius - 32;
  game.state.puck.y = 0;
  game.state.puck.vx = 110;
  game.state.puck.vy = 0;

  // Step briefly so edge danger is registered
  game.step(0.02);
  assert.equal(game.state.puck.inEdgeDanger, true);

  // Place a counter-ripple right between the puck and the right edge
  const tapSave = game.handlePoolTap({ x: game.config.poolRadius - 6, y: 0 });
  assert.equal(tapSave.tapAccepted, true);

  let recovered = false;
  for (let i = 0; i < 40; i++) {
    const ev = game.step(0.015);
    if (ev.edgeRecovery) {
      recovered = true;
      break;
    }
  }

  assert.equal(recovered, true, 'Counter-ripple near rim must trigger an Edge Recovery save');
  assert.equal(game.state.phase, 'playing');
  assert.ok(game.state.puck.vx < 0, 'Puck should now be moving safely away from the right edge');
  assert.equal(game.state.telemetry.recoveries, 1);
});

test('8. Close-range power boost: tapping close to the puck hits it harder than a mid-range tap', () => {
  const closeGame = new RippleGame(108);
  closeGame.startRun(108);
  closeGame.state.puck.x = 0;
  closeGame.state.puck.y = 0;
  closeGame.state.currentHoop.y = -240;

  // Tap 30px to the left of the puck (just outside the 24px exclusion radius)
  const tapClose = closeGame.handlePoolTap({ x: -30, y: 0 });
  assert.equal(tapClose.tapAccepted, true);
  assert.equal(closeGame.state.activeRipple?.isCloseHardHit, true);

  for (let i = 0; i < 20; i++) {
    const ev = closeGame.step(0.01);
    if (ev.waveImpactedPuck) break;
  }
  const closeImpactDelta = closeGame.state.telemetry.lastImpactSpeedDelta;

  // Compare against a mid-range tap at 120px from the puck
  const midGame = new RippleGame(108);
  midGame.startRun(108);
  midGame.state.puck.x = 0;
  midGame.state.puck.y = 0;
  midGame.state.currentHoop.y = -240;

  const tapMid = midGame.handlePoolTap({ x: -120, y: 0 });
  assert.equal(tapMid.tapAccepted, true);
  for (let i = 0; i < 40; i++) {
    const ev = midGame.step(0.01);
    if (ev.waveImpactedPuck) break;
  }
  const midImpactDelta = midGame.state.telemetry.lastImpactSpeedDelta;

  assert.ok(
    closeImpactDelta > midImpactDelta * 1.45,
    `Expected close tap impact (${closeImpactDelta}) to hit much harder than mid tap (${midImpactDelta})`
  );
  assert.ok(closeImpactDelta >= 350, `Expected close tap delta >= 350 px/s, got ${closeImpactDelta}`);
});

test('9. Share score message includes score achieved, hoops, and shareable game link', () => {
  const game = new RippleGame(109);
  game.startRun(109);
  game.state.score = 1250;
  game.state.bestScore = 1250;
  game.state.hoopsCleared = 6;
  game.state.telemetry.cleanShots = 4;
  game.state.telemetry.maxMultiplier = 4;

  const snap = buildShareSnapshot(game.state);
  assert.equal(snap.score, 1250);
  assert.equal(snap.hoops, 6);
  assert.equal(snap.cleanShots, 4);
  assert.equal(snap.isPersonalBest, true);

  const msg = buildShareMessage(snap);
  assert.ok(msg.includes('1,250'), 'Share message must display formatted score');
  assert.ok(msg.includes('6 Hoops'), 'Share message must include hoops count');
  assert.ok(msg.includes(SHARE_GAME_URL), 'Share message must include the playable game URL');
});


