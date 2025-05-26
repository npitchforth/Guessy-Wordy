import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordDisplayProps {
  word: string;
}

const WordDisplay: React.FC<WordDisplayProps> = ({ word }) => {
  return (
    <div className="flex justify-center items-center my-8 h-32">
      <AnimatePresence mode="wait">
        <motion.h2
          key={word}
          className="text-7xl md:text-8xl font-bold text-blue-600"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {word}
        </motion.h2>
      </AnimatePresence>
    </div>
  );
};

export default WordDisplay;
