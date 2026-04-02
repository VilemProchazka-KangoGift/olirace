import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioManager } from '../game/audio';
import sundayDrive from '../data/tracks/sunday-drive';
import mudRunner from '../data/tracks/mud-runner';
import lavaGauntlet from '../data/tracks/lava-gauntlet';
import pinballAlley from '../data/tracks/pinball-alley';
import devilsHighway from '../data/tracks/devils-highway';
import skyBridge from '../data/tracks/sky-bridge';
import type { TrackData } from '../types';

interface Props {
  onSelect: (trackId: string) => void;
  onBack: () => void;
}

interface TrackMeta {
  id: string;
  nameKey: string;
  difficulty: 'easy' | 'medium' | 'hard';
  data: TrackData;
}

const tracks: TrackMeta[] = [
  { id: 'sunday-drive', nameKey: 'track_sunday_drive', difficulty: 'easy', data: sundayDrive },
  { id: 'mud-runner', nameKey: 'track_mud_runner', difficulty: 'easy', data: mudRunner },
  { id: 'lava-gauntlet', nameKey: 'track_lava_gauntlet', difficulty: 'medium', data: lavaGauntlet },
  { id: 'pinball-alley', nameKey: 'track_pinball_alley', difficulty: 'medium', data: pinballAlley },
  { id: 'devils-highway', nameKey: 'track_devils_highway', difficulty: 'hard', data: devilsHighway },
  { id: 'sky-bridge', nameKey: 'track_sky_bridge', difficulty: 'hard', data: skyBridge },
];

const diffColors: Record<string, string> = {
  easy: '#40d060',
  medium: '#e8c020',
  hard: '#e83030',
};

const diffKeys: Record<string, string> = {
  easy: 'difficulty_easy',
  medium: 'difficulty_medium',
  hard: 'difficulty_hard',
};

const keyframesStyle = `
@keyframes pop-in {
  0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
  50%  { transform: scale(1.15) rotate(3deg); }
  70%  { transform: scale(0.92) rotate(-2deg); }
  85%  { transform: scale(1.04) rotate(0.5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes wiggle {
  0%, 100% { transform: rotate(-2deg) scale(1.04); }
  25%  { transform: rotate(2deg) scale(1.06); }
  50%  { transform: rotate(-1.5deg) scale(1.04); }
  75%  { transform: rotate(1.5deg) scale(1.05); }
}
@keyframes title-drop {
  0%   { transform: translateY(-50px) rotate(-5deg) scale(0.3); opacity: 0; }
  40%  { transform: translateY(6px) rotate(2deg) scale(1.08); }
  60%  { transform: translateY(-3px) rotate(-1deg) scale(0.97); }
  100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes path-draw {
  0%   { stroke-dashoffset: 1000; }
  100% { stroke-dashoffset: 0; }
}
`;

function MiniTrackPreview({ road, color, active }: { road: TrackData['road']; color: string; active: boolean }) {
  if (road.length < 2) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of road) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const padding = 10;
  const svgW = 136;
  const svgH = 86;
  const scaleX = (svgW - padding * 2) / rangeX;
  const scaleY = (svgH - padding * 2) / rangeY;
  const s = Math.min(scaleX, scaleY);
  const offX = padding + ((svgW - padding * 2) - rangeX * s) / 2;
  const offY = padding + ((svgH - padding * 2) - rangeY * s) / 2;

  const step = Math.max(1, Math.floor(road.length / 60));
  const points = road
    .filter((_, i) => i % step === 0 || i === road.length - 1)
    .map((p) => `${offX + (p.x - minX) * s},${offY + (p.y - minY) * s}`)
    .join(' ');

  const startX = offX + (road[0].x - minX) * s;
  const startY = offY + (road[0].y - minY) * s;
  const endX = offX + (road[road.length - 1].x - minX) * s;
  const endY = offY + (road[road.length - 1].y - minY) * s;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      {/* Track glow */}
      {active && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
        />
      )}
      {/* Track path */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 0.9 : 0.5}
        strokeDasharray={active ? '1000' : 'none'}
        style={active ? { animation: 'path-draw 1.5s ease-out both' } : undefined}
      />
      {/* Start — green circle */}
      <circle cx={startX} cy={startY} r="4" fill="#40e080" />
      <circle cx={startX} cy={startY} r="2" fill="white" opacity="0.6" />
      {/* Finish — checkered flag */}
      <rect x={endX - 3.5} y={endY - 3.5} width="7" height="7" rx="1" fill="#e8e8f0" />
      <rect x={endX - 3.5} y={endY - 3.5} width="3.5" height="3.5" fill="#2a2a3a" />
      <rect x={endX} y={endY} width="3.5" height="3.5" fill="#2a2a3a" />
    </svg>
  );
}

export default function TrackSelect({ onSelect, onBack }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(0);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setSelected((s) => (s - 1 + tracks.length) % tracks.length);
        audioManager.play('sfx_menu_move');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setSelected((s) => (s + 1) % tracks.length);
        audioManager.play('sfx_menu_move');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        audioManager.play('sfx_menu_confirm');
        onSelect(tracks[selected].id);
      } else if (e.key === 'Escape') {
        onBack();
      }
    },
    [onSelect, onBack, selected],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Press Start 2P', monospace",
      color: '#e8e8f0',
      background: 'radial-gradient(ellipse at 50% 30%, #2a1a3e 0%, #1a1228 40%, #0e0a18 100%)',
      gap: 24,
      padding: 20,
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      <style>{keyframesStyle}</style>

      {/* Title */}
      <div style={{
        fontSize: 20,
        color: '#ffb040',
        textShadow: '0 4px 0 #8a3000, 0 0 20px #ff602080, -2px -2px 0 #c05010, 2px -2px 0 #c05010',
        animation: 'title-drop 0.7s ease-out both',
        textAlign: 'center',
        letterSpacing: 2,
      }}>
        {t('track_select')}
      </div>

      {/* Track cards */}
      <div style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        flexWrap: 'wrap',
        maxWidth: '100%',
      }}>
        {tracks.map((track, i) => {
          const isActive = selected === i;
          const diff = track.difficulty;
          const glowColor = diffColors[diff];
          return (
            <button
              key={track.id}
              onClick={() => { audioManager.play('sfx_menu_confirm'); setSelected(i); onSelect(track.id); }}
              onMouseEnter={() => { audioManager.play('sfx_menu_move'); setSelected(i); }}
              style={{
                width: 168,
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 12,
                background: isActive
                  ? `radial-gradient(ellipse at 50% 30%, ${glowColor}18 0%, #1a1228 100%)`
                  : 'radial-gradient(ellipse at 50% 40%, #22203a 0%, #14121e 100%)',
                border: 'none',
                borderRadius: 22,
                cursor: 'pointer',
                fontFamily: "'Press Start 2P', monospace",
                color: '#e8e8f0',
                animation: `pop-in 0.5s ease-out ${i * 0.08}s both${isActive ? ', wiggle 1.5s ease-in-out infinite' : ''}`,
                boxShadow: isActive
                  ? `0 6px 24px ${glowColor}50, 0 0 0 4px ${glowColor}, inset 0 -4px 0 ${glowColor}25`
                  : '0 4px 12px #00000060, 0 0 0 3px #2a283a, inset 0 -4px 0 #0e0c16',
              }}
            >
              {/* Preview area */}
              <div style={{
                width: 144,
                height: 90,
                background: '#0a0a14',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 2px 6px #00000060',
                overflow: 'hidden',
              }}>
                <MiniTrackPreview road={track.data.road} color={glowColor} active={isActive} />
              </div>

              {/* Track name */}
              <div style={{
                fontSize: 9,
                textAlign: 'center',
                lineHeight: '1.6',
                minHeight: 30,
                color: isActive ? '#e8e8f0' : '#7a7a90',
              }}>
                {t(track.nameKey)}
              </div>

              {/* Difficulty badge */}
              <div style={{
                fontSize: 7,
                padding: '4px 12px',
                borderRadius: 10,
                background: `${glowColor}20`,
                color: glowColor,
                border: `2px solid ${glowColor}50`,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>
                {t(diffKeys[diff])}
              </div>
            </button>
          );
        })}
      </div>

      {/* Back button */}
      <button
        style={{
          fontSize: 8,
          padding: '8px 20px',
          background: 'transparent',
          color: '#5a5a70',
          border: '2px solid #3a3050',
          borderRadius: 14,
          fontFamily: "'Press Start 2P', monospace",
          cursor: 'pointer',
        }}
        onClick={onBack}
      >
        Esc
      </button>
    </div>
  );
}
