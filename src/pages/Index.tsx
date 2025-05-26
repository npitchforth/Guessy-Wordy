import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ProgressBar';
import WordDisplay from '@/components/WordDisplay';
import SpeechRecognition from '@/components/SpeechRecognition';
import { areHomonyms } from '@/data/homonyms';
import GameLog from '@/components/GameLog';
import GameOver from '@/components/GameOver';
import { useToast } from '@/hooks/use-toast';
import { SkipForward } from 'lucide-react';
import { words, Word } from '@/data/words';

interface GameLogEntry {
  word: string;
  userAnswer: string;
  isCorrect: boolean;
  timestamp: number;
  difficulty: string;
  attemptNumber: number;
  possibilities: Array<{
    word: string;
    confidence: number;
  }>;
}

const IndexPage: React.FC = () => {
  const { toast } = useToast();
  const isProcessingAttemptRef = useRef(false);

  // Duplicate/rapid-fire answer guard for speech results
  const processingWordRef = useRef<string | null>(null);

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [shuffledWords, setShuffledWords] = useState<Word[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [showLog, setShowLog] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [incorrectAttempts, setIncorrectAttempts] = useState<Record<string, number>>({});
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [isProcessingAttempt, setIsProcessingAttempt] = useState<boolean>(false);
  const [wordAttempts, setWordAttempts] = useState<Map<string, number>>(new Map());

  // Debug/developer Voice Recognition Status state
  const [recognitionStatus, setRecognitionStatus] = useState<string[]>([]);
  const addRecognitionStatus = useCallback((msg: string) => {
    setRecognitionStatus(prev => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 19) // last 20
    ]);
  }, []);

  const shuffleWords = useCallback(() => {
    const availableWords = words.filter(word => !usedWords.has(word.text));
    if (availableWords.length === 0) {
      setUsedWords(new Set());
      return [...words].sort(() => Math.random() - 0.5);
    }
    return [...availableWords].sort(() => Math.random() - 0.5);
  }, [usedWords]);

  useEffect(() => {
    if (gameActive && !gameOver) {
      setShuffledWords(shuffleWords());
      setCurrentWordIndex(0);
      setProgress(0);
      setIncorrectAttempts({});
      processingWordRef.current = null;
    }
  }, [gameActive, gameOver, shuffleWords]);

  const moveToNextWord = (correct: boolean) => {
    const currentWord = shuffledWords[currentWordIndex];

    // Batch all state updates together
    const nextIndex = currentWordIndex + 1;
    const isLastWord = nextIndex >= shuffledWords.length;

    // Create new state values
    const newUsedWords = new Set([...usedWords, currentWord.text]);
    const newProgress = isLastWord ? 100 : (nextIndex / shuffledWords.length) * 100;

    setUsedWords(newUsedWords);
    if (!isLastWord) {
      setCurrentWordIndex(nextIndex);
      setProgress(newProgress);
      processingWordRef.current = null; // Allow processing the next word's result
    } else {
      endGame();
    }
  };

  const handleSpeechResult = useCallback((transcript, alternatives) => {
    addRecognitionStatus(`Received transcript: "${transcript}"`);
    if (!gameActive || gameOver) {
      addRecognitionStatus('Game not active or already over, ignoring speech result.');
      return;
    }

    // Use a ref as the guard
    if (isProcessingAttemptRef.current) {
      addRecognitionStatus('isProcessingAttemptRef is true, aborting duplicate result.');
      return;
    }
    isProcessingAttemptRef.current = true;
    addRecognitionStatus('Locking isProcessingAttemptRef for result processing.');

    if (isProcessingAttempt) {
      addRecognitionStatus('isProcessingAttempt state is true, aborting duplicate result.');
      return;
    }
    setIsProcessingAttempt(true);

    const currentWord = shuffledWords[currentWordIndex];
    if (!currentWord) {
      setIsProcessingAttempt(false);
      isProcessingAttemptRef.current = false;
      addRecognitionStatus('No current word found.');
      return;
    }

    // Get current attempt count
    const currentAttempts = incorrectAttempts[currentWord.text] || 0;
    addRecognitionStatus(`Current attempts for "${currentWord.text}": ${currentAttempts}`);

    // Guard: Already at max attempts? Move on and block further processing
    if (currentAttempts >= 2) {
      setIsProcessingAttempt(false);
      isProcessingAttemptRef.current = false;
      addRecognitionStatus('Max attempts reached, moving to next word.');
      moveToNextWord(false);
      return;
    }

    // Get all words from the transcript and alternatives
    const wordsHeard = transcript.toLowerCase().trim().split(/\s+/);

    // Get all possible words from alternatives
    const allPossibleWords = new Set<string>();
    wordsHeard.forEach(word => allPossibleWords.add(word));

    // Always create a possibilities array, even if no alternatives were provided
    const possibilities = alternatives
      ? alternatives
          .filter(p => p.confidence > 0.1)
          .map(p => ({ word: p.transcript, confidence: p.confidence }))
      : [{ word: transcript, confidence: 1.0 }];

    // Add all alternatives to possible words
    if (alternatives) {
      alternatives.forEach(alt => {
        const altWords = alt.transcript.toLowerCase().trim().split(/\s+/);
        altWords.forEach(word => allPossibleWords.add(word));
      });
    }

    // Check each word against the target word
    const isCorrect = Array.from(allPossibleWords).some(word => {
      const targetWord = currentWord.text.toLowerCase();
      if (word === targetWord) return true;
      return areHomonyms(word, targetWord);
    });
    addRecognitionStatus(`Evaluating correctness: ${isCorrect ? 'Correct' : 'Incorrect'}`);

    // Calculate attempt number for logging
    const attemptNumber = currentAttempts + 1;
    addRecognitionStatus(`Attempt number for "${currentWord.text}": ${attemptNumber}`);

    if (attemptNumber > 2) {
      setIsProcessingAttempt(false);
      isProcessingAttemptRef.current = false;
      addRecognitionStatus('Attempt number > 2, should not log.');
      return;
    }

    // Log the question and answer with the full transcript
    const logEntry: GameLogEntry = {
      word: currentWord.text,
      userAnswer: transcript,
      isCorrect,
      timestamp: Date.now(),
      difficulty: currentWord.difficulty,
      attemptNumber,
      possibilities
    };
    setGameLog(prev => [...prev, logEntry]);
    addRecognitionStatus(`Logged attempt for "${currentWord.text}": Attempt ${attemptNumber}, Correct: ${isCorrect}`);

    // Enhanced logging
    console.log('Speech Recognition Result:', {
      targetWord: currentWord.text,
      fullTranscript: transcript,
      allWordsHeard: wordsHeard,
      allPossibleWords: Array.from(allPossibleWords),
      isCorrect,
      attemptNumber,
      currentAttempts,
      timestamp: new Date().toISOString(),
      wordMatches: Array.from(allPossibleWords).map(word => ({
        word,
        isMatch: word === currentWord.text.toLowerCase(),
        isHomophoneMatch: areHomonyms(word, currentWord.text.toLowerCase()),
        homophoneMapping: word
      })),
      possibilities,
      hasAlternatives: !!alternatives,
      alternativesCount: alternatives?.length || 0
    });

    setIsListening(false);
    setIsProcessing(false);

    // Show feedback
    toast({
      title: isCorrect ? "Correct!" : "Try Again!",
      description: isCorrect ? `Great job saying "${currentWord.text}"!` : `The word was "${currentWord.text}"`,
      className: isCorrect ? "bg-green-500 text-white" : "bg-orange-300",
    });

    // If correct, move to next word immediately and reset processing guard
    if (isCorrect) {
      addRecognitionStatus('Correct! Moving to next word.');
      moveToNextWord(true);
      setIsProcessingAttempt(false);
      isProcessingAttemptRef.current = false;
      return;
    }

    // If incorrect, update attempt count and check if we should move to next word
    setIncorrectAttempts(prev => {
      const newAttempts = { ...prev, [currentWord.text]: attemptNumber };
      if (attemptNumber >= 2) {
        addRecognitionStatus('Incorrect, last allowed attempt, moving to next word.');
        moveToNextWord(false);
      } else {
        addRecognitionStatus('Incorrect, try again for this word.');
      }
      return newAttempts;
    });

    setTimeout(() => {
      setIsProcessingAttempt(false);
      isProcessingAttemptRef.current = false;
      addRecognitionStatus('Unlocked result processing.');
    }, 500);
  }, [
    gameActive, gameOver, isProcessingAttempt, shuffledWords, currentWordIndex,
    incorrectAttempts, moveToNextWord, setIsListening, setIsProcessing, toast, addRecognitionStatus
  ]);

  const handleProcessingComplete = useCallback(() => {
    setIsProcessing(false);
    setIsProcessingAttempt(false);
    addRecognitionStatus('Processing complete.');
  }, [addRecognitionStatus]);

  const handleSkip = () => {
    if (!gameActive || gameOver) {
      addRecognitionStatus('Game not active or already over, skipping ignored.');
      return;
    }

    const currentWord = shuffledWords[currentWordIndex];

    // Calculate attempt number for skipped words
    const attemptNumber = (incorrectAttempts[currentWord.text] || 0) + 1;

    // Log skipped word
    const logEntry: GameLogEntry = {
      word: currentWord.text,
      userAnswer: 'SKIPPED',
      isCorrect: false,
      timestamp: Date.now(),
      difficulty: currentWord.difficulty,
      attemptNumber,
      possibilities: []
    };
    setGameLog(prev => [...prev, logEntry]);
    addRecognitionStatus(`Word skipped: "${currentWord.text}" (attempt ${attemptNumber})`);

    toast({
      title: "Word Skipped",
      description: `The word was "${currentWord.text}"`,
      className: "bg-blue-300",
    });

    setUsedWords(prev => new Set([...prev, currentWord.text]));

    if (currentWordIndex < shuffledWords.length - 1) {
      setCurrentWordIndex(prevIndex => prevIndex + 1);
      setProgress(((currentWordIndex + 1) / shuffledWords.length) * 100);
      processingWordRef.current = null; // Allow processing the next word's result
    } else {
      endGame();
    }
  };

  const endGame = () => {
    setGameActive(false);
    setGameOver(true);
    processingWordRef.current = null;
    addRecognitionStatus('Game over!');
    console.log('Complete Game Log:', gameLog);
  };

  const startGame = () => {
    setGameActive(true);
    setGameOver(false);
    setShowLog(false);
    setGameLog([]);
    setRecognitionStatus([]);
    processingWordRef.current = null;
    addRecognitionStatus('Game started.');
  };

  const handleShowAnswers = () => {
    setShowLog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 to-indigo-300 flex flex-col items-center justify-center p-4">
      {/* Debug/Dev Voice Recognition Status Panel */}
      {gameActive && !gameOver && (
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: 375,
          background: 'rgba(0,0,0,0.88)',
          color: '#baffc9',
          fontFamily: 'monospace',
          fontSize: 13,
          padding: 14,
          zIndex: 1000,
          borderRadius: 8,
          margin: 16,
          maxHeight: 440,
          overflowY: 'auto',
          boxShadow: '0 2px 10px #000a'
        }}>
          <b>Voice Recognition Status</b>
          <ul style={{paddingLeft:16}}>
            {recognitionStatus.map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      )}

      <div className={`w-full ${showLog ? 'max-w-5xl' : 'max-w-md'} bg-white rounded-3xl shadow-xl p-8 relative overflow-hidden`}>
        <div className="absolute top-0 left-0 w-full h-2">
          {gameActive && !gameOver && <ProgressBar progress={progress} />}
        </div>

        {!gameActive && !gameOver && (
          <h1 className="text-4xl font-bold text-center mb-8 text-purple-600">
            Guessy Wordy
          </h1>
        )}

        {gameOver ? (
          showLog ? (
            <GameLog logs={gameLog} onPlayAgain={startGame} />
          ) : (
            <GameOver onPlayAgain={startGame} onShowAnswers={handleShowAnswers} />
          )
        ) : !gameActive ? (
          <div className="flex flex-col items-center space-y-6">
            <p className="text-lg text-center mb-4">
              Say the words out loud!
            </p>
            <Button 
              onClick={startGame} 
              className="bg-green-500 hover:bg-green-600 text-white text-xl py-6 px-8 rounded-full shadow-lg"
            >
              Start Game
            </Button>
          </div>
        ) : (
          <>
            <WordDisplay word={shuffledWords[currentWordIndex]?.text || ''} />

            <SpeechRecognition 
              onResult={handleSpeechResult}
              isListening={isListening}
              setIsListening={setIsListening}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              addStatus={addRecognitionStatus}
            />

            <div className="flex justify-center items-center mt-4">
              <Button
                onClick={handleSkip}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 flex items-center justify-center"
                aria-label="Skip word"
                disabled={isProcessing}
              >
                Skip
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default IndexPage;