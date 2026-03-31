import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { characters } from '../data/characters';
import type { CharacterDef } from '../types';

interface Props {
  playerCount: 1 | 2;
  onConfirm: (p1: string, p2: string) => void;
  onBack: () => void;
}

const keyframesStyle = `
@keyframes card-pop {
  0%   { transform: scale(0.85); opacity: 0; }
  60%  { transform: scale(1.04); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes glow-selected {
  0%, 100% { box-shadow: 0 0 12px var(--glow), inset 0 0 0 3px var(--glow); }
  50%      { box-shadow: 0 0 28px var(--glow), 0 0 50px rgba(224, 96, 16, 0.2), inset 0 0 0 3px var(--glow); }
}
@keyframes header-in {
  0%   { transform: translateY(-16px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes bar-fill {
  0%   { width: 0%; }
  100% { width: var(--bar-w); }
}
@keyframes rival-badge-pulse {
  0%, 100% { opacity: 0.8; }
  50%      { opacity: 1; }
}
`;

// Normalize stat to 0-1 range for bar display
const SPEED_MAX = 300;
const HANDLING_MAX = 5;
const WEIGHT_MAX = 1;

function statPercent(value: number, max: number): number {
  return Math.min(100, Math.round((value / max) * 100));
}

function CarIcon({ char, isRival }: { char: CharacterDef; isRival: boolean }) {
  const color = isRival ? char.rivalColor : char.primaryColor;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      {/* Car body */}
      <rect x="10" y="18" width="28" height="16" rx="3" fill={color} />
      {/* Roof */}
      <rect x="16" y="10" width="16" height="12" rx="2" fill={color} opacity="0.85" />
      {/* Windows */}
      <rect x="18" y="12" width="5" height="6" rx="1" fill="#00e0e0" opacity="0.5" />
      <rect x="25" y="12" width="5" height="6" rx="1" fill="#00e0e0" opacity="0.5" />
      {/* Wheels */}
      <circle cx="15" cy="36" r="4" fill="#2a2a3a" />
      <circle cx="33" cy="36" r="4" fill="#2a2a3a" />
      <circle cx="15" cy="36" r="2" fill="#666680" />
      <circle cx="33" cy="36" r="2" fill="#666680" />
      {/* Headlights */}
      <rect x="34" y="22" width="4" height="3" rx="1" fill="#e0c000" opacity="0.9" />
      <rect x="34" y="27" width="4" height="3" rx="1" fill="#e02020" opacity="0.7" />
    </svg>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = statPercent(value, max);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <div style={{ fontSize: 5, width: 52, textAlign: 'right', color: '#a0a0b0', flexShrink: 0 }}>
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 6,
          background: '#1a1a2e',
          border: '1px solid #3a3a4a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}80 0%, ${color} 100%)`,
            animation: `bar-fill 0.6s ease-out both`,
            // @ts-expect-error CSS custom property
            '--bar-w': `${pct}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function CharacterSelect({ playerCount, onConfirm, onBack }: Props) {
  const { t } = useTranslation();
  const [p1Index, setP1Index] = useState(0);
  const [p2Index, setP2Index] = useState(2);
  const [p1Confirmed, setP1Confirmed] = useState(false);
  const [p2Confirmed, setP2Confirmed] = useState(playerCount === 1);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // P1 controls: Arrow Left/Right + Enter
      if (!p1Confirmed) {
        if (e.key === 'ArrowLeft') {
          setP1Index((i) => (i - 1 + characters.length) % characters.length);
        } else if (e.key === 'ArrowRight') {
          setP1Index((i) => (i + 1) % characters.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          setP1Confirmed(true);
        }
      }

      // P2 controls: A/D + Space
      if (playerCount === 2 && !p2Confirmed) {
        if (e.key === 'a' || e.key === 'A') {
          setP2Index((i) => (i - 1 + characters.length) % characters.length);
        } else if (e.key === 'd' || e.key === 'D') {
          setP2Index((i) => (i + 1) % characters.length);
        } else if (e.key === ' ') {
          e.preventDefault();
          setP2Confirmed(true);
        }
      }

      if (e.key === 'Escape') {
        if (p1Confirmed && !p2Confirmed) {
          setP1Confirmed(false);
        } else if (p2Confirmed && p1Confirmed) {
          setP2Confirmed(false);
        } else {
          onBack();
        }
      }
    },
    [p1Confirmed, p2Confirmed, playerCount, onBack],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Auto-advance when both confirmed
  useEffect(() => {
    if (p1Confirmed && p2Confirmed) {
      const timer = setTimeout(() => {
        const p2Char = playerCount === 2 ? characters[p2Index].id : characters[(p1Index + 2) % characters.length].id;
        onConfirm(characters[p1Index].id, p2Char);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [p1Confirmed, p2Confirmed, p1Index, p2Index, playerCount, onConfirm]);

  const sameChar = playerCount === 2 && p1Index === p2Index;

  const container: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Press Start 2P', monospace",
    color: '#e8e8f0',
    background: 'linear-gradient(180deg, #1a1a2e 0%, #2a1515 100%)',
    padding: '20px 12px',
    gap: 12,
    userSelect: 'none',
    overflowY: 'auto',
  };

  const header: React.CSSProperties = {
    fontSize: 11,
    color: '#ff8020',
    textShadow: '0 0 10px #e06010',
    animation: 'header-in 0.5s ease-out both',
    textAlign: 'center',
    flexShrink: 0,
  };

  function renderPlayerSection(
    playerNum: 1 | 2,
    selectedIndex: number,
    setIndex: (fn: (i: number) => number) => void,
    confirmed: boolean,
    setConfirmed: (v: boolean) => void,
  ) {
    const sectionStyle: React.CSSProperties = {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
    };

    const playerLabel: React.CSSProperties = {
      fontSize: 7,
      color: playerNum === 1 ? '#00e0e0' : '#e0c000',
      textAlign: 'center',
    };

    const row: React.CSSProperties = {
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
      flexWrap: 'nowrap',
      overflowX: 'auto',
      maxWidth: '100%',
      padding: '4px 0',
    };

    const isRival = playerNum === 2 && sameChar;

    return (
      <div style={sectionStyle}>
        <div style={playerLabel}>
          {playerCount === 2
            ? t(playerNum === 1 ? 'character_select_p1' : 'character_select_p2')
            : t('character_select')}
          {confirmed && (
            <span style={{ color: '#00c040', marginLeft: 8 }}>✓</span>
          )}
        </div>

        <div style={row}>
          {characters.map((char, i) => {
            const isSelected = i === selectedIndex;
            const cardColor = isRival && isSelected ? char.rivalColor : char.primaryColor;
            return (
              <button
                key={char.id}
                onClick={() => {
                  if (!confirmed) {
                    setIndex(() => i);
                  }
                }}
                style={{
                  width: playerCount === 2 ? 78 : 84,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: 6,
                  background: isSelected
                    ? `linear-gradient(180deg, ${cardColor}20 0%, #1a1a2e 100%)`
                    : '#1a1a2e',
                  border: 'none',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#e8e8f0',
                  cursor: confirmed ? 'default' : 'pointer',
                  opacity: confirmed && !isSelected ? 0.35 : 1,
                  animation: `card-pop 0.3s ease-out ${i * 0.06}s both${isSelected && !confirmed ? ', glow-selected 1.5s ease infinite' : ''}`,
                  boxShadow: isSelected
                    ? `0 0 14px ${cardColor}, inset 0 0 0 2px ${cardColor}`
                    : 'inset 0 0 0 2px #2a2a3a',
                  transition: 'opacity 0.3s, background 0.2s',
                  // @ts-expect-error CSS custom property
                  '--glow': cardColor,
                  flexShrink: 0,
                }}
              >
                <CarIcon char={char} isRival={isRival && isSelected} />
                <div style={{ fontSize: 5, textAlign: 'center', lineHeight: '1.5', minHeight: 16 }}>
                  {t(char.name)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Stats for selected character */}
        <div
          style={{
            width: '100%',
            maxWidth: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '4px 8px',
          }}
        >
          <StatBar label={t('stat_speed')} value={characters[selectedIndex].maxSpeed} max={SPEED_MAX} color="#00e0e0" />
          <StatBar label={t('stat_handling')} value={characters[selectedIndex].handling} max={HANDLING_MAX} color="#00c040" />
          <StatBar label={t('stat_weight')} value={characters[selectedIndex].weight} max={WEIGHT_MAX} color="#e07020" />
        </div>

        {isRival && (
          <div
            style={{
              fontSize: 5,
              color: characters[selectedIndex].rivalColor,
              animation: 'rival-badge-pulse 1.5s ease infinite',
              padding: '3px 8px',
              border: `1px solid ${characters[selectedIndex].rivalColor}60`,
              background: `${characters[selectedIndex].rivalColor}15`,
            }}
          >
            P2: Rival palette
          </div>
        )}

        {!confirmed && (
          <div style={{ fontSize: 6, color: '#666680' }}>
            {playerNum === 1
              ? '← → + Enter'
              : 'A/D + Space'}
          </div>
        )}
      </div>
    );
  }

  const divider: React.CSSProperties = {
    width: '80%',
    height: 1,
    background: 'linear-gradient(90deg, transparent, #3a3a4a, transparent)',
    flexShrink: 0,
  };

  const backBtn: React.CSSProperties = {
    fontSize: 7,
    padding: '6px 14px',
    background: 'transparent',
    color: '#666680',
    border: '2px solid #3a3a4a',
    fontFamily: "'Press Start 2P', monospace",
    cursor: 'pointer',
    flexShrink: 0,
  };

  return (
    <div style={container}>
      <style>{keyframesStyle}</style>
      <div style={header}>{t('character_select')}</div>

      {renderPlayerSection(1, p1Index, setP1Index, p1Confirmed, setP1Confirmed)}

      {playerCount === 2 && (
        <>
          <div style={divider} />
          {renderPlayerSection(2, p2Index, setP2Index, p2Confirmed, setP2Confirmed)}
        </>
      )}

      <button style={backBtn} onClick={onBack}>
        Esc
      </button>
    </div>
  );
}
