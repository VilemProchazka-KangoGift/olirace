import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioManager } from '../game/audio';

interface Props {
  onSelect: (count: 1 | 2 | 3 | 4, botCount: 0 | 1 | 2 | 3) => void;
}

const keyframesStyle = `
@keyframes card-appear {
  0%   { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes selected-glow {
  0%, 100% { box-shadow: 0 0 15px #e06010, inset 0 0 0 3px #ff8020; }
  50%      { box-shadow: 0 0 30px #e06010, 0 0 50px #8a2000, inset 0 0 0 3px #ff8020; }
}
@keyframes header-slide {
  0%   { transform: translateY(-20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes bot-glow {
  0%, 100% { box-shadow: 0 0 12px #2060e0, inset 0 0 0 2px #4080ff; }
  50%      { box-shadow: 0 0 24px #2060e0, 0 0 40px #1040a0, inset 0 0 0 2px #4080ff; }
}
`;

type FocusRow = 'players' | 'bots';

export default function PlayerCountSelect({ onSelect }: Props) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<1 | 2 | 3 | 4>(1);
  const [botCount, setBotCount] = useState<0 | 1 | 2 | 3>(0);
  const [focusRow, setFocusRow] = useState<FocusRow>('players');

  const maxBots = (4 - hovered) as 0 | 1 | 2 | 3;

  // Clamp bot count when player count changes
  useEffect(() => {
    if (botCount > maxBots) {
      setBotCount(maxBots);
    }
  }, [hovered, botCount, maxBots]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // Direct number keys for player count
      if (e.key === '1') { setHovered(1); setFocusRow('players'); audioManager.play('sfx_menu_move'); }
      else if (e.key === '2') { setHovered(2); setFocusRow('players'); audioManager.play('sfx_menu_move'); }
      else if (e.key === '3') { setHovered(3); setFocusRow('players'); audioManager.play('sfx_menu_move'); }
      else if (e.key === '4') { setHovered(4); setFocusRow('players'); audioManager.play('sfx_menu_move'); }
      // Arrow navigation
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (focusRow === 'bots') {
          setFocusRow('players');
          audioManager.play('sfx_menu_move');
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        if (focusRow === 'players') {
          setFocusRow('bots');
          audioManager.play('sfx_menu_move');
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (focusRow === 'players') {
          setHovered((h) => (h <= 1 ? 1 : (h - 1) as 1 | 2 | 3 | 4));
        } else {
          setBotCount((b) => (b <= 0 ? 0 : (b - 1) as 0 | 1 | 2 | 3));
        }
        audioManager.play('sfx_menu_move');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (focusRow === 'players') {
          setHovered((h) => (h >= 4 ? 4 : (h + 1) as 1 | 2 | 3 | 4));
        } else {
          setBotCount((b) => {
            const max = (4 - hovered) as 0 | 1 | 2 | 3;
            return b >= max ? max : (b + 1) as 0 | 1 | 2 | 3;
          });
        }
        audioManager.play('sfx_menu_move');
      } else if (e.key === 'Enter' || e.key === ' ') {
        const effectiveBots = Math.min(botCount, 4 - hovered) as 0 | 1 | 2 | 3;
        onSelect(hovered, effectiveBots);
        audioManager.play('sfx_menu_confirm');
      }
    },
    [onSelect, hovered, botCount, focusRow],
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
    gap: 24,
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
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  };

  function makeCardStyle(count: 1 | 2 | 3 | 4): React.CSSProperties {
    const isActive = hovered === count && focusRow === 'players';
    const isSelected = hovered === count;
    return {
      width: 140,
      height: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      background: isSelected
        ? 'linear-gradient(180deg, #3a1a0a 0%, #2a0a0a 100%)'
        : 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2e 100%)',
      border: 'none',
      cursor: 'pointer',
      fontFamily: "'Press Start 2P', monospace",
      color: '#e8e8f0',
      animation: `card-appear 0.4s ease-out ${(count - 1) * 0.1}s both${isActive ? ', selected-glow 1.5s ease infinite' : ''}`,
      boxShadow: isSelected
        ? '0 0 20px #e06010, inset 0 0 0 3px #ff8020'
        : 'inset 0 0 0 3px #3a3a4a',
      transition: 'background 0.2s, box-shadow 0.2s',
      padding: 12,
    };
  }

  function makeBotCardStyle(count: 0 | 1 | 2 | 3): React.CSSProperties {
    const isDisabled = count > maxBots;
    const isActive = botCount === count && focusRow === 'bots';
    const isSelected = botCount === count;
    return {
      width: 100,
      height: 64,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      background: isDisabled
        ? '#1a1a2e'
        : isSelected
          ? 'linear-gradient(180deg, #0a1a3a 0%, #0a0a2a 100%)'
          : 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2e 100%)',
      border: 'none',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      fontFamily: "'Press Start 2P', monospace",
      color: isDisabled ? '#3a3a4a' : '#e8e8f0',
      animation: isActive && !isDisabled ? 'bot-glow 1.5s ease infinite' : undefined,
      boxShadow: isSelected && !isDisabled
        ? '0 0 16px #2060e0, inset 0 0 0 2px #4080ff'
        : 'inset 0 0 0 2px #3a3a4a',
      transition: 'background 0.2s, box-shadow 0.2s',
      padding: 8,
      opacity: isDisabled ? 0.3 : 1,
    };
  }

  const numberStyle: React.CSSProperties = {
    fontSize: 48,
    color: '#ff8020',
    textShadow: '0 0 20px #e06010',
    lineHeight: '1',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: '1.5',
  };

  // Pixel art car icon
  const carIcon = (count: 1 | 2 | 3 | 4) => {
    const carColors = ['#e02020', '#2060e0', '#00c040', '#e0c000'];
    const cars = carColors.slice(0, count);
    const cols = count <= 2 ? count : 2;
    const rows = count <= 2 ? 1 : 2;
    const svgW = cols * 24 + 8;
    const svgH = rows * 24 + 4;
    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {cars.map((color, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const ox = col * 24 + 4;
          const oy = row * 24 + 2;
          return (
            <g key={i} transform={`translate(${ox}, ${oy})`}>
              <rect x="2" y="4" width="16" height="10" rx="2" fill={color} />
              <rect x="5" y="1" width="10" height="6" rx="1" fill={color} opacity="0.8" />
              <rect x="6" y="2" width="3" height="3" fill="#00e0e0" opacity="0.6" />
              <rect x="11" y="2" width="3" height="3" fill="#00e0e0" opacity="0.6" />
              <circle cx="5" cy="16" r="2" fill="#3a3a4a" />
              <circle cx="15" cy="16" r="2" fill="#3a3a4a" />
              <circle cx="5" cy="16" r="1" fill="#666680" />
              <circle cx="15" cy="16" r="1" fill="#666680" />
            </g>
          );
        })}
      </svg>
    );
  };

  const hint: React.CSSProperties = {
    fontSize: 9,
    color: '#666680',
    textAlign: 'center',
    marginTop: 4,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 12,
    color: '#a0a0b0',
    textAlign: 'center',
  };

  const options: Array<{ count: 1 | 2 | 3 | 4; label: string }> = [
    { count: 1, label: t('one_player') },
    { count: 2, label: t('two_players') },
    { count: 3, label: t('three_players') },
    { count: 4, label: t('four_players') },
  ];

  const botOptions: Array<{ count: 0 | 1 | 2 | 3; label: string }> = [
    { count: 0, label: t('bot_count_0') },
    { count: 1, label: t('bot_count_1') },
    { count: 2, label: t('bot_count_2') },
    { count: 3, label: t('bot_count_3') },
  ];

  return (
    <div style={container}>
      <style>{keyframesStyle}</style>
      <div style={header}>{t('select_mode')}</div>

      {/* Player count row */}
      <div style={cardsRow}>
        {options.map(({ count, label }) => (
          <button
            key={count}
            style={makeCardStyle(count)}
            onClick={() => { audioManager.play('sfx_menu_confirm'); setHovered(count); setFocusRow('players'); }}
            onMouseEnter={() => { audioManager.play('sfx_menu_move'); setHovered(count); setFocusRow('players'); }}
          >
            {carIcon(count)}
            <div style={numberStyle}>{count}</div>
            <div style={labelStyle}>{label}</div>
          </button>
        ))}
      </div>

      {/* Bot count row */}
      <div style={sectionLabel}>{t('bot_opponents')}</div>
      <div style={cardsRow}>
        {botOptions.map(({ count, label }) => {
          const isDisabled = count > maxBots;
          return (
            <button
              key={`bot-${count}`}
              style={makeBotCardStyle(count)}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  audioManager.play('sfx_menu_move');
                  setBotCount(count);
                  setFocusRow('bots');
                }
              }}
              onMouseEnter={() => {
                if (!isDisabled) {
                  audioManager.play('sfx_menu_move');
                  setBotCount(count);
                  setFocusRow('bots');
                }
              }}
            >
              <div style={{ fontSize: 20, color: isDisabled ? '#3a3a4a' : '#4080ff', textShadow: isDisabled ? 'none' : '0 0 10px #2060e0', lineHeight: '1' }}>
                {count}
              </div>
              <div style={{ fontSize: 7, textAlign: 'center', lineHeight: '1.3' }}>{label}</div>
            </button>
          );
        })}
      </div>

      <div style={hint}>{t('press_number')}</div>

      {/* Confirm button */}
      <button
        onClick={() => {
          const effectiveBots = Math.min(botCount, 4 - hovered) as 0 | 1 | 2 | 3;
          onSelect(hovered, effectiveBots);
          audioManager.play('sfx_menu_confirm');
        }}
        style={{
          fontSize: 12,
          padding: '12px 32px',
          background: 'linear-gradient(180deg, #3a1a0a 0%, #2a0a0a 100%)',
          color: '#ff8020',
          border: 'none',
          fontFamily: "'Press Start 2P', monospace",
          cursor: 'pointer',
          boxShadow: '0 0 16px #e06010, inset 0 0 0 2px #ff8020',
          textShadow: '0 0 8px #e06010',
        }}
      >
        {t('confirm')}
      </button>
    </div>
  );
}
