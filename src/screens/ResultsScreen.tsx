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
@keyframes pop-in {
  0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
  50%  { transform: scale(1.15) rotate(3deg); }
  70%  { transform: scale(0.92) rotate(-2deg); }
  85%  { transform: scale(1.04) rotate(0.5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes trophy-drop {
  0%   { transform: translateY(-100px) rotate(-20deg) scale(2); opacity: 0; }
  40%  { transform: translateY(10px) rotate(5deg) scale(0.9); opacity: 1; }
  60%  { transform: translateY(-5px) rotate(-3deg) scale(1.05); }
  80%  { transform: translateY(2px) rotate(1deg) scale(0.98); }
  100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes trophy-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30%  { transform: translateY(-6px) rotate(2deg); }
  60%  { transform: translateY(-3px) rotate(-1deg); }
}
@keyframes winner-glow {
  0%, 100% { text-shadow: 0 4px 0 #8a3000, 0 0 12px #ff802060; }
  50%      { text-shadow: 0 4px 0 #8a3000, 0 0 30px #ff802090, 0 0 50px #e0601050; }
}
@keyframes card-slide {
  0%   { transform: translateY(30px) scale(0.9); opacity: 0; }
  60%  { transform: translateY(-4px) scale(1.02); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes award-pop {
  0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
  50%  { transform: scale(1.2) rotate(4deg); }
  70%  { transform: scale(0.9) rotate(-2deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes btn-pop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
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

function ConfettiBackground() {
  const particles = Array.from({ length: 40 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 4;
    const duration = 3 + Math.random() * 3;
    const size = 4 + Math.random() * 6;
    const colors = ['#e04040', '#e07020', '#ff9030', '#e8c020', '#40c060', '#40d0e0', '#4080ff', '#e080a0'];
    const color = colors[i % colors.length];
    const borderRadius = i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0';
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          top: -10,
          left: `${left}%`,
          width: size,
          height: size * (i % 2 === 0 ? 1 : 0.6),
          background: color,
          borderRadius,
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
    return () => { audioManager.stop('music_results'); };
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setMenuIndex((i) => (i - 1 + menuItems.length) % menuItems.length);
        audioManager.play('sfx_menu_move');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setMenuIndex((i) => (i + 1) % menuItems.length);
        audioManager.play('sfx_menu_move');
      } else if (e.key === 'Enter' || e.key === ' ') {
        audioManager.play('sfx_menu_confirm');
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

  const totalPlayers = results.playerCount + (results.botCount ?? 0);
  const isMulti = totalPlayers >= 2;
  const hasWinner = results.winner !== null;

  let winnerText = '';
  if (isMulti && hasWinner) {
    winnerText = t(`p${results.winner! + 1}_wins` as any);
  } else if (!isMulti) {
    winnerText = results.players[0].finishTime !== null ? t('finished') : t('dnf');
  }

  const awards = results.awards ?? [];

  function playerCard(playerIndex: number, delay: number) {
    const p = results.players[playerIndex];
    if (!p) return null;
    const char = getCharacter(p.characterId);
    const isWinner = results.winner === playerIndex;
    const charIds = [config.p1Character, config.p2Character, config.p3Character, config.p4Character];
    const hasDupe = charIds.slice(0, playerIndex).includes(p.characterId);
    const color = hasDupe ? char.rivalColor : char.primaryColor;

    return (
      <div key={playerIndex} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '14px 18px',
        background: isWinner
          ? `radial-gradient(ellipse at 50% 30%, ${color}20 0%, #1a1228 100%)`
          : 'radial-gradient(ellipse at 50% 40%, #1e1c30 0%, #14121e 100%)',
        borderRadius: 20,
        boxShadow: isWinner
          ? `0 6px 24px ${color}50, 0 0 0 3px ${color}, inset 0 -4px 0 ${color}20`
          : '0 4px 12px #00000050, 0 0 0 2px #2a283a, inset 0 -3px 0 #0e0c16',
        minWidth: 150,
        animation: `card-slide 0.5s ease-out ${delay}s both`,
        zIndex: 2,
      }}>
        {/* Player label */}
        {isMulti && (
          <div style={{ fontSize: 7, color: '#a0a0b0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>P{playerIndex + 1}</span>
            {p.isBot && (
              <span style={{
                fontSize: 6,
                color: '#5090ff',
                padding: '2px 6px',
                borderRadius: 6,
                border: '1px solid #5090ff50',
                background: '#5090ff10',
              }}>BOT</span>
            )}
            {isWinner && <span style={{ fontSize: 14 }}>&#128081;</span>}
          </div>
        )}

        {/* Car mini */}
        <svg width="40" height="40" viewBox="0 0 48 48">
          <rect x="10" y="18" width="28" height="16" rx="4" fill={color} />
          <rect x="16" y="10" width="16" height="12" rx="3" fill={color} opacity="0.85" />
          <rect x="18" y="12" width="5" height="6" rx="1" fill="#80d0ff" opacity="0.4" />
          <rect x="25" y="12" width="5" height="6" rx="1" fill="#80d0ff" opacity="0.4" />
          <circle cx="15" cy="36" r="4" fill="#2a2a3a" />
          <circle cx="33" cy="36" r="4" fill="#2a2a3a" />
          <circle cx="15" cy="36" r="2" fill="#666680" />
          <circle cx="33" cy="36" r="2" fill="#666680" />
        </svg>

        <div style={{ fontSize: 8, color, textShadow: isWinner ? `0 0 10px ${color}60` : 'none' }}>
          {t(char.name)}
        </div>

        {/* Stats */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 7, gap: 12 }}>
            <span style={{ color: '#6a6a80' }}>{t('time')}</span>
            <span style={{ color: '#40d0e0' }}>{formatTime(p.finishTime)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 7, gap: 12 }}>
            <span style={{ color: '#6a6a80' }}>{t('death_count')}</span>
            <span style={{ color: p.deaths > 0 ? '#e04040' : '#40d060' }}>
              {'💀'.repeat(Math.min(p.deaths, 5))}{p.deaths > 5 ? `+${p.deaths - 5}` : ''}{p.deaths === 0 ? '0' : ''}
            </span>
          </div>
        </div>
      </div>
    );
  }

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
      background: 'radial-gradient(ellipse at 50% 20%, #2a1a3e 0%, #1a1228 40%, #0e0a18 100%)',
      gap: 14,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      <style>{keyframesStyle}</style>
      <ConfettiBackground />

      {/* Trophy */}
      <div style={{
        fontSize: 48,
        animation: 'trophy-drop 0.9s ease-out both, trophy-bob 2.5s ease-in-out 1s infinite',
        zIndex: 2,
        filter: 'drop-shadow(0 4px 12px #e0c00060)',
      }}>
        🏆
      </div>

      {/* Winner text */}
      <div style={{
        fontSize: isMulti ? 16 : 20,
        color: '#ffb040',
        textShadow: '0 4px 0 #8a3000, 0 0 16px #ff602060, -2px -2px 0 #c05010, 2px -2px 0 #c05010',
        animation: 'pop-in 0.6s ease-out 0.3s both, winner-glow 2.5s ease-in-out 1s infinite',
        textAlign: 'center',
        zIndex: 2,
        lineHeight: '1.4',
      }}>
        {winnerText}
      </div>

      {/* Results header */}
      <div style={{
        fontSize: 11,
        color: '#b08060',
        animation: 'pop-in 0.4s ease-out 0.4s both',
        zIndex: 2,
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}>
        {t('results')}
      </div>

      {/* Player cards */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: 'center',
        zIndex: 2,
      }}>
        {playerCard(0, 0.4)}
        {totalPlayers >= 2 && playerCard(1, 0.55)}
        {totalPlayers >= 3 && playerCard(2, 0.7)}
        {totalPlayers >= 4 && playerCard(3, 0.85)}
      </div>

      {/* Awards */}
      {awards.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          zIndex: 2,
        }}>
          {awards.map((award, i) => (
            <div key={award.key + i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'radial-gradient(ellipse at 50% 40%, #22203a 0%, #14121e 100%)',
              borderRadius: 14,
              boxShadow: '0 3px 10px #00000040, 0 0 0 2px #3a3050',
              fontSize: 7,
              animation: `award-pop 0.5s ease-out ${1.0 + i * 0.12}s both`,
              zIndex: 2,
            }}>
              <span style={{ fontSize: 16 }}>{award.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: '#e8c020' }}>{t(award.key as any)}</span>
                <span style={{ color: '#6a6a80', fontSize: 6 }}>
                  P{award.playerIndex + 1}
                  {award.value !== '' && ` · ${award.value}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menu buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginTop: 4,
        zIndex: 2,
      }}>
        {menuItems.map((item, i) => {
          const isActive = i === menuIndex;
          return (
            <button
              key={item.key}
              onClick={() => { audioManager.play('sfx_menu_confirm'); item.action(); }}
              onMouseEnter={() => { audioManager.play('sfx_menu_move'); setMenuIndex(i); }}
              style={{
                fontSize: 10,
                padding: '10px 28px',
                background: isActive
                  ? 'linear-gradient(180deg, #ff8020 0%, #c05010 100%)'
                  : 'transparent',
                color: isActive ? '#fff' : '#6a6a80',
                border: 'none',
                borderRadius: isActive ? 12 : 12,
                fontFamily: "'Press Start 2P', monospace",
                cursor: 'pointer',
                boxShadow: isActive
                  ? '0 4px 0 #803000, 0 6px 16px #e0601040, inset 0 2px 0 #ffa04040'
                  : '0 0 0 2px #3a3050',
                textShadow: isActive ? '0 2px 0 #803000' : 'none',
                animation: `btn-pop 0.4s ease-out ${0.9 + i * 0.1}s both`,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
