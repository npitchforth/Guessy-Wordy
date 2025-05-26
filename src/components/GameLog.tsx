import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Repeat } from 'lucide-react';

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

interface GameLogProps {
  logs: GameLogEntry[];
  onPlayAgain: () => void;
}

const GameLog: React.FC<GameLogProps> = ({ logs, onPlayAgain }) => {
  const score = logs.filter(log => log.isCorrect).length;

  return (
    <motion.div 
      className="flex flex-col items-center justify-center py-8 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-4xl font-bold text-center mb-4 text-purple-600">
        Game Results
      </h2>

      <div className="text-2xl font-semibold text-center mb-8 text-purple-600">
        Score: {score}
      </div>

      <div className="w-full max-w-4xl mb-8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Word</th>
                <th className="p-2 text-left">Your Answer</th>
                <th className="p-2 text-left">Possibilities</th>
                <th className="p-2 text-left">Attempt</th>
                <th className="p-2 text-left">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={index} className="border-b">
                  <td className="p-2">{log.word}</td>
                  <td className="p-2">{log.userAnswer}</td>
                  <td className="p-2">
                    {log.possibilities.map((p, i) => (
                      <div key={i} className="text-sm">
                        {p.word} ({(p.confidence * 100).toFixed(1)}%)
                      </div>
                    ))}
                  </td>
                  <td className="p-2">{log.attemptNumber}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded ${
                      log.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {log.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button 
        onClick={onPlayAgain} 
        className="bg-green-500 hover:bg-green-600 text-white text-xl py-6 px-8 rounded-full shadow-lg flex items-center gap-2"
      >
        <Repeat size={24} />
        Play Again
      </Button>
    </motion.div>
  );
};

export default GameLog; 