import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioManager } from '../game/audio';

interface Props {
  onSelect: (count: 1 | 2 | 3 | 4, botCount: 0 | 1 | 2 | 3) => void;
}

const keyframesStyle = `
@keyframes pop-in {
  0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
  50%  { transform: scale(1.15) rotate(3deg); }
  70%  { transform: scale(0.92) rotate(-2deg); }
  85%  { transform: scale(1.04) rotate(0.5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes wiggle {
  0%, 100% { transform: rotate(-2deg) scale(1.06); }
  25%  { transform: rotate(2deg) scale(1.08); }
  50%  { transform: rotate(-1.5deg) scale(1.06); }
  75%  { transform: rotate(1.5deg) scale(1.07); }
}
@keyframes title-drop {
  0%   { transform: translateY(-60px) rotate(-5deg) scale(0.3); opacity: 0; }
  40%  { transform: translateY(8px) rotate(2deg) scale(1.1); }
  60%  { transform: translateY(-4px) rotate(-1deg) scale(0.97); }
  80%  { transform: translateY(2px) rotate(0.5deg) scale(1.02); }
  100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes go-squish {
  0%, 100% { transform: scaleX(1) scaleY(1); }
  25%  { transform: scaleX(1.08) scaleY(0.94); }
  50%  { transform: scaleX(0.95) scaleY(1.06); }
  75%  { transform: scaleX(1.04) scaleY(0.97); }
}
@keyframes bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30%  { transform: translateY(-5px) rotate(1deg); }
  60%  { transform: translateY(-2px) rotate(-1deg); }
}
@keyframes eyes-blink {
  0%, 42%, 46%, 100% { transform: scaleY(1); }
  44% { transform: scaleY(0.1); }
}
@keyframes badge-pop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
`;

// Cute round robot with antenna, big eyes, rosy cheeks
function BotIcon({ count, selected }: { count: number; selected: boolean }) {
  if (count === 0) {
    // Sleeping bot — peaceful X eyes, Zzz
    return (
      <svg width="72" height="72" viewBox="0 0 72 72">
        {/* Body */}
        <ellipse cx="36" cy="40" rx="24" ry="22" fill={selected ? '#354568' : '#2a3450'} />
        {/* Belly highlight */}
        <ellipse cx="32" cy="36" rx="12" ry="10" fill="white" opacity="0.06" />
        {/* Antenna */}
        <line x1="36" y1="18" x2="36" y2="8" stroke={selected ? '#5090ff' : '#4a5a6a'} strokeWidth="3" strokeLinecap="round" />
        <circle cx="36" cy="6" r="4" fill={selected ? '#ff9030' : '#5a5a6a'} />
        {/* X eyes */}
        <g opacity="0.5">
          <line x1="24" y1="34" x2="30" y2="40" stroke="#8090b0" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="30" y1="34" x2="24" y2="40" stroke="#8090b0" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="42" y1="34" x2="48" y2="40" stroke="#8090b0" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="48" y1="34" x2="42" y2="40" stroke="#8090b0" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        {/* Zzz */}
        <text x="52" y="20" fill={selected ? '#80b0ff' : '#5a6a80'} fontSize="10" fontWeight="bold" fontFamily="sans-serif">Z</text>
        <text x="56" y="12" fill={selected ? '#80b0ff' : '#5a6a80'} fontSize="7" fontWeight="bold" fontFamily="sans-serif">z</text>
      </svg>
    );
  }

  // Active bots — cute round robots
  const botColors = ['#4090ff', '#50c8ff', '#7090ff'];
  const positions: Array<{ x: number; y: number; s: number }> =
    count === 1 ? [{ x: 36, y: 38, s: 1 }] :
    count === 2 ? [{ x: 22, y: 38, s: 0.75 }, { x: 50, y: 38, s: 0.75 }] :
    [{ x: 14, y: 40, s: 0.6 }, { x: 36, y: 36, s: 0.65 }, { x: 58, y: 40, s: 0.6 }];

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      {positions.map((pos, i) => {
        const c = botColors[i % 3];
        const r = 14 * pos.s;
        return (
          <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
            {/* Round body */}
            <ellipse cx="0" cy="0" rx={r} ry={r * 0.95} fill={c} />
            {/* Belly shine */}
            <ellipse cx={-r * 0.15} cy={-r * 0.15} rx={r * 0.45} ry={r * 0.35} fill="white" opacity="0.15" />
            {/* Antenna */}
            <line x1="0" y1={-r} x2="0" y2={-r * 1.5} stroke={c} strokeWidth={2 * pos.s} strokeLinecap="round" />
            <circle cx="0" cy={-r * 1.5} r={3 * pos.s} fill="#ff9030" />
            {/* Big eyes */}
            <g style={{ animation: selected ? 'eyes-blink 4s ease infinite' : undefined, transformOrigin: `0px ${-r * 0.1}px` }}>
              <ellipse cx={-r * 0.3} cy={-r * 0.1} rx={r * 0.25} ry={r * 0.3} fill="white" />
              <ellipse cx={r * 0.3} cy={-r * 0.1} rx={r * 0.25} ry={r * 0.3} fill="white" />
              <circle cx={-r * 0.25} cy={-r * 0.05} r={r * 0.12} fill="#1a1a2e" />
              <circle cx={r * 0.35} cy={-r * 0.05} r={r * 0.12} fill="#1a1a2e" />
              {/* Catchlights */}
              <circle cx={-r * 0.3} cy={-r * 0.15} r={r * 0.06} fill="white" opacity="0.8" />
              <circle cx={r * 0.3} cy={-r * 0.15} r={r * 0.06} fill="white" opacity="0.8" />
            </g>
            {/* Rosy cheeks */}
            <ellipse cx={-r * 0.55} cy={r * 0.15} rx={r * 0.18} ry={r * 0.12} fill="#ff6080" opacity="0.35" />
            <ellipse cx={r * 0.55} cy={r * 0.15} rx={r * 0.18} ry={r * 0.12} fill="#ff6080" opacity="0.35" />
            {/* Smile */}
            <path d={`M ${-r * 0.25} ${r * 0.25} Q 0 ${r * 0.5} ${r * 0.25} ${r * 0.25}`}
              fill="none" stroke="#1a1a2e" strokeWidth={1.5 * pos.s} strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

// Cute round cars with big googly eyes
function PlayerCarsIcon({ count, selected }: { count: number; selected: boolean }) {
  const carColors = ['#e04040', '#3888ff', '#40c860', '#e8c020'];
  const positions: Array<{ x: number; y: number; s: number; rot: number }> =
    count === 1 ? [{ x: 36, y: 36, s: 1, rot: 0 }] :
    count === 2 ? [{ x: 22, y: 36, s: 0.78, rot: -5 }, { x: 50, y: 36, s: 0.78, rot: 5 }] :
    count === 3 ? [{ x: 14, y: 38, s: 0.6, rot: -8 }, { x: 36, y: 34, s: 0.65, rot: 0 }, { x: 58, y: 38, s: 0.6, rot: 8 }] :
    [{ x: 18, y: 26, s: 0.55, rot: -6 }, { x: 54, y: 26, s: 0.55, rot: 6 }, { x: 18, y: 50, s: 0.55, rot: -4 }, { x: 54, y: 50, s: 0.55, rot: 4 }];

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      {positions.map((pos, i) => {
        const color = carColors[i];
        const r = 12 * pos.s;
        return (
          <g key={i} transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rot})`}>
            {/* Car body — rounded blob */}
            <ellipse cx="0" cy="0" rx={r * 1.3} ry={r} fill={color} />
            {/* Roof bump */}
            <ellipse cx="0" cy={-r * 0.6} rx={r * 0.7} ry={r * 0.5} fill={color} />
            {/* Windshield */}
            <ellipse cx={r * 0.1} cy={-r * 0.55} rx={r * 0.45} ry={r * 0.3} fill="#80d8ff" opacity="0.5" />
            {/* Highlight */}
            <ellipse cx={-r * 0.4} cy={-r * 0.3} rx={r * 0.35} ry={r * 0.2} fill="white" opacity="0.2" transform={`rotate(-15)`} />
            {/* Wheels */}
            <ellipse cx={-r * 1.0} cy={r * 0.7} rx={r * 0.35} ry={r * 0.4} fill="#2a2a3a" />
            <ellipse cx={r * 1.0} cy={r * 0.7} rx={r * 0.35} ry={r * 0.4} fill="#2a2a3a" />
            {/* Big googly eyes */}
            <g style={{ animation: selected ? 'eyes-blink 3.5s ease infinite' : undefined, transformOrigin: `0px ${-r * 0.15}px` }}>
              <circle cx={-r * 0.4} cy={-r * 0.1} r={r * 0.3} fill="white" />
              <circle cx={r * 0.4} cy={-r * 0.1} r={r * 0.3} fill="white" />
              <circle cx={-r * 0.32} cy={-r * 0.05} r={r * 0.15} fill="#1a1a2e" />
              <circle cx={r * 0.48} cy={-r * 0.05} r={r * 0.15} fill="#1a1a2e" />
              {/* Catchlights */}
              <circle cx={-r * 0.42} cy={-r * 0.18} r={r * 0.07} fill="white" opacity="0.9" />
              <circle cx={r * 0.38} cy={-r * 0.18} r={r * 0.07} fill="white" opacity="0.9" />
            </g>
            {/* Smile */}
            {selected && (
              <path d={`M ${-r * 0.3} ${r * 0.25} Q 0 ${r * 0.55} ${r * 0.3} ${r * 0.25}`}
                fill="none" stroke="#1a1a2e" strokeWidth={1.5 * pos.s} strokeLinecap="round" opacity="0.7" />
            )}
            {/* Rosy cheeks */}
            <ellipse cx={-r * 0.75} cy={r * 0.15} rx={r * 0.18} ry={r * 0.12} fill="#ff6080" opacity="0.3" />
            <ellipse cx={r * 0.75} cy={r * 0.15} rx={r * 0.18} ry={r * 0.12} fill="#ff6080" opacity="0.3" />
          </g>
        );
      })}
    </svg>
  );
}

export default function PlayerCountSelect({ onSelect }: Props) {
  const { t } = useTranslation();
  const [playerCount, setPlayerCount] = useState<1 | 2 | 3 | 4>(1);
  const [botCount, setBotCount] = useState<0 | 1 | 2 | 3>(0);

  const maxPlayers = (4 - botCount) as 1 | 2 | 3 | 4;

  useEffect(() => {
    if (playerCount > maxPlayers) {
      setPlayerCount(maxPlayers);
    }
  }, [botCount, playerCount, maxPlayers]);

  const totalRacers = playerCount + botCount;

  const botOptions: Array<{ count: 0 | 1 | 2 | 3; label: string }> = [
    { count: 0, label: t('bot_count_0') },
    { count: 1, label: t('bot_count_1') },
    { count: 2, label: t('bot_count_2') },
    { count: 3, label: t('bot_count_3') },
  ];

  const playerOptions: Array<{ count: 1 | 2 | 3 | 4; label: string }> = [
    { count: 1, label: t('one_player') },
    { count: 2, label: t('two_players') },
    { count: 3, label: t('three_players') },
    { count: 4, label: t('four_players') },
  ];

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
      gap: 14,
      padding: 16,
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      <style>{keyframesStyle}</style>

      {/* Title — big, tilted, comic-style */}
      <div style={{
        fontSize: 24,
        color: '#ffb040',
        textShadow: '0 4px 0 #8a3000, 0 0 20px #ff602080, -2px -2px 0 #c05010, 2px -2px 0 #c05010',
        animation: 'title-drop 0.8s ease-out both',
        textAlign: 'center',
        letterSpacing: 2,
        lineHeight: 1.3,
      }}>
        {t('select_mode')}
      </div>

      {/* === BOT SECTION === */}
      <div style={{
        fontSize: 12,
        color: '#7080b0',
        textAlign: 'center',
        letterSpacing: 3,
        textTransform: 'uppercase',
      }}>
        {t('bot_opponents')}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {botOptions.map(({ count, label }, idx) => {
          const isSelected = botCount === count;
          return (
            <button
              key={`bot-${count}`}
              onClick={() => { audioManager.play('sfx_menu_move'); setBotCount(count); }}
              style={{
                width: 96,
                height: 108,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: isSelected
                  ? 'radial-gradient(ellipse at 50% 40%, #1a2a50 0%, #0e1830 100%)'
                  : 'radial-gradient(ellipse at 50% 40%, #22223a 0%, #16162a 100%)',
                border: 'none',
                borderRadius: 24,
                cursor: 'pointer',
                fontFamily: "'Press Start 2P', monospace",
                color: '#e8e8f0',
                animation: `pop-in 0.6s ease-out ${idx * 0.08}s both${isSelected ? ', wiggle 1.5s ease-in-out infinite' : ''}`,
                boxShadow: isSelected
                  ? '0 6px 24px #3060c080, 0 0 0 4px #5090ff, inset 0 -4px 0 #1a2040'
                  : '0 4px 12px #00000060, 0 0 0 3px #2a2a4a, inset 0 -4px 0 #10101a',
                padding: 6,
              }}
            >
              <div style={{ animation: isSelected ? 'bob 2.5s ease-in-out infinite' : undefined }}>
                <BotIcon count={count} selected={isSelected} />
              </div>
              <div style={{
                fontSize: 8,
                textAlign: 'center',
                lineHeight: '1.4',
                color: isSelected ? '#90c0ff' : '#6a6a80',
              }}>
                {label}
              </div>
            </button>
          );
        })}
      </div>

      {/* === PLAYER SECTION === */}
      <div style={{
        fontSize: 12,
        color: '#b08060',
        textAlign: 'center',
        letterSpacing: 3,
        textTransform: 'uppercase',
      }}>
        {t('select_players')}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {playerOptions.map(({ count, label }, idx) => {
          const isDisabled = count > maxPlayers;
          const isSelected = playerCount === count && !isDisabled;
          return (
            <button
              key={count}
              disabled={isDisabled}
              onClick={() => { if (!isDisabled) { audioManager.play('sfx_menu_move'); setPlayerCount(count); } }}
              style={{
                width: 96,
                height: 120,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: isDisabled
                  ? '#12121e'
                  : isSelected
                    ? 'radial-gradient(ellipse at 50% 40%, #3a1a0a 0%, #201008 100%)'
                    : 'radial-gradient(ellipse at 50% 40%, #2a2a3a 0%, #1a1a28 100%)',
                border: 'none',
                borderRadius: 24,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                fontFamily: "'Press Start 2P', monospace",
                color: isDisabled ? '#2a2a3a' : '#e8e8f0',
                animation: isDisabled
                  ? `pop-in 0.6s ease-out ${idx * 0.08}s both`
                  : `pop-in 0.6s ease-out ${idx * 0.08}s both${isSelected ? ', wiggle 1.5s ease-in-out infinite' : ''}`,
                boxShadow: isSelected
                  ? '0 6px 24px #e0601060, 0 0 0 4px #ff8020, inset 0 -4px 0 #401808'
                  : isDisabled
                    ? '0 0 0 3px #1a1a2a'
                    : '0 4px 12px #00000060, 0 0 0 3px #2a2a4a, inset 0 -4px 0 #10101a',
                padding: 6,
                opacity: isDisabled ? 0.25 : 1,
              }}
            >
              <div style={{ animation: isSelected ? 'bob 2s ease-in-out infinite' : undefined }}>
                <PlayerCarsIcon count={count} selected={isSelected} />
              </div>
              <div style={{
                fontSize: 24,
                color: isDisabled ? '#2a2a3a' : isSelected ? '#ffb040' : '#8888a0',
                textShadow: isSelected ? '0 3px 0 #8a3000, 0 0 16px #ff602060' : 'none',
                lineHeight: '1',
              }}>
                {count}
              </div>
              <div style={{
                fontSize: 7,
                textAlign: 'center',
                lineHeight: '1.4',
                color: isDisabled ? '#2a2a3a' : isSelected ? '#ffc070' : '#6a6a80',
              }}>
                {label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Racers badge — pill shape */}
      <div style={{
        fontSize: 10,
        color: '#b0a0c0',
        textAlign: 'center',
        background: 'rgba(30, 20, 50, 0.6)',
        padding: '6px 24px',
        borderRadius: 50,
        border: '2px solid #3a3050',
        animation: 'badge-pop 0.5s ease-out 0.5s both',
      }}>
        {t('total_racers', { count: totalRacers })}
      </div>

      {/* GO button — big, bubbly, inviting */}
      <button
        onClick={() => {
          const effectiveBots = Math.min(botCount, 4 - playerCount) as 0 | 1 | 2 | 3;
          onSelect(playerCount, effectiveBots);
          audioManager.play('sfx_menu_confirm');
        }}
        style={{
          fontSize: 20,
          padding: '16px 56px',
          background: 'linear-gradient(180deg, #ffb040 0%, #e06010 50%, #c04808 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 50,
          fontFamily: "'Press Start 2P', monospace",
          cursor: 'pointer',
          boxShadow: '0 8px 0 #803000, 0 10px 30px #e0601060, inset 0 3px 0 #ffd06060',
          textShadow: '0 2px 0 #803000',
          animation: 'go-squish 3s ease-in-out infinite, pop-in 0.6s ease-out 0.3s both',
          letterSpacing: 3,
          position: 'relative',
        }}
      >
        {t('confirm')}
      </button>
    </div>
  );
}
