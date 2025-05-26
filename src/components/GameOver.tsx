import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Repeat, List } from 'lucide-react';

interface GameOverProps {
  onPlayAgain: () => void;
  onShowAnswers: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ onPlayAgain, onShowAnswers }) => {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-4xl font-bold text-center mb-8 text-purple-600">
        Game Over!
      </h2>
      
      <div className="flex flex-col gap-4">
        <Button 
          onClick={onShowAnswers} 
          className="bg-purple-500 hover:bg-purple-600 text-white text-xl py-6 px-8 rounded-full shadow-lg flex items-center gap-2"
        >
          <List size={24} />
          Show Answers
        </Button>

        <Button 
          onClick={onPlayAgain} 
          className="bg-green-500 hover:bg-green-600 text-white text-xl py-6 px-8 rounded-full shadow-lg flex items-center gap-2"
        >
          <Repeat size={24} />
          Play Again
        </Button>
      </div>
    </motion.div>
  );
};

export default GameOver;
