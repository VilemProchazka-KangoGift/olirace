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
  easy: '#00c040',
  medium: '#e0c000',
  hard: '#e02020',
};

const diffKeys: Record<string, string> = {
  easy: 'difficulty_easy',
  medium: 'difficulty_medium',
  hard: 'difficulty_hard',
};

const keyframesStyle = `
@keyframes card-enter {
  0%   { transform: translateY(30px) scale(0.95); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes glow-border {
  0%, 100% { box-shadow: 0 0 12px var(--glow-color), inset 0 0 0 3px var(--glow-color); }
  50%      { box-shadow: 0 0 28px var(--glow-color), 0 0 50px rgba(224, 96, 16, 0.3), inset 0 0 0 3px var(--glow-color); }
}
@keyframes header-slide {
  0%   { transform: translateY(-20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
`;

function MiniTrackPreview({ road, color }: { road: TrackData['road']; color: string }) {
  if (road.length < 2) return null;

  // Find bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of road) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const padding = 8;
  const svgW = 130;
  const svgH = 80;
  const scaleX = (svgW - padding * 2) / rangeX;
  const scaleY = (svgH - padding * 2) / rangeY;
  const s = Math.min(scaleX, scaleY);
  const offX = padding + ((svgW - padding * 2) - rangeX * s) / 2;
  const offY = padding + ((svgH - padding * 2) - rangeY * s) / 2;

  // Sample every Nth point for a cleaner preview
  const step = Math.max(1, Math.floor(road.length / 60));
  const points = road
    .filter((_, i) => i % step === 0 || i === road.length - 1)
    .map((p) => `${offX + (p.x - minX) * s},${offY + (p.y - minY) * s}`)
    .join(' ');

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Start marker */}
      <circle
        cx={offX + (road[0].x - minX) * s}
        cy={offY + (road[0].y - minY) * s}
        r="3"
        fill="#00e0e0"
      />
      {/* Finish marker */}
      <rect
        x={offX + (road[road.length - 1].x - minX) * s - 2.5}
        y={offY + (road[road.length - 1].y - minY) * s - 2.5}
        width="5"
        height="5"
        fill="#e8e8f0"
      />
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

  const container: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    color: '#e8e8f0',
    background: 'linear-gradient(180deg, #1a1a2e 0%, #2a1515 100%)',
    gap: 32,
    padding: 20,
    userSelect: 'none',
  };

  const header: React.CSSProperties = {
    fontSize: 18,
    color: '#ff8020',
    textShadow: '0 0 10px #e06010',
    animation: 'header-slide 0.5s ease-out both',
    textAlign: 'center',
  };

  const cardsRow: React.CSSProperties = {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
    maxWidth: '100%',
  };

  function makeCardStyle(index: number): React.CSSProperties {
    const isActive = selected === index;
    const diff = tracks[index].difficulty;
    const glowColor = diffColors[diff];
    return {
      width: 170,
      minHeight: 240,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      background: isActive
        ? `linear-gradient(180deg, ${glowColor}15 0%, #1a1a2e 100%)`
        : 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2e 100%)',
      border: 'none',
      cursor: 'pointer',
      fontFamily: "'Press Start 2P', monospace",
      color: '#e8e8f0',
      animation: `card-enter 0.4s ease-out ${index * 0.12}s both${isActive ? ', glow-border 1.5s ease infinite' : ''}`,
      boxShadow: isActive
        ? `0 0 20px ${glowColor}, inset 0 0 0 3px ${glowColor}`
        : 'inset 0 0 0 3px #3a3a4a',
      transition: 'background 0.2s',
      // @ts-expect-error CSS custom property
      '--glow-color': glowColor,
    };
  }

  const nameStyle: React.CSSProperties = {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: '1.6',
    minHeight: 32,
  };

  function badgeStyle(diff: string): React.CSSProperties {
    return {
      fontSize: 8,
      padding: '3px 8px',
      background: diffColors[diff] + '30',
      color: diffColors[diff],
      border: `1px solid ${diffColors[diff]}60`,
      textTransform: 'uppercase',
      letterSpacing: 1,
    };
  }

  const hint: React.CSSProperties = {
    fontSize: 9,
    color: '#666680',
    textAlign: 'center',
  };

  const backBtn: React.CSSProperties = {
    fontSize: 7,
    padding: '8px 16px',
    background: 'transparent',
    color: '#666680',
    border: '2px solid #3a3a4a',
    fontFamily: "'Press Start 2P', monospace",
    cursor: 'pointer',
    marginTop: 8,
  };

  return (
    <div style={container}>
      <style>{keyframesStyle}</style>
      <div style={header}>{t('track_select')}</div>

      <div style={cardsRow}>
        {tracks.map((track, i) => (
          <button
            key={track.id}
            style={makeCardStyle(i)}
            onClick={() => {
              audioManager.play('sfx_menu_confirm');
              setSelected(i);
              onSelect(track.id);
            }}
            onMouseEnter={() => { audioManager.play('sfx_menu_move'); setSelected(i); }}
          >
            <div style={{
              width: 140,
              height: 85,
              background: '#0a0a18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #2a2a3a',
            }}>
              <MiniTrackPreview road={track.data.road} color={diffColors[track.difficulty]} />
            </div>
            <div style={nameStyle}>{t(track.nameKey)}</div>
            <div style={badgeStyle(track.difficulty)}>{t(diffKeys[track.difficulty])}</div>
          </button>
        ))}
      </div>

      <div style={hint}>← → + Enter</div>
      <button style={backBtn} onClick={onBack}>
        Esc
      </button>
    </div>
  );
}
