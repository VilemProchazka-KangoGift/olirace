import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onSelect: (count: 1 | 2 | 3 | 4) => void;
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
  const [hovered, setHovered] = useState<1 | 2 | 3 | 4>(1);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '1') onSelect(1);
      else if (e.key === '2') onSelect(2);
      else if (e.key === '3') onSelect(3);
      else if (e.key === '4') onSelect(4);
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setHovered((h) => {
          if (h === null || h === 1) return 1;
          return (h - 1) as 1 | 2 | 3 | 4;
        });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setHovered((h) => {
          if (h === null || h === 4) return 4;
          return (h + 1) as 1 | 2 | 3 | 4;
        });
      } else if (e.key === 'Enter' || e.key === ' ') onSelect(hovered);
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
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  };

  function makeCardStyle(count: 1 | 2 | 3 | 4): React.CSSProperties {
    const isActive = hovered === count;
    return {
      width: 100,
      height: 160,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      background: isActive
        ? 'linear-gradient(180deg, #3a1a0a 0%, #2a0a0a 100%)'
        : 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2e 100%)',
      border: 'none',
      cursor: 'pointer',
      fontFamily: "'Press Start 2P', monospace",
      color: '#e8e8f0',
      animation: `card-appear 0.4s ease-out ${(count - 1) * 0.1}s both${isActive ? ', selected-glow 1.5s ease infinite' : ''}`,
      boxShadow: isActive
        ? '0 0 20px #e06010, inset 0 0 0 3px #ff8020'
        : 'inset 0 0 0 3px #3a3a4a',
      transition: 'background 0.2s, box-shadow 0.2s',
      padding: 12,
    };
  }

  const numberStyle: React.CSSProperties = {
    fontSize: 36,
    color: '#ff8020',
    textShadow: '0 0 20px #e06010',
    lineHeight: '1',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 7,
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
    fontSize: 7,
    color: '#666680',
    textAlign: 'center',
    marginTop: 8,
  };

  const options: Array<{ count: 1 | 2 | 3 | 4; label: string }> = [
    { count: 1, label: t('one_player') },
    { count: 2, label: t('two_players') },
    { count: 3, label: t('three_players') },
    { count: 4, label: t('four_players') },
  ];

  return (
    <div style={container}>
      <style>{keyframesStyle}</style>
      <div style={header}>{t('select_mode')}</div>
      <div style={cardsRow}>
        {options.map(({ count, label }) => (
          <button
            key={count}
            style={makeCardStyle(count)}
            onClick={() => onSelect(count)}
            onMouseEnter={() => setHovered(count)}
            onMouseLeave={() => {}}
          >
            {carIcon(count)}
            <div style={numberStyle}>{count}</div>
            <div style={labelStyle}>{label}</div>
          </button>
        ))}
      </div>
      <div style={hint}>{t('press_number')}</div>
    </div>
  );
}
