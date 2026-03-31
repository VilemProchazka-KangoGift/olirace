import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { audioManager } from '../game/audio';

interface Props {
  onStart: () => void;
}

const keyframesStyle = `
@keyframes lava-bg {
  0%   { background-position: 0% 0%; }
  50%  { background-position: 100% 100%; }
  100% { background-position: 0% 0%; }
}
@keyframes logo-pulse {
  0%, 100% { text-shadow: 0 0 10px #e06010, 0 0 20px #c0400a, 0 0 40px #8a2000; transform: scale(1); }
  50%      { text-shadow: 0 0 20px #ff8020, 0 0 40px #e06010, 0 0 60px #c0400a, 0 0 80px #8a2000; transform: scale(1.04); }
}
@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes fire-particle {
  0%   { transform: translateY(0) scale(1); opacity: 0.8; }
  100% { transform: translateY(-120px) scale(0); opacity: 0; }
}
@keyframes logo-slide-in {
  0%   { transform: translateY(-40px) scale(0.8); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes lang-glow {
  0%, 100% { box-shadow: inset 0 0 0 2px #666680; }
  50%      { box-shadow: inset 0 0 0 2px #e06010; }
}
`;

export default function TitleScreen({ onStart }: Props) {
  const { t, i18n } = useTranslation();

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      onStart();
    },
    [onStart],
  );

  const handleClick = useCallback(() => {
    onStart();
  }, [onStart]);

  useEffect(() => {
    audioManager.init();
    audioManager.playLoop('music_menu');
    window.addEventListener('keydown', handleKey);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', handleClick);
      audioManager.stop('music_menu');
    };
  }, [handleKey, handleClick]);

  const toggleLang = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = i18n.language === 'cs' ? 'en' : 'cs';
    i18n.changeLanguage(next);
  };

  const container: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    color: '#e8e8f0',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #2a0a0a 25%, #4a1500 50%, #2a0a0a 75%, #1a1a2e 100%)',
    backgroundSize: '400% 400%',
    animation: 'lava-bg 8s ease infinite',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const lavaOverlay: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    background: 'linear-gradient(to top, rgba(192, 64, 10, 0.25) 0%, transparent 100%)',
    pointerEvents: 'none',
  };

  const logoContainer: React.CSSProperties = {
    animation: 'logo-slide-in 0.8s ease-out both',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 2,
  };

  const logo: React.CSSProperties = {
    fontSize: 28,
    lineHeight: '1.5',
    textAlign: 'center',
    animation: 'logo-pulse 2.5s ease-in-out infinite',
    color: '#ff8020',
    letterSpacing: 2,
    padding: '0 20px',
  };

  const subtitle: React.CSSProperties = {
    fontSize: 9,
    color: '#e06010',
    marginTop: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.7,
  };

  const pressKey: React.CSSProperties = {
    fontSize: 10,
    marginTop: 80,
    animation: 'blink 1.2s step-end infinite',
    color: '#e8e8f0',
    zIndex: 2,
    textAlign: 'center',
    padding: '0 20px',
  };

  const langButton: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 8,
    padding: '6px 10px',
    background: '#1a1a2e',
    color: '#e8e8f0',
    border: 'none',
    fontFamily: "'Press Start 2P', monospace",
    cursor: 'pointer',
    animation: 'lang-glow 3s ease infinite',
    zIndex: 10,
  };

  // Decorative pixel art fire particles
  const particles = Array.from({ length: 12 }, (_, i) => {
    const left = 10 + (i * 7.5) % 80;
    const delay = (i * 0.45) % 4;
    const size = 3 + (i % 3) * 2;
    const duration = 2.5 + (i % 3) * 0.8;
    const color = ['#e02020', '#e06010', '#ff8020', '#e0c000'][(i % 4)];
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          bottom: -4,
          left: `${left}%`,
          width: size,
          height: size,
          background: color,
          animation: `fire-particle ${duration}s ease-out ${delay}s infinite`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    );
  });

  // Decorative road lines
  const roadDeco: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 4,
    height: '30%',
    background: 'repeating-linear-gradient(to top, #666680 0px, #666680 10px, transparent 10px, transparent 20px)',
    opacity: 0.15,
    pointerEvents: 'none',
  };

  return (
    <div style={container}>
      <style>{keyframesStyle}</style>
      <div style={lavaOverlay} />
      <div style={roadDeco} />
      {particles}

      <button
        style={langButton}
        onClick={toggleLang}
        aria-label={t('language')}
      >
        {i18n.language === 'cs' ? 'EN' : 'CZ'}
      </button>

      <div style={logoContainer}>
        <div style={logo}>{t('title')}</div>
        <div style={subtitle}>Racing Game</div>
      </div>

      <div style={pressKey}>{t('press_any_key')}</div>
    </div>
  );
}
