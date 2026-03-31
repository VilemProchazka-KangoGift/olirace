import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onSelect: (count: 1 | 2) => void;
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
`;

export default function PlayerCountSelect({ onSelect }: Props) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<1 | 2 | null>(null);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '1') onSelect(1);
      else if (e.key === '2') onSelect(2);
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setHovered(1);
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setHovered(2);
      else if (e.key === 'Enter' && hovered) onSelect(hovered);
    },
    [onSelect, hovered],
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
    gap: 40,
    padding: 20,
    userSelect: 'none',
  };

  const header: React.CSSProperties = {
    fontSize: 14,
    color: '#ff8020',
    textShadow: '0 0 10px #e06010',
    animation: 'header-slide 0.5s ease-out both',
    textAlign: 'center',
  };

  const cardsRow: React.CSSProperties = {
    display: 'flex',
    gap: 24,
    justifyContent: 'center',
    flexWrap: 'wrap',
  };

  function makeCardStyle(count: 1 | 2): React.CSSProperties {
    const isActive = hovered === count;
    return {
      width: 180,
      height: 220,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      background: isActive
        ? 'linear-gradient(180deg, #3a1a0a 0%, #2a0a0a 100%)'
        : 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2e 100%)',
      border: 'none',
      cursor: 'pointer',
      fontFamily: "'Press Start 2P', monospace",
      color: '#e8e8f0',
      animation: `card-appear 0.4s ease-out ${count === 2 ? '0.15s' : '0s'} both${isActive ? ', selected-glow 1.5s ease infinite' : ''}`,
      boxShadow: isActive
        ? '0 0 20px #e06010, inset 0 0 0 3px #ff8020'
        : 'inset 0 0 0 3px #3a3a4a',
      transition: 'background 0.2s, box-shadow 0.2s',
      padding: 20,
    };
  }

  const numberStyle: React.CSSProperties = {
    fontSize: 48,
    color: '#ff8020',
    textShadow: '0 0 20px #e06010',
    lineHeight: '1',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: '1.5',
  };

  // Pixel art car icon
  const carIcon = (count: 1 | 2) => {
    const cars = count === 1 ? ['#e02020'] : ['#e02020', '#2060e0'];
    return (
      <svg width="60" height="36" viewBox="0 0 60 36">
        {cars.map((color, i) => (
          <g key={i} transform={`translate(${count === 2 ? i * 26 : 14}, ${count === 2 ? i * 6 : 0})`}>
            <rect x="4" y="8" width="24" height="16" rx="2" fill={color} />
            <rect x="8" y="4" width="16" height="8" rx="1" fill={color} opacity="0.8" />
            <rect x="10" y="6" width="5" height="4" fill="#00e0e0" opacity="0.6" />
            <rect x="17" y="6" width="5" height="4" fill="#00e0e0" opacity="0.6" />
            <circle cx="8" cy="26" r="3" fill="#3a3a4a" />
            <circle cx="24" cy="26" r="3" fill="#3a3a4a" />
            <circle cx="8" cy="26" r="1.5" fill="#666680" />
            <circle cx="24" cy="26" r="1.5" fill="#666680" />
          </g>
        ))}
      </svg>
    );
  };

  const hint: React.CSSProperties = {
    fontSize: 7,
    color: '#666680',
    textAlign: 'center',
    marginTop: 8,
  };

  return (
    <div style={container}>
      <style>{keyframesStyle}</style>
      <div style={header}>{t('character_select').split(' ')[0] === 'Vyber' ? 'Vyber mód' : 'Select Mode'}</div>
      <div style={cardsRow}>
        <button
          style={makeCardStyle(1)}
          onClick={() => onSelect(1)}
          onMouseEnter={() => setHovered(1)}
          onMouseLeave={() => setHovered(null)}
        >
          {carIcon(1)}
          <div style={numberStyle}>1</div>
          <div style={labelStyle}>{t('one_player')}</div>
        </button>
        <button
          style={makeCardStyle(2)}
          onClick={() => onSelect(2)}
          onMouseEnter={() => setHovered(2)}
          onMouseLeave={() => setHovered(null)}
        >
          {carIcon(2)}
          <div style={numberStyle}>2</div>
          <div style={labelStyle}>{t('two_players')}</div>
        </button>
      </div>
      <div style={hint}>Press 1 or 2</div>
    </div>
  );
}
