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
@keyframes pop-in {
  0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
  50%  { transform: scale(1.15) rotate(3deg); }
  70%  { transform: scale(0.92) rotate(-2deg); }
  85%  { transform: scale(1.04) rotate(0.5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes wiggle {
  0%, 100% { transform: rotate(-2deg) scale(1.06); }
  25%  { transform: rotate(2.5deg) scale(1.08); }
  50%  { transform: rotate(-1.5deg) scale(1.06); }
  75%  { transform: rotate(1.5deg) scale(1.07); }
}
@keyframes title-drop {
  0%   { transform: translateY(-50px) rotate(-5deg) scale(0.3); opacity: 0; }
  40%  { transform: translateY(6px) rotate(2deg) scale(1.08); }
  60%  { transform: translateY(-3px) rotate(-1deg) scale(0.97); }
  100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes bar-grow {
  0%   { width: 0%; }
  100% { width: var(--bar-w); }
}
@keyframes bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30%  { transform: translateY(-4px) rotate(1deg); }
  60%  { transform: translateY(-2px) rotate(-1deg); }
}
@keyframes countdown-tick {
  0%   { transform: scale(1.3); opacity: 0.6; }
  30%  { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes countdown-urgent {
  0%, 100% { transform: scale(1) rotate(0deg); color: #ff3030; }
  25%  { transform: scale(1.15) rotate(-3deg); }
  50%  { transform: scale(1) rotate(0deg); }
  75%  { transform: scale(1.15) rotate(3deg); }
}
@keyframes rival-flash {
  0%, 100% { opacity: 0.8; }
  50%      { opacity: 1; }
}
@keyframes badge-pop {
  0%   { transform: scale(0); }
  60%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
`;

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
        <svg width="68" height="68" viewBox="0 0 56 56">
          {/* Rear wing */}
          <rect x="10" y="44" width="36" height="5" rx="2" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <rect x="8" y="42" width="4" height="8" rx="1" fill={color} />
          <rect x="44" y="42" width="4" height="8" rx="1" fill={color} />
          {/* Fat wheels */}
          <rect x="8" y="12" width="8" height="14" rx="3" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <rect x="40" y="12" width="8" height="14" rx="3" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <rect x="8" y="34" width="8" height="14" rx="3" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <rect x="40" y="34" width="8" height="14" rx="3" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          {/* Body */}
          <rect x="17" y="8" width="22" height="40" rx="5" fill={color} stroke="#000" strokeWidth="2.5" />
          {/* Nose */}
          <polygon points="28,1 19,14 37,14" fill={color} stroke="#000" strokeWidth="2.5" />
          {/* Front wing */}
          <rect x="10" y="10" width="36" height="3" rx="1" fill="#808898" />
          {/* Side pods */}
          <ellipse cx="18" cy="32" rx="4" ry="8" fill={color} opacity="0.7" />
          <ellipse cx="38" cy="32" rx="4" ry="8" fill={color} opacity="0.7" />
          {/* Helmet */}
          <ellipse cx="28" cy="22" rx="7" ry="8" fill="#1a1a3a" stroke="#000" strokeWidth="1.5" />
          <ellipse cx="28" cy="20" rx="5" ry="4" fill="#4060a0" />
          <circle cx="25" cy="18" r="1.5" fill="#fff" opacity="0.5" />
          {/* Number */}
          <circle cx="28" cy="34" r="4" fill="#fff" />
          {/* Exhaust */}
          <circle cx="25" cy="49" r="2" fill="#808898" />
          <circle cx="31" cy="49" r="2" fill="#808898" />
        </svg>
      );
    case 'yeti':
      return (
        <svg width="68" height="68" viewBox="0 0 56 56">
          {/* Monster truck wheels */}
          <circle cx="8" cy="18" r="7" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <circle cx="48" cy="18" r="7" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <circle cx="8" cy="40" r="7" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <circle cx="48" cy="40" r="7" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
          <circle cx="8" cy="18" r="3" fill="#3a3a4a" />
          <circle cx="48" cy="18" r="3" fill="#3a3a4a" />
          <circle cx="8" cy="40" r="3" fill="#3a3a4a" />
          <circle cx="48" cy="40" r="3" fill="#3a3a4a" />
          {/* Round body */}
          <rect x="12" y="10" width="32" height="38" rx="8" fill={color} stroke="#000" strokeWidth="2.5" />
          {/* Fur tufts */}
          {[14,42,20,36].map((x, i) => <circle key={i} cx={x} cy={i < 2 ? 10 : 50} r="3" fill="#fff" opacity="0.3" />)}
          {/* Belly */}
          <ellipse cx="28" cy="34" rx="10" ry="12" fill="#fff" opacity="0.25" />
          {/* Horns */}
          <path d="M 18 14 L 10 4 L 14 10" fill="none" stroke="#c0a060" strokeWidth="3" strokeLinecap="round" />
          <path d="M 38 14 L 46 4 L 42 10" fill="none" stroke="#c0a060" strokeWidth="3" strokeLinecap="round" />
          {/* Snout */}
          <ellipse cx="28" cy="26" rx="6" ry="4" fill="#e0d0c0" />
          <ellipse cx="28" cy="24" rx="3" ry="2" fill="#404060" />
          {/* Tooth */}
          <polygon points="26,28 28,32 30,28" fill="#fff" />
          {/* Eyes */}
          <circle cx="22" cy="20" r="4" fill="#fff" />
          <circle cx="34" cy="20" r="4" fill="#fff" />
          <circle cx="22.5" cy="20" r="2" fill="#1a1a2e" />
          <circle cx="34.5" cy="20" r="2" fill="#1a1a2e" />
          {/* Rosy cheeks */}
          <ellipse cx="17" cy="24" rx="3.5" ry="2" fill="#ff6080" opacity="0.3" />
          <ellipse cx="39" cy="24" rx="3.5" ry="2" fill="#ff6080" opacity="0.3" />
        </svg>
      );
    case 'cat':
      return (
        <svg width="68" height="68" viewBox="0 0 56 56">
          {/* Tail */}
          <path d="M 42 42 Q 52 34 50 22 Q 49 16 44 18" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
          <path d="M 42 42 Q 52 34 50 22 Q 49 16 44 18" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
          {/* Paws */}
          {[16, 24, 32, 40].map((x, i) => <circle key={i} cx={x} cy="48" r="4" fill={color} opacity="0.8" />)}
          <circle cx="16" cy="49" r="1.5" fill="#ffaaaa" />
          <circle cx="40" cy="49" r="1.5" fill="#ffaaaa" />
          {/* Body */}
          <ellipse cx="28" cy="34" rx="18" ry="16" fill={color} stroke="#000" strokeWidth="2.5" />
          {/* Belly */}
          <ellipse cx="28" cy="38" rx="10" ry="10" fill="#fff" opacity="0.3" />
          {/* Tabby stripes */}
          {[26, 31, 36].map((y, i) => <path key={i} d={`M 20 ${y} Q 28 ${y-2} 36 ${y}`} fill="none" stroke="#000" strokeWidth="1.5" opacity="0.15" />)}
          {/* Left ear */}
          <polygon points="13,22 8,2 24,18" fill={color} stroke="#000" strokeWidth="2" />
          <polygon points="14,20 11,6 22,18" fill="#ff9999" />
          {/* Right ear */}
          <polygon points="43,22 48,2 32,18" fill={color} stroke="#000" strokeWidth="2" />
          <polygon points="42,20 45,6 34,18" fill="#ff9999" />
          {/* Eyes */}
          <circle cx="22" cy="24" r="4" fill="#fff" />
          <circle cx="34" cy="24" r="4" fill="#fff" />
          <circle cx="22.5" cy="24" r="2" fill="#1a1a2e" />
          <circle cx="34.5" cy="24" r="2" fill="#1a1a2e" />
          {/* Nose */}
          <polygon points="28,27 25,30 31,30" fill="#ff8090" />
          {/* Whiskers */}
          <line x1="5" y1="26" x2="20" y2="29" stroke="#808090" strokeWidth="1.5" />
          <line x1="4" y1="30" x2="20" y2="31" stroke="#808090" strokeWidth="1.5" />
          <line x1="5" y1="34" x2="20" y2="33" stroke="#808090" strokeWidth="1.5" />
          <line x1="36" y1="29" x2="51" y2="26" stroke="#808090" strokeWidth="1.5" />
          <line x1="36" y1="31" x2="52" y2="30" stroke="#808090" strokeWidth="1.5" />
          <line x1="36" y1="33" x2="51" y2="34" stroke="#808090" strokeWidth="1.5" />
          {/* W-mouth */}
          <path d="M 23 32 Q 25.5 35 28 32 Q 30.5 35 33 32" fill="none" stroke="#303040" strokeWidth="1.5" />
          {/* Rosy cheeks */}
          <ellipse cx="15" cy="28" rx="4" ry="2.5" fill="#ff6080" opacity="0.3" />
          <ellipse cx="41" cy="28" rx="4" ry="2.5" fill="#ff6080" opacity="0.3" />
        </svg>
      );
    case 'pig':
      return (
        <svg width="68" height="68" viewBox="0 0 56 56">
          {/* Curly tail */}
          <path d="M 42 40 C 54 38 52 28 46 32 C 52 24 48 20 44 24" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <path d="M 42 40 C 54 38 52 28 46 32 C 52 24 48 20 44 24" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
          {/* Hooves */}
          <ellipse cx="18" cy="50" rx="4" ry="3" fill="#8a5030" />
          <ellipse cx="38" cy="50" rx="4" ry="3" fill="#8a5030" />
          {/* BIG round body */}
          <ellipse cx="28" cy="32" rx="20" ry="18" fill={color} stroke="#000" strokeWidth="2.5" />
          {/* Belly */}
          <ellipse cx="28" cy="36" rx="12" ry="10" fill="#fff" opacity="0.15" />
          {/* Left ear */}
          <ellipse cx="14" cy="16" rx="8" ry="10" fill={color} stroke="#000" strokeWidth="2" transform="rotate(-30 14 16)" />
          <ellipse cx="14" cy="16" rx="5" ry="7" fill="#e0607a" transform="rotate(-30 14 16)" />
          {/* Right ear */}
          <ellipse cx="42" cy="16" rx="8" ry="10" fill={color} stroke="#000" strokeWidth="2" transform="rotate(30 42 16)" />
          <ellipse cx="42" cy="16" rx="5" ry="7" fill="#e0607a" transform="rotate(30 42 16)" />
          {/* Eyes */}
          <circle cx="22" cy="24" r="4" fill="#fff" />
          <circle cx="34" cy="24" r="4" fill="#fff" />
          <circle cx="22.5" cy="24" r="2" fill="#1a1a2e" />
          <circle cx="34.5" cy="24" r="2" fill="#1a1a2e" />
          {/* Big snout */}
          <ellipse cx="28" cy="32" rx="9" ry="6" fill="#e0607a" stroke="#000" strokeWidth="1.5" />
          <ellipse cx="24" cy="32" rx="2.5" ry="2" fill="#903050" />
          <ellipse cx="32" cy="32" rx="2.5" ry="2" fill="#903050" />
          {/* Smile */}
          <path d="M 22 37 Q 28 41 34 37" fill="none" stroke="#903050" strokeWidth="1.5" />
          {/* Rosy cheeks */}
          <ellipse cx="14" cy="28" rx="4.5" ry="2.5" fill="#ff6080" opacity="0.3" />
          <ellipse cx="42" cy="28" rx="4.5" ry="2.5" fill="#ff6080" opacity="0.3" />
        </svg>
      );
    case 'frog':
      return (
        <svg width="68" height="68" viewBox="0 0 56 56">
          {/* Webbed feet */}
          {[12, 44].map((x, i) => (
            <g key={i} transform={`translate(${x}, 48) rotate(${i === 0 ? -15 : 15})`}>
              <ellipse cx="-4" cy="0" rx="2.5" ry="4" fill={color} opacity="0.7" />
              <ellipse cx="0" cy="0" rx="2.5" ry="4" fill={color} opacity="0.7" />
              <ellipse cx="4" cy="0" rx="2.5" ry="4" fill={color} opacity="0.7" />
            </g>
          ))}
          {/* Wide body */}
          <ellipse cx="28" cy="36" rx="20" ry="14" fill={color} stroke="#000" strokeWidth="2.5" />
          {/* Lighter belly */}
          <ellipse cx="28" cy="39" rx="14" ry="9" fill="#fff" opacity="0.3" />
          {/* Spots */}
          <circle cx="18" cy="30" r="4" fill="#000" opacity="0.1" />
          <circle cx="38" cy="30" r="3.5" fill="#000" opacity="0.1" />
          <circle cx="28" cy="28" r="3" fill="#000" opacity="0.1" />
          {/* Eye bumps (aligned with center) */}
          <circle cx="22" cy="18" r="8" fill={color} stroke="#000" strokeWidth="2" />
          <circle cx="34" cy="18" r="8" fill={color} stroke="#000" strokeWidth="2" />
          {/* Eyes */}
          <circle cx="22" cy="18" r="5" fill="#fff" />
          <circle cx="34" cy="18" r="5" fill="#fff" />
          <circle cx="22.5" cy="18" r="2.5" fill="#1a1a2e" />
          <circle cx="34.5" cy="18" r="2.5" fill="#1a1a2e" />
          {/* Nostrils */}
          <circle cx="24" cy="32" r="1.5" fill="#1a4a1a" />
          <circle cx="32" cy="32" r="1.5" fill="#1a4a1a" />
          {/* Big smile */}
          <path d="M 12 38 Q 28 50 44 38" fill="none" stroke="#1a4a1a" strokeWidth="2.5" strokeLinecap="round" />
          {/* Tongue */}
          <ellipse cx="28" cy="44" rx="4" ry="3" fill="#ff6070" />
          {/* Rosy cheeks */}
          <ellipse cx="12" cy="36" rx="4" ry="2.5" fill="#ff6080" opacity="0.3" />
          <ellipse cx="44" cy="36" rx="4" ry="2.5" fill="#ff6080" opacity="0.3" />
          {/* Front legs */}
          <ellipse cx="10" cy="42" rx="4" ry="3" fill={color} />
          <ellipse cx="46" cy="42" rx="4" ry="3" fill={color} />
        </svg>
      );
    case 'toilet':
      return (
        <svg width="68" height="68" viewBox="0 0 56 56">
          {/* Wheels */}
          {[[14,10],[42,10],[14,48],[42,48]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="4.5" fill="#2a2a3a" stroke="#000" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="2" fill="#666680" />
            </g>
          ))}
          {/* Tank */}
          <rect x="16" y="36" width="24" height="16" rx="4" fill={color} opacity="0.85" stroke="#000" strokeWidth="2" />
          <rect x="18" y="38" width="8" height="12" rx="2" fill="#fff" opacity="0.2" />
          {/* Flush handle */}
          <path d="M 36 40 L 44 36" fill="none" stroke="#808898" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="44" cy="36" r="2.5" fill="#a0a8b8" stroke="#000" strokeWidth="1" />
          {/* Bowl */}
          <ellipse cx="28" cy="22" rx="16" ry="18" fill={color} stroke="#000" strokeWidth="2.5" />
          {/* Gleam */}
          <ellipse cx="20" cy="14" rx="5" ry="8" fill="#fff" opacity="0.25" transform="rotate(-15 20 14)" />
          {/* Seat ring */}
          <ellipse cx="28" cy="20" rx="11" ry="13" fill="none" stroke={color} strokeWidth="3.5" opacity="0.7" />
          {/* Water */}
          <ellipse cx="28" cy="20" rx="8" ry="9" fill="#5090d0" opacity="0.5" />
          {/* Bubbles */}
          <circle cx="24" cy="17" r="1.5" fill="#a0d8ff" opacity="0.7" />
          <circle cx="30" cy="15" r="1" fill="#a0d8ff" opacity="0.7" />
          <circle cx="32" cy="20" r="1.2" fill="#a0d8ff" opacity="0.7" />
          {/* Splash drops */}
          <circle cx="22" cy="8" r="1.5" fill="#80d0ff" opacity="0.7" />
          <circle cx="28" cy="5" r="2" fill="#80d0ff" opacity="0.7" />
          <circle cx="34" cy="8" r="1.5" fill="#80d0ff" opacity="0.7" />
          <circle cx="25" cy="3" r="1" fill="#80d0ff" opacity="0.7" />
          {/* Lid edge */}
          <ellipse cx="28" cy="34" rx="12" ry="3" fill={color} opacity="0.9" />
          {/* Eyes */}
          <circle cx="22" cy="20" r="3.5" fill="#fff" />
          <circle cx="34" cy="20" r="3.5" fill="#fff" />
          <circle cx="22.5" cy="20" r="1.8" fill="#1a1a2e" />
          <circle cx="34.5" cy="20" r="1.8" fill="#1a1a2e" />
          {/* Rosy cheeks */}
          <ellipse cx="16" cy="24" rx="3" ry="2" fill="#ff6080" opacity="0.3" />
          <ellipse cx="40" cy="24" rx="3" ry="2" fill="#ff6080" opacity="0.3" />
        </svg>
      );
    default:
      return (
        <svg width="68" height="68" viewBox="0 0 56 56">
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
      <div style={{ fontSize: 7, width: 56, textAlign: 'right', color: '#8888a0', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{
        flex: 1,
        height: 10,
        background: '#1a1228',
        borderRadius: 5,
        overflow: 'hidden',
        boxShadow: 'inset 0 2px 4px #00000040',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 5,
          background: `linear-gradient(180deg, ${color} 0%, ${color}a0 100%)`,
          boxShadow: `inset 0 1px 0 ${color}60, 0 0 8px ${color}30`,
          animation: 'bar-grow 0.6s ease-out both',
          // @ts-expect-error CSS custom property
          '--bar-w': `${pct}%`,
        }} />
      </div>
    </div>
  );
}

const PLAYER_COLORS = ['#ff6060', '#50a0ff', '#50d060', '#f0c030'];
const PLAYER_GLOWS = ['#e0302060', '#2070e060', '#20a03060', '#c0900060'];

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

  const submitAll = useCallback(() => {
    const humanPicks = new Set<string>();
    const chars: string[] = [];
    for (let i = 0; i < playerCount; i++) {
      const id = characters[indices[i]].id;
      chars.push(id);
      humanPicks.add(id);
    }
    const available = characters.filter(c => !humanPicks.has(c.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    let botIdx = 0;
    for (let i = playerCount; i < playerCount + botCount && i < 4; i++) {
      if (botIdx < shuffled.length) {
        chars.push(shuffled[botIdx].id);
        botIdx++;
      } else {
        chars.push(characters[(i * 2 + 1) % characters.length].id);
      }
    }
    while (chars.length < 4) {
      chars.push(characters[(chars.length * 2) % characters.length].id);
    }
    onConfirm(chars[0], chars[1], chars[2], chars[3]);
  }, [indices, playerCount, botCount, onConfirm]);

  useEffect(() => {
    if (countdown === 0) submitAll();
  }, [countdown, submitAll]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        audioManager.play('sfx_menu_confirm');
        submitAll();
        return;
      }
      if (e.key === 'ArrowLeft') { setPlayerIndex(0, (i) => (i - 1 + characters.length) % characters.length); audioManager.play('sfx_menu_move'); }
      else if (e.key === 'ArrowRight') { setPlayerIndex(0, (i) => (i + 1) % characters.length); audioManager.play('sfx_menu_move'); }
      if (playerCount >= 2) {
        if (e.key === 'a' || e.key === 'A') { setPlayerIndex(1, (i) => (i - 1 + characters.length) % characters.length); audioManager.play('sfx_menu_move'); }
        else if (e.key === 'd' || e.key === 'D') { setPlayerIndex(1, (i) => (i + 1) % characters.length); audioManager.play('sfx_menu_move'); }
      }
      if (playerCount >= 3) {
        if (e.key === 'j' || e.key === 'J') { setPlayerIndex(2, (i) => (i - 1 + characters.length) % characters.length); audioManager.play('sfx_menu_move'); }
        else if (e.key === 'l' || e.key === 'L') { setPlayerIndex(2, (i) => (i + 1) % characters.length); audioManager.play('sfx_menu_move'); }
      }
      if (playerCount >= 4) {
        if (e.code === 'Numpad4') { setPlayerIndex(3, (i) => (i - 1 + characters.length) % characters.length); audioManager.play('sfx_menu_move'); }
        else if (e.code === 'Numpad6') { setPlayerIndex(3, (i) => (i + 1) % characters.length); audioManager.play('sfx_menu_move'); }
      }
      if (e.key === 'Escape') onBack();
    },
    [playerCount, onBack, submitAll],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const getDuplicateSet = () => {
    const seen = new Map<number, number[]>();
    for (let i = 0; i < playerCount; i++) {
      const idx = indices[i];
      if (!seen.has(idx)) seen.set(idx, []);
      seen.get(idx)!.push(i);
    }
    const dupes = new Set<number>();
    for (const [, pIdxs] of seen) {
      if (pIdxs.length > 1) for (const p of pIdxs) dupes.add(p);
    }
    return dupes;
  };

  const duplicateSet = getDuplicateSet();
  const compact = playerCount > 2;

  function renderPlayerSection(playerNum: number) {
    const pIdx = playerNum - 1;
    const selectedIndex = indices[pIdx];
    const isRival = duplicateSet.has(pIdx) && pIdx > 0;
    const pColor = PLAYER_COLORS[pIdx];
    const pGlow = PLAYER_GLOWS[pIdx];

    const labelText = playerCount === 1
      ? t('character_select')
      : t(`character_select_p${playerNum}` as any);

    return (
      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 4 : 8,
      }}>
        {/* Player label */}
        <div style={{
          fontSize: compact ? 8 : 10,
          color: pColor,
          textAlign: 'center',
          textShadow: `0 0 12px ${pGlow}`,
          letterSpacing: 1,
        }}>
          {labelText}
        </div>

        {/* Character cards row */}
        <div style={{
          display: 'flex',
          gap: compact ? 6 : 8,
          justifyContent: 'center',
          flexWrap: 'nowrap',
          overflowX: 'hidden',
          maxWidth: '100%',
          padding: '4px 0',
        }}>
          {characters.map((char, i) => {
            const isSelected = i === selectedIndex;
            const cardColor = isRival && isSelected ? char.rivalColor : char.primaryColor;
            const cardW = compact ? 72 : (playerCount === 2 ? 76 : 74);
            const cardH = compact ? 88 : 100;
            return (
              <button
                key={char.id}
                onClick={() => { audioManager.play('sfx_menu_move'); setPlayerIndex(pIdx, () => i); }}
                style={{
                  width: cardW,
                  height: cardH,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: compact ? 2 : 4,
                  padding: compact ? 4 : 6,
                  background: isSelected
                    ? `radial-gradient(ellipse at 50% 40%, ${cardColor}25 0%, #1a1228 100%)`
                    : 'radial-gradient(ellipse at 50% 40%, #22203a 0%, #14121e 100%)',
                  border: 'none',
                  borderRadius: 20,
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#e8e8f0',
                  cursor: 'pointer',
                  animation: `pop-in 0.4s ease-out ${i * 0.05}s both${isSelected ? ', wiggle 1.5s ease-in-out infinite' : ''}`,
                  boxShadow: isSelected
                    ? `0 5px 20px ${cardColor}50, 0 0 0 3px ${cardColor}, inset 0 -3px 0 ${cardColor}30`
                    : '0 3px 10px #00000050, 0 0 0 2px #2a283a, inset 0 -3px 0 #0e0c16',
                  flexShrink: 0,
                }}
              >
                <div style={{ animation: isSelected ? 'bob 2s ease-in-out infinite' : undefined }}>
                  <CarIcon char={char} isRival={isRival && isSelected} />
                </div>
                <div style={{
                  fontSize: compact ? 6 : 7,
                  textAlign: 'center',
                  lineHeight: '1.4',
                  color: isSelected ? '#e8e8f0' : '#6a6a80',
                  minHeight: compact ? 8 : 12,
                }}>
                  {t(char.name)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Stats for selected character */}
        {!compact && (
          <div style={{
            width: '100%',
            maxWidth: 300,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '2px 8px',
          }}>
            <StatBar label={t('stat_speed')} value={characters[selectedIndex].maxSpeed} max={SPEED_MAX} color="#40d0e0" />
            <StatBar label={t('stat_handling')} value={characters[selectedIndex].handling} max={HANDLING_MAX} color="#50d060" />
            <StatBar label={t('stat_weight')} value={characters[selectedIndex].weight} max={WEIGHT_MAX} color="#e08030" />
          </div>
        )}

        {isRival && (
          <div style={{
            fontSize: 6,
            color: characters[selectedIndex].rivalColor,
            animation: 'rival-flash 1.5s ease infinite',
            padding: '3px 12px',
            borderRadius: 10,
            border: `2px solid ${characters[selectedIndex].rivalColor}50`,
            background: `${characters[selectedIndex].rivalColor}10`,
          }}>
            P{playerNum}: {t('rival_palette')}
          </div>
        )}
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
      background: 'radial-gradient(ellipse at 50% 30%, #2a1a3e 0%, #1a1228 40%, #0e0a18 100%)',
      padding: '8px',
      gap: compact ? 3 : 6,
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      <style>{keyframesStyle}</style>

      {/* Title */}
      <div style={{
        fontSize: compact ? 14 : 18,
        color: '#ffb040',
        textShadow: '0 3px 0 #8a3000, 0 0 16px #ff602060, -2px -2px 0 #c05010, 2px -2px 0 #c05010',
        animation: 'title-drop 0.7s ease-out both',
        textAlign: 'center',
        flexShrink: 0,
      }}>
        {t('character_select')}
      </div>

      {renderPlayerSection(1)}

      {playerCount >= 2 && (
        <>
          <div style={{ width: '70%', height: 2, borderRadius: 1, background: 'linear-gradient(90deg, transparent, #3a3050, transparent)', flexShrink: 0 }} />
          {renderPlayerSection(2)}
        </>
      )}

      {playerCount >= 3 && (
        <>
          <div style={{ width: '70%', height: 2, borderRadius: 1, background: 'linear-gradient(90deg, transparent, #3a3050, transparent)', flexShrink: 0 }} />
          {renderPlayerSection(3)}
        </>
      )}

      {playerCount >= 4 && (
        <>
          <div style={{ width: '70%', height: 2, borderRadius: 1, background: 'linear-gradient(90deg, transparent, #3a3050, transparent)', flexShrink: 0 }} />
          {renderPlayerSection(4)}
        </>
      )}

      {/* Bot slots */}
      {botCount > 0 && (
        <>
          <div style={{ width: '70%', height: 2, borderRadius: 1, background: 'linear-gradient(90deg, transparent, #3a3050, transparent)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Array.from({ length: botCount }, (_, i) => {
              const botSlot = playerCount + i;
              return (
                <div key={`bot-${i}`} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '8px 20px',
                  background: 'radial-gradient(ellipse at 50% 40%, #1a2040 0%, #0e1428 100%)',
                  borderRadius: 18,
                  boxShadow: '0 0 0 3px #3060a0, inset 0 -3px 0 #0a1020',
                  opacity: 0.75,
                  animation: `badge-pop 0.5s ease-out ${0.3 + i * 0.1}s both`,
                }}>
                  <div style={{ fontSize: 8, color: '#5090ff' }}>
                    {t('bot_label')} {i + 1}
                  </div>
                  <div style={{
                    fontSize: 18,
                    color: '#5090ff',
                    textShadow: '0 0 10px #3060c060',
                  }}>
                    P{botSlot + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Countdown */}
      <div style={{
        fontSize: compact ? 22 : 28,
        color: countdown <= 3 ? '#ff3030' : '#ffb040',
        textShadow: countdown <= 3
          ? '0 0 20px #ff303080, 0 3px 0 #801010'
          : '0 0 12px #ff802060, 0 3px 0 #8a3000',
        textAlign: 'center',
        animation: countdown <= 3 ? 'countdown-urgent 0.5s ease infinite' : 'countdown-tick 1s ease both',
        marginTop: compact ? 2 : 6,
      }}>
        {countdown}
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
          flexShrink: 0,
        }}
        onClick={onBack}
      >
        Esc
      </button>
    </div>
  );
}
