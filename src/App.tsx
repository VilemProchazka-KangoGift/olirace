import { useState, useCallback, useRef, useEffect } from 'react';
import type { ScreenId, GameConfig, GameResults } from './types';
import TitleScreen from './screens/TitleScreen';
import PlayerCountSelect from './screens/PlayerCountSelect';
import TrackSelect from './screens/TrackSelect';
import CharacterSelect from './screens/CharacterSelect';
import GameScreen from './screens/GameScreen';
import ResultsScreen from './screens/ResultsScreen';

const TRANSITION_MS = 300;

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('title');
  const [config, setConfig] = useState<GameConfig>({
    playerCount: 1,
    trackId: 'sunday-drive',
    p1Character: 'formula',
    p2Character: 'cat',
  });
  const [results, setResults] = useState<GameResults | null>(null);
  const [visible, setVisible] = useState(true);
  const nextScreen = useRef<ScreenId | null>(null);

  const navigateTo = useCallback((target: ScreenId) => {
    setVisible(false);
    nextScreen.current = target;
  }, []);

  useEffect(() => {
    if (!visible && nextScreen.current) {
      const id = setTimeout(() => {
        setScreen(nextScreen.current!);
        nextScreen.current = null;
        setVisible(true);
      }, TRANSITION_MS);
      return () => clearTimeout(id);
    }
  }, [visible]);

  const goTitle = useCallback(() => navigateTo('title'), [navigateTo]);
  const goPlayerCount = useCallback(() => navigateTo('playerCount'), [navigateTo]);
  const goTrackSelect = useCallback(() => navigateTo('trackSelect'), [navigateTo]);
  const goCharacterSelect = useCallback(() => navigateTo('characterSelect'), [navigateTo]);
  const goGame = useCallback(() => navigateTo('game'), [navigateTo]);
  const goResults = useCallback(() => navigateTo('results'), [navigateTo]);

  const handlePlayerCount = useCallback(
    (count: 1 | 2) => {
      setConfig((c) => ({ ...c, playerCount: count }));
      navigateTo('trackSelect');
    },
    [navigateTo],
  );

  const handleTrackSelect = useCallback(
    (trackId: string) => {
      setConfig((c) => ({ ...c, trackId }));
      navigateTo('characterSelect');
    },
    [navigateTo],
  );

  const handleCharacterConfirm = useCallback(
    (p1: string, p2: string) => {
      setConfig((c) => ({ ...c, p1Character: p1, p2Character: p2 }));
      navigateTo('game');
    },
    [navigateTo],
  );

  const handleGameFinish = useCallback(
    (r: GameResults) => {
      setResults(r);
      navigateTo('results');
    },
    [navigateTo],
  );

  const handleRematch = useCallback(() => {
    navigateTo('game');
  }, [navigateTo]);

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a2e',
    overflow: 'hidden',
  };

  const innerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 480,
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    opacity: visible ? 1 : 0,
    transition: `opacity ${TRANSITION_MS}ms ease`,
  };

  function renderScreen() {
    switch (screen) {
      case 'title':
        return <TitleScreen onStart={goPlayerCount} />;
      case 'playerCount':
        return <PlayerCountSelect onSelect={handlePlayerCount} />;
      case 'trackSelect':
        return <TrackSelect onSelect={handleTrackSelect} onBack={goPlayerCount} />;
      case 'characterSelect':
        return (
          <CharacterSelect
            playerCount={config.playerCount}
            onConfirm={handleCharacterConfirm}
            onBack={goTrackSelect}
          />
        );
      case 'game':
        return (
          <GameScreen
            config={config}
            onFinish={handleGameFinish}
            onQuit={goTitle}
            onRestart={goGame}
          />
        );
      case 'results':
        return results ? (
          <ResultsScreen
            results={results}
            config={config}
            onRematch={handleRematch}
            onTrackSelect={goTrackSelect}
            onQuit={goTitle}
          />
        ) : null;
      default:
        return null;
    }
  }

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>{renderScreen()}</div>
    </div>
  );
}
