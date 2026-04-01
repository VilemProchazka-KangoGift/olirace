import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioManager } from '../game/audio';
import { characters } from '../data/characters';
import type { CharacterDef } from '../types';

interface Props {
  playerCount: 1 | 2 | 3 | 4;
  botCount: 0 | 1 | 2 | 3;
  onConfirm: (p1: string, p2: string, p3: string, p4: string) => void;
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

  switch (char.id) {
    case 'formula':
      return (
        <svg width="60" height="60" viewBox="0 0 56 56">
          {/* Rear wing */}
          <rect x="12" y="44" width="32" height="4" rx="1" fill="#2a2a3a" />
          <rect x="14" y="42" width="28" height="3" rx="1" fill="#3a3a4a" />
          {/* Body - sleek elongated */}
          <rect x="21" y="8" width="14" height="38" rx="4" fill={color} />
          {/* Nose cone */}
          <polygon points="28,2 22,14 34,14" fill={color} opacity="0.9" />
          {/* Front wing */}
          <rect x="12" y="12" width="32" height="3" rx="1" fill="#3a3a4a" />
          {/* Cockpit */}
          <rect x="24" y="20" width="8" height="10" rx="2" fill="#1a1a2e" />
          <rect x="25" y="22" width="6" height="6" rx="1" fill="#3a3a5a" />
          {/* Wheels */}
          <rect x="12" y="14" width="6" height="10" rx="2" fill="#2a2a3a" />
          <rect x="38" y="14" width="6" height="10" rx="2" fill="#2a2a3a" />
          <rect x="12" y="34" width="6" height="10" rx="2" fill="#2a2a3a" />
          <rect x="38" y="34" width="6" height="10" rx="2" fill="#2a2a3a" />
          {/* Side air intakes */}
          <rect x="19" y="30" width="3" height="5" rx="1" fill={color} opacity="0.7" />
          <rect x="34" y="30" width="3" height="5" rx="1" fill={color} opacity="0.7" />
          {/* Exhaust */}
          <circle cx="26" cy="48" r="1.5" fill="#666680" />
          <circle cx="30" cy="48" r="1.5" fill="#666680" />
        </svg>
      );

    case 'yeti':
      return (
        <svg width="60" height="60" viewBox="0 0 56 56">
          {/* Body - tall boxy SUV */}
          <rect x="10" y="14" width="36" height="32" rx="3" fill={color} />
          {/* Roof rack */}
          <rect x="14" y="10" width="28" height="3" rx="1" fill="#808898" />
          <rect x="18" y="8" width="2" height="4" fill="#808898" />
          <rect x="36" y="8" width="2" height="4" fill="#808898" />
          {/* Roof */}
          <rect x="14" y="12" width="28" height="16" rx="2" fill={color} opacity="0.85" />
          {/* Windshield */}
          <rect x="16" y="14" width="24" height="10" rx="2" fill="#88aace" opacity="0.6" />
          {/* Rear window */}
          <rect x="18" y="32" width="20" height="6" rx="1" fill="#6688aa" opacity="0.5" />
          {/* Bumpers */}
          <rect x="10" y="12" width="36" height="3" rx="1" fill="#808898" />
          <rect x="10" y="44" width="36" height="3" rx="1" fill="#808898" />
          {/* Headlights */}
          <circle cx="14" cy="13" r="2.5" fill="#e0c000" />
          <circle cx="42" cy="13" r="2.5" fill="#e0c000" />
          {/* Taillights */}
          <rect x="11" y="44" width="5" height="2" rx="1" fill="#e02020" />
          <rect x="40" y="44" width="5" height="2" rx="1" fill="#e02020" />
          {/* Wheels - big chunky */}
          <rect x="6" y="18" width="6" height="10" rx="3" fill="#2a2a3a" />
          <rect x="44" y="18" width="6" height="10" rx="3" fill="#2a2a3a" />
          <rect x="6" y="34" width="6" height="10" rx="3" fill="#2a2a3a" />
          <rect x="44" y="34" width="6" height="10" rx="3" fill="#2a2a3a" />
          {/* Side trim */}
          <rect x="10" y="29" width="36" height="2" fill={color} opacity="0.6" />
        </svg>
      );

    case 'cat':
      return (
        <svg width="60" height="60" viewBox="0 0 56 56">
          {/* Tail curling up */}
          <path d="M 40 38 Q 48 32 46 22 Q 45 18 42 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
          {/* Body - round */}
          <ellipse cx="28" cy="32" rx="16" ry="14" fill={color} />
          {/* Belly highlight */}
          <ellipse cx="28" cy="34" rx="10" ry="8" fill={color} opacity="0.7" />
          {/* Left ear */}
          <polygon points="14,20 10,6 22,16" fill={color} />
          <polygon points="15,18 12,9 20,16" fill="#e08060" opacity="0.6" />
          {/* Right ear */}
          <polygon points="42,20 46,6 34,16" fill={color} />
          <polygon points="41,18 44,9 36,16" fill="#e08060" opacity="0.6" />
          {/* Eyes */}
          <ellipse cx="22" cy="26" rx="3.5" ry="4" fill="#c8e0c8" />
          <ellipse cx="34" cy="26" rx="3.5" ry="4" fill="#c8e0c8" />
          <ellipse cx="23" cy="26" rx="1.8" ry="3" fill="#1a1a2e" />
          <ellipse cx="35" cy="26" rx="1.8" ry="3" fill="#1a1a2e" />
          {/* Nose */}
          <ellipse cx="28" cy="31" rx="2.5" ry="1.8" fill="#ff8090" />
          {/* Whiskers */}
          <line x1="8" y1="28" x2="20" y2="30" stroke="#a0a0b0" strokeWidth="1" />
          <line x1="8" y1="32" x2="20" y2="32" stroke="#a0a0b0" strokeWidth="1" />
          <line x1="36" y1="30" x2="48" y2="28" stroke="#a0a0b0" strokeWidth="1" />
          <line x1="36" y1="32" x2="48" y2="32" stroke="#a0a0b0" strokeWidth="1" />
          {/* Mouth */}
          <path d="M 25 33 Q 28 36 31 33" fill="none" stroke="#1a1a2e" strokeWidth="1" />
          {/* Wheels */}
          <circle cx="18" cy="46" r="4" fill="#2a2a3a" />
          <circle cx="38" cy="46" r="4" fill="#2a2a3a" />
          <circle cx="18" cy="46" r="2" fill="#666680" />
          <circle cx="38" cy="46" r="2" fill="#666680" />
        </svg>
      );

    case 'pig':
      return (
        <svg width="60" height="60" viewBox="0 0 56 56">
          {/* Curly tail */}
          <path d="M 40 38 Q 50 36 48 28 Q 46 24 44 28" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
          {/* Body - round/oval */}
          <ellipse cx="28" cy="32" rx="18" ry="15" fill={color} />
          {/* Highlight */}
          <ellipse cx="24" cy="28" rx="8" ry="6" fill="white" opacity="0.15" />
          {/* Ears - floppy */}
          <ellipse cx="16" cy="18" rx="6" ry="8" fill={color} transform="rotate(-20 16 18)" />
          <ellipse cx="16" cy="18" rx="4" ry="6" fill="#d0607a" opacity="0.5" transform="rotate(-20 16 18)" />
          <ellipse cx="40" cy="18" rx="6" ry="8" fill={color} transform="rotate(20 40 18)" />
          <ellipse cx="40" cy="18" rx="4" ry="6" fill="#d0607a" opacity="0.5" transform="rotate(20 40 18)" />
          {/* Eyes */}
          <circle cx="22" cy="26" r="3" fill="white" />
          <circle cx="34" cy="26" r="3" fill="white" />
          <circle cx="22.5" cy="26" r="1.8" fill="#1a1a2e" />
          <circle cx="34.5" cy="26" r="1.8" fill="#1a1a2e" />
          {/* Snout */}
          <ellipse cx="28" cy="34" rx="8" ry="5" fill="#d0607a" />
          {/* Nostrils */}
          <ellipse cx="25" cy="34" rx="2" ry="1.5" fill="#1a1a2e" opacity="0.5" />
          <ellipse cx="31" cy="34" rx="2" ry="1.5" fill="#1a1a2e" opacity="0.5" />
          {/* Wheels */}
          <circle cx="16" cy="46" r="4" fill="#2a2a3a" />
          <circle cx="40" cy="46" r="4" fill="#2a2a3a" />
          <circle cx="16" cy="46" r="2" fill="#666680" />
          <circle cx="40" cy="46" r="2" fill="#666680" />
        </svg>
      );

    case 'frog':
      return (
        <svg width="60" height="60" viewBox="0 0 56 56">
          {/* Body - wide oval */}
          <ellipse cx="28" cy="34" rx="20" ry="14" fill={color} />
          {/* Lighter belly */}
          <ellipse cx="28" cy="36" rx="12" ry="8" fill={color} opacity="0.6" />
          {/* Left eye bulge */}
          <circle cx="16" cy="18" r="9" fill={color} />
          <circle cx="16" cy="17" r="6" fill="#dde8dd" />
          <circle cx="16.5" cy="17" r="3" fill="#1a1a2e" />
          {/* Right eye bulge */}
          <circle cx="40" cy="18" r="9" fill={color} />
          <circle cx="40" cy="17" r="6" fill="#dde8dd" />
          <circle cx="40.5" cy="17" r="3" fill="#1a1a2e" />
          {/* Wide mouth */}
          <path d="M 12 38 Q 28 46 44 38" fill="none" stroke="#1a4a1a" strokeWidth="2" />
          {/* Nostrils */}
          <circle cx="24" cy="30" r="1.5" fill="#1a4a1a" />
          <circle cx="32" cy="30" r="1.5" fill="#1a4a1a" />
          {/* Spots */}
          <circle cx="20" cy="32" r="3" fill={color} opacity="0.5" />
          <circle cx="36" cy="32" r="3" fill={color} opacity="0.5" />
          {/* Front legs */}
          <ellipse cx="12" cy="44" rx="4" ry="3" fill={color} opacity="0.8" />
          <ellipse cx="44" cy="44" rx="4" ry="3" fill={color} opacity="0.8" />
          {/* Wheels */}
          <circle cx="16" cy="48" r="4" fill="#2a2a3a" />
          <circle cx="40" cy="48" r="4" fill="#2a2a3a" />
          <circle cx="16" cy="48" r="2" fill="#666680" />
          <circle cx="40" cy="48" r="2" fill="#666680" />
        </svg>
      );

    case 'toilet':
      return (
        <svg width="60" height="60" viewBox="0 0 56 56">
          {/* Tank/cistern */}
          <rect x="18" y="36" width="20" height="14" rx="3" fill={color} opacity="0.85" />
          <rect x="20" y="38" width="8" height="10" rx="2" fill="white" opacity="0.15" />
          {/* Flush handle */}
          <path d="M 34 40 L 40 38 L 42 40" fill="none" stroke="#b0b0c0" strokeWidth="2" strokeLinecap="round" />
          <circle cx="42" cy="40" r="2" fill="#c0c0d0" />
          {/* Bowl body */}
          <ellipse cx="28" cy="24" rx="14" ry="16" fill={color} />
          {/* Bowl shadow */}
          <ellipse cx="28" cy="28" rx="13" ry="10" fill="#000" opacity="0.1" />
          {/* Seat ring */}
          <ellipse cx="28" cy="22" rx="10" ry="12" fill="none" stroke="#c0c0d8" strokeWidth="3" />
          {/* Water */}
          <ellipse cx="28" cy="22" rx="7" ry="8" fill="#60a0e0" opacity="0.5" />
          {/* Splash drops */}
          <circle cx="25" cy="18" r="2" fill="#80d0ff" opacity="0.6" />
          <circle cx="32" cy="20" r="1.5" fill="#80d0ff" opacity="0.6" />
          <circle cx="28" cy="15" r="1" fill="#80d0ff" opacity="0.6" />
          {/* Lid slightly open */}
          <ellipse cx="28" cy="32" rx="10" ry="3" fill={color} opacity="0.9" />
          {/* Porcelain highlight */}
          <ellipse cx="22" cy="18" rx="4" ry="6" fill="white" opacity="0.2" transform="rotate(-15 22 18)" />
          {/* Wheels */}
          <circle cx="16" cy="12" r="3.5" fill="#2a2a3a" />
          <circle cx="40" cy="12" r="3.5" fill="#2a2a3a" />
          <circle cx="16" cy="46" r="3.5" fill="#2a2a3a" />
          <circle cx="40" cy="46" r="3.5" fill="#2a2a3a" />
          <circle cx="16" cy="12" r="1.5" fill="#666680" />
          <circle cx="40" cy="12" r="1.5" fill="#666680" />
          <circle cx="16" cy="46" r="1.5" fill="#666680" />
          <circle cx="40" cy="46" r="1.5" fill="#666680" />
        </svg>
      );

    default:
      return (
        <svg width="60" height="60" viewBox="0 0 56 56">
          <rect x="12" y="18" width="32" height="20" rx="4" fill={color} />
          <rect x="18" y="10" width="20" height="14" rx="3" fill={color} opacity="0.85" />
          <circle cx="18" cy="42" r="4" fill="#2a2a3a" />
          <circle cx="38" cy="42" r="4" fill="#2a2a3a" />
        </svg>
      );
  }
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = statPercent(value, max);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <div style={{ fontSize: 7, width: 52, textAlign: 'right', color: '#a0a0b0', flexShrink: 0 }}>
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

const PLAYER_COLORS = ['#00e0e0', '#e0c000', '#00c040', '#e080a0'];
const PLAYER_LABELS = ['P1', 'P2', 'P3', 'P4'];
const PLAYER_HINTS = [
  '\u2191\u2193\u2190\u2192 + Enter',
  'WASD + Space',
  'IJKL + H',
  'Num 8456 + Num0',
];

export default function CharacterSelect({ playerCount, botCount, onConfirm, onBack }: Props) {
  const { t } = useTranslation();
  const [indices, setIndices] = useState([0, 2, 1, 3]);
  const setPlayerIndex = (pIdx: number, fn: (i: number) => number) => {
    setIndices((prev) => {
      const next = [...prev];
      next[pIdx] = fn(prev[pIdx]);
      return next;
    });
  };



  // Countdown timer - 10 seconds to pick characters, then auto-start
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Submit when countdown hits 0 or Enter is pressed
  const submitAll = useCallback(() => {
    // Human picks
    const humanPicks = new Set<string>();
    const chars: string[] = [];
    for (let i = 0; i < playerCount; i++) {
      const id = characters[indices[i]].id;
      chars.push(id);
      humanPicks.add(id);
    }

    // Bot picks: random characters avoiding duplicates with humans
    const available = characters.filter(c => !humanPicks.has(c.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    let botIdx = 0;
    for (let i = playerCount; i < playerCount + botCount && i < 4; i++) {
      if (botIdx < shuffled.length) {
        chars.push(shuffled[botIdx].id);
        botIdx++;
      } else {
        // Fallback: reuse characters if more bots than unique chars
        chars.push(characters[(i * 2 + 1) % characters.length].id);
      }
    }

    // Fill remaining slots
    while (chars.length < 4) {
      chars.push(characters[(chars.length * 2) % characters.length].id);
    }

    onConfirm(chars[0], chars[1], chars[2], chars[3]);
  }, [indices, playerCount, botCount, onConfirm]);

  useEffect(() => {
    if (countdown === 0) {
      submitAll();
    }
  }, [countdown, submitAll]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // Enter or Space from any player starts immediately
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        audioManager.play('sfx_menu_confirm');
        submitAll();
        return;
      }

      // P1 controls: Arrow Left/Right
      if (e.key === 'ArrowLeft') {
        setPlayerIndex(0, (i) => (i - 1 + characters.length) % characters.length);
        audioManager.play('sfx_menu_move');
      } else if (e.key === 'ArrowRight') {
        setPlayerIndex(0, (i) => (i + 1) % characters.length);
        audioManager.play('sfx_menu_move');
      }

      // P2 controls: A/D
      if (playerCount >= 2) {
        if (e.key === 'a' || e.key === 'A') {
          setPlayerIndex(1, (i) => (i - 1 + characters.length) % characters.length);
          audioManager.play('sfx_menu_move');
        } else if (e.key === 'd' || e.key === 'D') {
          setPlayerIndex(1, (i) => (i + 1) % characters.length);
          audioManager.play('sfx_menu_move');
        }
      }

      // P3 controls: J/L
      if (playerCount >= 3) {
        if (e.key === 'j' || e.key === 'J') {
          setPlayerIndex(2, (i) => (i - 1 + characters.length) % characters.length);
          audioManager.play('sfx_menu_move');
        } else if (e.key === 'l' || e.key === 'L') {
          setPlayerIndex(2, (i) => (i + 1) % characters.length);
          audioManager.play('sfx_menu_move');
        }
      }

      // P4 controls: Numpad4/Numpad6
      if (playerCount >= 4) {
        if (e.code === 'Numpad4') {
          setPlayerIndex(3, (i) => (i - 1 + characters.length) % characters.length);
          audioManager.play('sfx_menu_move');
        } else if (e.code === 'Numpad6') {
          setPlayerIndex(3, (i) => (i + 1) % characters.length);
          audioManager.play('sfx_menu_move');
        }
      }

      if (e.key === 'Escape') {
        onBack();
      }
    },
    [playerCount, onBack, submitAll],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Check for duplicate character selections among confirmed players
  const getDuplicateSet = () => {
    const seen = new Map<number, number[]>();
    for (let i = 0; i < playerCount; i++) {
      const idx = indices[i];
      if (!seen.has(idx)) seen.set(idx, []);
      seen.get(idx)!.push(i);
    }
    const dupes = new Set<number>();
    for (const [, pIdxs] of seen) {
      if (pIdxs.length > 1) {
        for (const p of pIdxs) dupes.add(p);
      }
    }
    return dupes;
  };

  const duplicateSet = getDuplicateSet();

  const container: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Press Start 2P', monospace",
    color: '#e8e8f0',
    background: 'linear-gradient(180deg, #1a1a2e 0%, #2a1515 100%)',
    padding: '12px 8px',
    gap: playerCount > 2 ? 6 : 12,
    userSelect: 'none',
    overflowY: 'auto',
  };

  const header: React.CSSProperties = {
    fontSize: 14,
    color: '#ff8020',
    textShadow: '0 0 10px #e06010',
    animation: 'header-in 0.5s ease-out both',
    textAlign: 'center',
    flexShrink: 0,
  };

  function renderPlayerSection(playerNum: number) {
    const pIdx = playerNum - 1;
    const selectedIndex = indices[pIdx];
    const isRival = duplicateSet.has(pIdx) && pIdx > 0;
    const compact = playerCount > 2;

    const sectionStyle: React.CSSProperties = {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: compact ? 4 : 10,
    };

    const playerLabel: React.CSSProperties = {
      fontSize: 7,
      color: PLAYER_COLORS[pIdx],
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

    const labelText = playerCount === 1
      ? t('character_select')
      : t(`character_select_p${playerNum}` as any);

    return (
      <div style={sectionStyle}>
        <div style={playerLabel}>
          {labelText}
        </div>

        <div style={row}>
          {characters.map((char, i) => {
            const isSelected = i === selectedIndex;
            const cardColor = isRival && isSelected ? char.rivalColor : char.primaryColor;
            return (
              <button
                key={char.id}
                onClick={() => { audioManager.play('sfx_menu_move'); setPlayerIndex(pIdx, () => i); }}
                style={{
                  width: compact ? 76 : (playerCount === 2 ? 92 : 100),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: compact ? 2 : 4,
                  padding: compact ? 4 : 6,
                  background: isSelected
                    ? `linear-gradient(180deg, ${cardColor}20 0%, #1a1a2e 100%)`
                    : '#1a1a2e',
                  border: 'none',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#e8e8f0',
                  cursor: 'pointer',
                  opacity: 1,
                  animation: `card-pop 0.3s ease-out ${i * 0.06}s both${isSelected ? ', glow-selected 1.5s ease infinite' : ''}`,
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
                <div style={{ fontSize: 7, textAlign: 'center', lineHeight: '1.5', minHeight: compact ? 10 : 16 }}>
                  {t(char.name)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Stats for selected character (hide in compact 4P view) */}
        {!compact && (
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
        )}

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
            {PLAYER_LABELS[pIdx]}: {t('rival_palette')}
          </div>
        )}

        <div style={{
          fontSize: 6,
          color: '#666680',
          display: 'flex',
          gap: 3,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
          opacity: 1,
          transition: 'opacity 0.3s',
        }}>
          {PLAYER_HINTS[pIdx].split(/(\s*\+\s*|\s+)/).filter(Boolean).map((part, ki) => {
            const trimmed = part.trim();
            if (trimmed === '+') {
              return <span key={ki} style={{ color: '#555568', fontSize: 5 }}>+</span>;
            }
            if (trimmed === '') return null;
            return (
              <span
                key={ki}
                style={{
                  display: 'inline-block',
                  padding: '2px 5px',
                  background: '#1a1a2e',
                  border: '1px solid #3a3a5a',
                  borderBottom: '2px solid #3a3a5a',
                  borderRadius: 3,
                  color: '#a0a0c0',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 5,
                  letterSpacing: 1,
                }}
              >
                {trimmed}
              </span>
            );
          })}
        </div>
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

      {renderPlayerSection(1)}

      {playerCount >= 2 && (
        <>
          <div style={divider} />
          {renderPlayerSection(2)}
        </>
      )}

      {playerCount >= 3 && (
        <>
          <div style={divider} />
          {renderPlayerSection(3)}
        </>
      )}

      {playerCount >= 4 && (
        <>
          <div style={divider} />
          {renderPlayerSection(4)}
        </>
      )}

      {/* Bot sections */}
      {botCount > 0 && (
        <>
          <div style={divider} />
          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {Array.from({ length: botCount }, (_, i) => {
              const botSlot = playerCount + i;
              return (
                <div key={`bot-${i}`} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 16px',
                  background: '#1a1a2e',
                  boxShadow: 'inset 0 0 0 2px #2060e0',
                  opacity: 0.7,
                }}>
                  <div style={{ fontSize: 7, color: '#4080ff' }}>
                    {t('bot_label')} {i + 1}
                  </div>
                  <div style={{
                    fontSize: 16,
                    color: '#4080ff',
                    textShadow: '0 0 8px #2060e0',
                  }}>
                    P{botSlot + 1}
                  </div>
                  <div style={{ fontSize: 6, color: '#666680' }}>
                    {t('bot_count_1').split(' ').pop()}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Countdown timer */}
      <div style={{
        fontSize: 20,
        color: countdown <= 3 ? '#e02020' : '#ff8020',
        textShadow: `0 0 ${countdown <= 3 ? 20 : 10}px ${countdown <= 3 ? '#e02020' : '#e06010'}`,
        textAlign: 'center',
        animation: countdown <= 3 ? 'logo-pulse 0.5s ease infinite' : undefined,
        marginTop: 8,
      }}>
        {countdown}
      </div>
      <div style={{
        fontSize: 6,
        color: '#666680',
        textAlign: 'center',
        marginTop: 4,
      }}>
        Enter / Space
      </div>

      <button style={backBtn} onClick={onBack}>
        Esc
      </button>
    </div>
  );
}
