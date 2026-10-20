import { RippleGame } from './game.js?v=3';
import { PoolRenderer } from './renderer.js?v=3';
import { SoundAndHaptics } from './audio.js?v=3';
import { DevPanel } from './devPanel.js?v=3';
import {
  buildShareMessage,
  buildShareSnapshot,
  renderShareScoreCard,
  SHARE_GAME_URL
} from './share.js?v=3';
                                               

function parseSeedFromUrl()         {
  if (typeof window === 'undefined') return 20261020;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) return parsed >>> 0;
  }
  return (Date.now() & 0xffffffff) >>> 0;
}

export function initApp()       {
  const canvas = document.getElementById('game-canvas')                            ;
  if (!canvas) return;

  const game = new RippleGame(parseSeedFromUrl());
  const renderer = new PoolRenderer(canvas);
  const audio = new SoundAndHaptics();

  const devContainer = document.getElementById('dev-panel');
  const devPanel = devContainer ? new DevPanel(devContainer, game) : null;

  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1' && devPanel) {
    devPanel.toggle(true);
  }

  let reducedMotion = false;
  let shareModalOpen = false;
  let pausedByShare = false;

  // HUD DOM elements
  const hudScore = document.getElementById('hud-score');
  const hudMultiplier = document.getElementById('hud-multiplier');
  const hudHoops = document.getElementById('hud-hoops');
  const hudBest = document.getElementById('hud-best');

  const rippleStatusPill = document.getElementById('ripple-status-pill');
  const rippleStatusText = document.getElementById('ripple-status-text');
  const rippleFillBar = document.getElementById('ripple-cooldown-fill')                      ;

  const modalTitle = document.getElementById('modal-title');
  const modalPause = document.getElementById('modal-pause');
  const modalGameover = document.getElementById('modal-gameover');
  const modalShare = document.getElementById('modal-share');

  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverReason = document.getElementById('gameover-reason');
  const finalScore = document.getElementById('final-score');
  const finalHoops = document.getElementById('final-hoops');
  const finalClean = document.getElementById('final-clean');
  const finalBest = document.getElementById('final-best');

  const shareCardCanvas = document.getElementById('share-card-canvas')                            ;
  const shareTextPreview = document.getElementById('share-text-preview');
  const shareToast = document.getElementById('share-toast');

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnRestartPause = document.getElementById('btn-restart-pause');
  const btnRetry = document.getElementById('btn-retry');
  const btnShareHud = document.getElementById('btn-share-hud');
  const btnShareGameover = document.getElementById('btn-share-gameover');
  const btnShareCopy = document.getElementById('btn-share-copy');
  const btnShareNative = document.getElementById('btn-share-native');
  const btnShareDownload = document.getElementById('btn-share-download');
  const btnShareClose = document.getElementById('btn-share-close');
  const btnMute = document.getElementById('btn-mute');
  const btnHaptics = document.getElementById('btn-haptics');
  const btnMotion = document.getElementById('btn-motion');
  const btnDev = document.getElementById('btn-dev');

  function showShareFeedback(msg        )       {
    if (!shareToast) return;
    shareToast.textContent = msg;
    shareToast.hidden = false;
    window.setTimeout(() => {
      shareToast.hidden = true;
    }, 2400);
  }

  function openShareModal()       {
    if (game.state.phase === 'playing') {
      game.togglePause();
      pausedByShare = true;
    } else {
      pausedByShare = false;
    }
    shareModalOpen = true;
    if (shareCardCanvas) {
      const snap = renderShareScoreCard(shareCardCanvas, game.state);
      if (shareTextPreview) {
        shareTextPreview.textContent = buildShareMessage(snap);
      }
    }
    syncUI();
  }

  function closeShareModal()       {
    shareModalOpen = false;
    if (pausedByShare && game.state.phase === 'paused') {
      game.togglePause();
    }
    pausedByShare = false;
    syncUI();
  }

  async function copyShareToClipboard()                {
    const snap = buildShareSnapshot(game.state);
    const message = buildShareMessage(snap);
    try {
      await navigator.clipboard.writeText(message);
      audio.playHoopCleared(true, 3);
      showShareFeedback('Copied score & game link to clipboard! ✨');
    } catch {
      showShareFeedback(`Share link: ${SHARE_GAME_URL}`);
    }
  }

  async function triggerNativeShare()                {
    const snap = buildShareSnapshot(game.state);
    const message = buildShareMessage(snap);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (shareCardCanvas) {
          const blob = await new Promise             ((resolve) =>
            shareCardCanvas.toBlob((b) => resolve(b), 'image/png')
          );
          if (blob) {
            const file = new File([blob], 'ripple-score.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: `Ripple — ${snap.score.toLocaleString()} pts`,
                text: message,
                url: SHARE_GAME_URL,
                files: [file]
              });
              showShareFeedback('Shared score card! ✨');
              return;
            }
          }
        }
        await navigator.share({
          title: `Ripple — ${snap.score.toLocaleString()} pts`,
          text: message,
          url: SHARE_GAME_URL
        });
        showShareFeedback('Shared score & link! ✨');
        return;
      } catch {
        // User cancelled or share failed — fall back to clipboard copy
      }
    }

    await copyShareToClipboard();
  }

  function downloadShareCardPng()       {
    if (!shareCardCanvas) return;
    renderShareScoreCard(shareCardCanvas, game.state);
    const dataUrl = shareCardCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `ripple-score-${buildShareSnapshot(game.state).score}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    audio.playTap();
    showShareFeedback('Saved Score Card PNG! 📸');
  }

  function dispatchEventsToAudio(events            )       {
    if (events.tapAccepted) {
      audio.playTap();
    } else if (
      events.tapRejectedReason === 'ripple_active' ||
      events.tapRejectedReason === 'on_puck'
    ) {
      audio.playTapBlocked();
    }

    if (events.waveImpactedPuck) {
      audio.playWaveImpact(events.waveImpactStrength);
    }

    if (events.hoopCleared) {
      audio.playHoopCleared(events.cleanShot, events.cleanMultiplier);
    }

    if (events.edgeRecovery) {
      audio.playRecovery();
    }

    if (events.countdownTickUrgent) {
      audio.playCountdownTick();
    }

    if (events.runFailed) {
      audio.playGameOver(events.failureReason);
    }
  }

  function syncUI()       {
    const s = game.state;

    if (hudScore) hudScore.textContent = s.score.toLocaleString();
    if (hudMultiplier) {
      hudMultiplier.textContent = `×${s.multiplier}`;
      hudMultiplier.classList.toggle('multiplier-active', s.multiplier > 1);
    }
    if (hudHoops) hudHoops.textContent = String(s.hoopsCleared);
    if (hudBest) hudBest.textContent = s.bestScore.toLocaleString();

    if (rippleStatusPill && rippleStatusText && rippleFillBar) {
      if (s.activeRipple) {
        const remain = Math.max(0, s.activeRipple.duration - s.activeRipple.age);
        const pct = Math.max(0, Math.min(100, (remain / s.activeRipple.duration) * 100));
        rippleStatusPill.classList.add('is-committed');
        rippleStatusText.textContent = `WAVE COMMITTED · ${remain.toFixed(2)}s`;
        rippleFillBar.style.width = `${pct}%`;
      } else {
        rippleStatusPill.classList.remove('is-committed');
        rippleStatusText.textContent = 'WATER READY · TAP CLOSE FOR HARD PUSH';
        rippleFillBar.style.width = '100%';
      }
    }

    if (modalShare) modalShare.hidden = !shareModalOpen;
    if (modalTitle) modalTitle.hidden = shareModalOpen || s.phase !== 'title';
    if (modalPause) modalPause.hidden = shareModalOpen || s.phase !== 'paused';
    if (modalGameover) {
      const showGameOver = !shareModalOpen && s.phase === 'gameover';
      modalGameover.hidden = !showGameOver;
      if (showGameOver) {
        if (gameoverTitle) {
          gameoverTitle.textContent =
            s.failureReason === 'edge_contact'
              ? 'Touched the Pool Edge'
              : 'Hoop Countdown Expired';
        }
        if (gameoverReason) {
          gameoverReason.textContent = s.failureDiagnostic;
        }
        if (finalScore) finalScore.textContent = s.score.toLocaleString();
        if (finalHoops) finalHoops.textContent = String(s.hoopsCleared);
        if (finalClean) finalClean.textContent = String(s.telemetry.cleanShots);
        if (finalBest) finalBest.textContent = s.bestScore.toLocaleString();
      }
    }
  }

  canvas.addEventListener('pointerdown', (e              ) => {
    if (shareModalOpen) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const poolPos = renderer.clientToPool(e.clientX, e.clientY);
    const events = game.handlePoolTap(poolPos);
    dispatchEventsToAudio(events);
    syncUI();
  });

  modalGameover?.addEventListener('pointerdown', (e              ) => {
    const target = e.target                      ;
    if (target?.closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    if (game.state.failureFreezeTimer <= 0) {
      game.startRun();
      audio.playTap();
      syncUI();
    }
  });

  btnStart?.addEventListener('click', () => {
    game.startRun();
    audio.playTap();
    syncUI();
  });

  btnRetry?.addEventListener('click', (e) => {
    e.stopPropagation();
    game.startRun();
    audio.playTap();
    syncUI();
  });

  btnShareHud?.addEventListener('click', (e) => {
    e.stopPropagation();
    openShareModal();
  });

  btnShareGameover?.addEventListener('click', (e) => {
    e.stopPropagation();
    openShareModal();
  });

  btnShareCopy?.addEventListener('click', (e) => {
    e.stopPropagation();
    copyShareToClipboard();
  });

  btnShareNative?.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerNativeShare();
  });

  btnShareDownload?.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadShareCardPng();
  });

  btnShareClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeShareModal();
  });

  btnPause?.addEventListener('click', () => {
    if (shareModalOpen) {
      closeShareModal();
      return;
    }
    game.togglePause();
    syncUI();
  });

  btnResume?.addEventListener('click', () => {
    game.togglePause();
    syncUI();
  });

  btnRestartPause?.addEventListener('click', () => {
    game.startRun();
    syncUI();
  });

  btnMute?.addEventListener('click', () => {
    const nextMuted = !audio.isMuted();
    audio.setMuted(nextMuted);
    btnMute.textContent = nextMuted ? '🔇 Muted' : '🔊 Sound';
    btnMute.setAttribute('aria-pressed', String(nextMuted));
  });

  btnHaptics?.addEventListener('click', () => {
    const nextHaptics = !audio.isHapticsEnabled();
    audio.setHapticsEnabled(nextHaptics);
    btnHaptics.textContent = nextHaptics ? '📳 Haptics: On' : '📳 Haptics: Off';
    btnHaptics.setAttribute('aria-pressed', String(!nextHaptics));
  });

  btnMotion?.addEventListener('click', () => {
    reducedMotion = !reducedMotion;
    btnMotion.textContent = reducedMotion ? '✨ Motion: Reduced' : '✨ Motion: Full';
    btnMotion.setAttribute('aria-pressed', String(reducedMotion));
  });

  btnDev?.addEventListener('click', () => {
    devPanel?.toggle();
  });

  window.addEventListener('keydown', (e               ) => {
    if (e.key === 'Escape') {
      if (shareModalOpen) {
        closeShareModal();
        return;
      }
      game.togglePause();
      syncUI();
    } else if (e.key === 'd' || e.key === 'D' || e.key === '`') {
      devPanel?.toggle();
    } else if (e.key === 'r' || e.key === 'R') {
      if (shareModalOpen) closeShareModal();
      game.startRun();
      audio.playTap();
      syncUI();
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (!shareModalOpen && (game.state.phase === 'title' || game.state.phase === 'gameover')) {
        e.preventDefault();
        game.startRun();
        audio.playTap();
        syncUI();
      }
    } else if (e.key === 'p' || e.key === 'P') {
      if (!shareModalOpen) {
        game.togglePause();
        syncUI();
      }
    }
  });

  window.addEventListener('resize', () => {
    renderer.resize();
  });
  window.visualViewport?.addEventListener('resize', () => {
    renderer.resize();
  });

  let lastTime = performance.now();
  function frame(now        )       {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    const stepEvents = game.step(dt);
    dispatchEventsToAudio(stepEvents);
    audio.decayVisualHaptic(dt);

    renderer.render(game.state, game.config, dt, {
      reducedMotion,
      showDevOverlays: devPanel ? devPanel.showOverlays : false,
      visualHapticPulse: audio.visualHapticPulse
    });

    syncUI();
    devPanel?.updateTelemetry();

    requestAnimationFrame(frame);
  }

  syncUI();
  requestAnimationFrame(frame);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}


//# sourceURL=main.ts