import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameConfig, GameResults, GameState } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/constants';
import { startGame } from '../game/engine';
import { audioManager } from '../game/audio';
import sundayDrive from '../data/tracks/sunday-drive';
import lavaGauntlet from '../data/tracks/lava-gauntlet';
import devilsHighway from '../data/tracks/devils-highway';
import type { TrackData } from '../types';

interface Props {
  config: GameConfig;
  onFinish: (results: GameResults) => void;
  onQuit: () => void;
  onRestart: () => void;
}

const trackMap: Record<string, TrackData> = {
  'sunday-drive': sundayDrive,
  'lava-gauntlet': lavaGauntlet,
  'devils-highway': devilsHighway,
};

const keyframesStyle = `
@keyframes hud-fade-in {
  0%   { opacity: 0; transform: translateY(-8px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes pause-overlay-in {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes pause-menu-in {
  0%   { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes speed-needle {
  0%   { stroke-dashoffset: 157; }
}
`;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = s.toFixed(2).padStart(5, '0');
  return `${mm}:${ss}`;
}

function SpeedGauge({ speed, maxSpeed, side }: { speed: number; maxSpeed: number; side: 'left' | 'right' }) {
  const ratio = Math.min(1, speed / maxSpeed);
  const arcLength = 157; // half circumference of r=50
  const dashOffset = arcLength * (1 - ratio);

  // Color transitions: white -> cyan -> orange -> red
  let strokeColor = '#e8e8f0';
  if (ratio > 0.3) strokeColor = '#00e0e0';
  if (ratio > 0.6) strokeColor = '#e07020';
  if (ratio > 0.85) strokeColor = '#e02020';

  const style: React.CSSProperties = {
    position: 'absolute',
    bottom: 8,
    [side]: 8,
    width: 64,
    height: 36,
    animation: 'hud-fade-in 0.5s ease-out both',
    animationDelay: '1s',
  };

  return (
    <div style={style}>
      <svg width="64" height="36" viewBox="0 0 108 58">
        {/* Background arc */}
        <path
          d="M 4 54 A 50 50 0 0 1 104 54"
          fill="none"
          stroke="#2a2a3a"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Active arc */}
        <path
          d="M 4 54 A 50 50 0 0 1 104 54"
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${arcLength}`}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
        />
        {/* Speed text */}
        <text
          x="54"
          y="50"
          textAnchor="middle"
          fill={strokeColor}
          fontSize="14"
          fontFamily="'Press Start 2P', monospace"
          style={{ transition: 'fill 0.3s' }}
        >
          {Math.round(speed)}
        </text>
      </svg>
    </div>
  );
}

export default function GameScreen({ config, onFinish, onQuit, onRestart }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{ stop: () => void } | null>(null);
  const [paused, setPaused] = useState(false);
  const [pauseIndex, setPauseIndex] = useState(0);
  const [hudState, setHudState] = useState({
    raceTimer: 0,
    p1Deaths: 0,
    p2Deaths: 0,
    p1Speed: 0,
    p2Speed: 0,
    p1MaxSpeed: 200,
    p2MaxSpeed: 200,
    phase: 'countdown' as GameState['phase'],
  });

  const pauseItems = [
    { key: 'resume', label: t('resume'), action: () => setPaused(false) },
    { key: 'restart', label: t('restart'), action: onRestart },
    { key: 'quit', label: t('quit_to_title'), action: onQuit },
  ];

  // Expose game state to HUD via polling from rAF in engine
  const gameStateRef = useRef<GameState | null>(null);

  const handleFinish = useCallback(
    (results: GameResults) => {
      // Delay a bit so player sees the finish
      setTimeout(() => {
        onFinish(results);
      }, 2500);
    },
    [onFinish],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const track = trackMap[config.trackId] || sundayDrive;

    audioManager.playLoop('music_race');

    const handle = startGame(canvas, config, track, handleFinish);
    gameRef.current = handle;

    // Poll game state for HUD updates
    let hudRaf = 0;
    const pollHud = () => {
      // We access the game state through the canvas's internal data
      // For now we parse it from the rendered canvas context (the engine draws timer text)
      // Actually, let's patch in a state accessor via a custom property
      const gs = (canvas as unknown as { __gameState?: GameState }).__gameState;
      if (gs) {
        gameStateRef.current = gs;
        setHudState({
          raceTimer: gs.raceTimer,
          p1Deaths: gs.players[0]?.deaths ?? 0,
          p2Deaths: gs.players[1]?.deaths ?? 0,
          p1Speed: gs.players[0]?.speed ?? 0,
          p2Speed: gs.players[1]?.speed ?? 0,
          p1MaxSpeed: gs.players[0]?.maxSpeed ?? 200,
          p2MaxSpeed: gs.players[1]?.maxSpeed ?? 200,
          phase: gs.phase,
        });
      }
      hudRaf = requestAnimationFrame(pollHud);
    };
    hudRaf = requestAnimationFrame(pollHud);

    return () => {
      cancelAnimationFrame(hudRaf);
      handle.stop();
      audioManager.stop('music_race');
      audioManager.stop('sfx_engine');
    };
  }, [config, handleFinish]);

  // Pause handling
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPaused((p) => !p);
        setPauseIndex(0);
      }
      if (paused) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          setPauseIndex((i) => (i - 1 + pauseItems.length) % pauseItems.length);
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          setPauseIndex((i) => (i + 1) % pauseItems.length);
        } else if (e.key === 'Enter' || e.key === ' ') {
          pauseItems[pauseIndex].action();
        }
      }
    },
    [paused, pauseIndex, pauseItems],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Canvas scaling to maintain 9:16 aspect
  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    background: '#0a0a18',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const canvasStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    imageRendering: 'pixelated',
  };

  // HUD overlay
  const hudOverlay: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    fontFamily: "'Press Start 2P', monospace",
    color: '#e8e8f0',
    zIndex: 2,
  };

  // Timer (top center)
  const timerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 10,
    textShadow: '0 0 6px #000, 2px 2px 0 #000',
    animation: 'hud-fade-in 0.5s ease-out both',
    animationDelay: '0.5s',
    opacity: hudState.phase === 'countdown' ? 0.4 : 1,
    transition: 'opacity 0.3s',
  };

  // Death counter
  function deathCounter(deaths: number, side: 'left' | 'right', label: string) {
    const style: React.CSSProperties = {
      position: 'absolute',
      top: 10,
      [side]: 10,
      fontSize: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      textShadow: '0 0 4px #000, 1px 1px 0 #000',
      animation: 'hud-fade-in 0.5s ease-out both',
      animationDelay: '0.7s',
    };
    return (
      <div style={style}>
        <span style={{ fontSize: 6, color: '#666680' }}>{label}</span>
        <span style={{ color: '#e02020' }}>💀</span>
        <span>{deaths}</span>
      </div>
    );
  }

  // Pause overlay
  const pauseOverlay: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(10, 10, 24, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    fontFamily: "'Press Start 2P', monospace",
    color: '#e8e8f0',
    zIndex: 10,
    pointerEvents: 'auto',
    animation: 'pause-overlay-in 0.2s ease-out both',
  };

  const pauseTitle: React.CSSProperties = {
    fontSize: 20,
    color: '#ff8020',
    textShadow: '0 0 20px #e06010',
    animation: 'pause-menu-in 0.3s ease-out both',
  };

  function pauseButton(item: typeof pauseItems[number], index: number) {
    const isActive = index === pauseIndex;
    return (
      <button
        key={item.key}
        onClick={item.action}
        onMouseEnter={() => setPauseIndex(index)}
        style={{
          fontSize: 10,
          padding: '10px 24px',
          background: isActive ? '#3a1a0a' : 'transparent',
          color: isActive ? '#ff8020' : '#666680',
          border: 'none',
          fontFamily: "'Press Start 2P', monospace",
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: isActive ? 'inset 0 0 0 2px #ff8020' : 'inset 0 0 0 2px transparent',
          animation: `pause-menu-in 0.3s ease-out ${0.1 + index * 0.08}s both`,
          textShadow: isActive ? '0 0 8px #e06010' : 'none',
          pointerEvents: 'auto',
        }}
      >
        {isActive && (
          <span style={{ marginRight: 8, color: '#e06010' }}>▶</span>
        )}
        {item.label}
      </button>
    );
  }

  return (
    <div style={wrapperStyle}>
      <style>{keyframesStyle}</style>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={canvasStyle}
      />

      {/* HUD Overlay */}
      <div style={hudOverlay}>
        {/* Timer */}
        <div style={timerStyle}>{formatTime(hudState.raceTimer)}</div>

        {/* P1 deaths - top left */}
        {deathCounter(hudState.p1Deaths, 'left', config.playerCount === 2 ? 'P1' : '')}

        {/* P2 deaths - top right (2P only) */}
        {config.playerCount === 2 && deathCounter(hudState.p2Deaths, 'right', 'P2')}

        {/* Speed gauges */}
        <SpeedGauge speed={hudState.p1Speed} maxSpeed={hudState.p1MaxSpeed} side="left" />
        {config.playerCount === 2 && (
          <SpeedGauge speed={hudState.p2Speed} maxSpeed={hudState.p2MaxSpeed} side="right" />
        )}
      </div>

      {/* Pause overlay */}
      {paused && (
        <div style={pauseOverlay}>
          <div style={pauseTitle}>{t('paused')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pauseItems.map((item, i) => pauseButton(item, i))}
          </div>
        </div>
      )}
    </div>
  );
}
