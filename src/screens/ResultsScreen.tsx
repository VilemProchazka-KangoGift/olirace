import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameConfig, GameResults } from '../types';
import { getCharacter } from '../data/characters';
import { audioManager } from '../game/audio';

interface Props {
  results: GameResults;
  config: GameConfig;
  onRematch: () => void;
  onTrackSelect: () => void;
  onQuit: () => void;
}

const keyframesStyle = `
@keyframes confetti-fall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
@keyframes result-appear {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes trophy-bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}
@keyframes stat-slide {
  0%   { transform: translateX(-20px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes winner-glow {
  0%, 100% { text-shadow: 0 0 10px #ff8020, 0 0 20px #e06010; }
  50%      { text-shadow: 0 0 20px #ff8020, 0 0 40px #e06010, 0 0 60px #c0400a; }
}
@keyframes btn-appear {
  0%   { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
`;

function formatTime(seconds: number | null): string {
  if (seconds === null) return '--:--.--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = s.toFixed(2).padStart(5, '0');
  return `${mm}:${ss}`;
}

// Generate random confetti particles
function ConfettiBackground() {
  const particles = Array.from({ length: 35 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 4;
    const duration = 3 + Math.random() * 3;
    const size = 3 + Math.random() * 5;
    const colors = ['#e02020', '#e06010', '#ff8020', '#e0c000', '#00c040', '#00e0e0', '#2060e0', '#e080a0'];
    const color = colors[i % colors.length];
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          top: -10,
          left: `${left}%`,
          width: size,
          height: size,
          background: color,
          animation: `confetti-fall ${duration}s linear ${delay}s infinite`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  });
  return <>{particles}</>;
}

export default function ResultsScreen({ results, config, onRematch, onTrackSelect, onQuit }: Props) {
  const { t } = useTranslation();
  const [menuIndex, setMenuIndex] = useState(0);

  const menuItems = [
    { key: 'rematch', label: t('rematch'), action: onRematch },
    { key: 'track', label: t('track_select_btn'), action: onTrackSelect },
    { key: 'quit', label: t('quit_to_title'), action: onQuit },
  ];

  useEffect(() => {
    audioManager.stop('music_race');
    audioManager.playLoop('music_results');
    return () => {
      audioManager.stop('music_results');
    };
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setMenuIndex((i) => (i - 1 + menuItems.length) % menuItems.length);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setMenuIndex((i) => (i + 1) % menuItems.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        menuItems[menuIndex].action();
      } else if (e.key === 'Escape') {
        onQuit();
      }
    },
    [menuIndex, menuItems, onQuit],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const isMulti = results.playerCount >= 2;
  const hasWinner = results.winner !== null;

  let winnerText = '';
  if (isMulti && hasWinner) {
    const winnerLabels = ['P1', 'P2', 'P3', 'P4'];
    const winnerIdx = results.winner!;
    const winKey = `p${winnerIdx + 1}_wins` as any;
    winnerText = t(winKey);
  } else if (!isMulti) {
    winnerText = results.players[0].finishTime !== null ? t('finished') : t('dnf');
  }

  const container: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    color: '#e8e8f0',
    background: 'linear-gradient(180deg, #1a1a2e 0%, #2a1010 50%, #1a1a2e 100%)',
    gap: 20,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    userSelect: 'none',
  };

  const winnerStyle: React.CSSProperties = {
    fontSize: isMulti ? 14 : 18,
    color: '#ff8020',
    animation: 'result-appear 0.6s ease-out both, winner-glow 2s ease-in-out infinite',
    textAlign: 'center',
    zIndex: 2,
    lineHeight: '1.5',
  };

  const trophyStyle: React.CSSProperties = {
    fontSize: 40,
    animation: 'trophy-bounce 1s ease-in-out infinite',
    zIndex: 2,
  };

  const resultsHeader: React.CSSProperties = {
    fontSize: 12,
    color: '#e06010',
    animation: 'result-appear 0.4s ease-out 0.2s both',
    zIndex: 2,
  };

  const playerCard = (playerIndex: number, delayBase: number) => {
    const p = results.players[playerIndex];
    if (!p) return null;
    const char = getCharacter(p.characterId);
    const isWinner = results.winner === playerIndex;
    // Determine if this player shares a character with another, use rival palette
    const charIds = [config.p1Character, config.p2Character, config.p3Character, config.p4Character];
    const hasDupe = charIds.slice(0, playerIndex).includes(p.characterId);
    const palette = hasDupe ? 'rival' : 'primary';
    const color = palette === 'rival' ? char.rivalColor : char.primaryColor;

    const cardStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '14px 20px',
      background: isWinner
        ? `linear-gradient(180deg, ${color}20 0%, #1a1a2e 100%)`
        : '#1a1a2ecc',
      boxShadow: isWinner
        ? `0 0 20px ${color}, inset 0 0 0 3px ${color}`
        : 'inset 0 0 0 2px #3a3a4a',
      minWidth: 160,
      animation: `stat-slide 0.4s ease-out ${delayBase}s both`,
      zIndex: 2,
    };

    const nameStyle: React.CSSProperties = {
      fontSize: 8,
      color,
      textShadow: isWinner ? `0 0 10px ${color}` : 'none',
    };

    const statRow: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',
      fontSize: 7,
      gap: 16,
    };

    const labelColor = '#666680';

    return (
      <div key={playerIndex} style={cardStyle}>
        {isMulti && (
          <div style={{ fontSize: 6, color: '#a0a0b0' }}>
            {`P${playerIndex + 1}`}
            {isWinner && <span style={{ marginLeft: 6, color: '#e0c000' }}>&#128081;</span>}
          </div>
        )}
        {/* Car icon */}
        <svg width="36" height="36" viewBox="0 0 48 48">
          <rect x="10" y="18" width="28" height="16" rx="3" fill={color} />
          <rect x="16" y="10" width="16" height="12" rx="2" fill={color} opacity="0.85" />
          <rect x="18" y="12" width="5" height="6" rx="1" fill="#00e0e0" opacity="0.5" />
          <rect x="25" y="12" width="5" height="6" rx="1" fill="#00e0e0" opacity="0.5" />
          <circle cx="15" cy="36" r="4" fill="#2a2a3a" />
          <circle cx="33" cy="36" r="4" fill="#2a2a3a" />
          <circle cx="15" cy="36" r="2" fill="#666680" />
          <circle cx="33" cy="36" r="2" fill="#666680" />
        </svg>
        <div style={nameStyle}>{t(char.name)}</div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={statRow}>
            <span style={{ color: labelColor }}>{t('time')}</span>
            <span style={{ color: '#00e0e0' }}>{formatTime(p.finishTime)}</span>
          </div>
          <div style={statRow}>
            <span style={{ color: labelColor }}>{t('death_count')}</span>
            <span style={{ color: p.deaths > 0 ? '#e02020' : '#00c040' }}>
              {'💀'.repeat(Math.min(p.deaths, 5))}{p.deaths > 5 ? `+${p.deaths - 5}` : ''}{p.deaths === 0 ? '0' : ''}
            </span>
          </div>
        </div>
      </div>
    );
  };

  function menuButton(item: typeof menuItems[number], index: number) {
    const isActive = index === menuIndex;
    return (
      <button
        key={item.key}
        onClick={item.action}
        onMouseEnter={() => setMenuIndex(index)}
        style={{
          fontSize: 9,
          padding: '10px 24px',
          background: isActive
            ? 'linear-gradient(90deg, #3a1a0a, #2a0a0a)'
            : 'transparent',
          color: isActive ? '#ff8020' : '#666680',
          border: 'none',
          fontFamily: "'Press Start 2P', monospace",
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: isActive ? 'inset 0 0 0 2px #ff8020' : 'inset 0 0 0 2px transparent',
          animation: `btn-appear 0.3s ease-out ${0.8 + index * 0.1}s both`,
          textShadow: isActive ? '0 0 8px #e06010' : 'none',
          zIndex: 2,
        }}
      >
        {isActive && <span style={{ marginRight: 8, color: '#e06010' }}>▶</span>}
        {item.label}
      </button>
    );
  }

  return (
    <div style={container}>
      <style>{keyframesStyle}</style>
      <ConfettiBackground />

      <div style={trophyStyle}>🏆</div>
      <div style={winnerStyle}>{winnerText}</div>
      <div style={resultsHeader}>{t('results')}</div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        {playerCard(0, 0.3)}
        {results.playerCount >= 2 && playerCard(1, 0.45)}
        {results.playerCount >= 3 && playerCard(2, 0.6)}
        {results.playerCount >= 4 && playerCard(3, 0.75)}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 12,
          zIndex: 2,
        }}
      >
        {menuItems.map((item, i) => menuButton(item, i))}
      </div>
    </div>
  );
}
