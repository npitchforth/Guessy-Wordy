// Define the structure for homonym groups
export interface HomonymGroup {
  words: string[];
}

// Define the homonym groups
export const HOMONYM_GROUPS: HomonymGroup[] = [
  {
    words: ['to', 'two', 'too']
  },
  {
    words: ['there', 'their', 'they\'re']
  },
  {
    words: ['your', 'you\'re']
  },
  {
    words: ['know', 'no']
  },
  {
    words: ['one', 'won']
  },
  {
    words: ['buy', 'by', 'bye']
  },
  {
    words: ['which', 'witch']
  },
  {
    words: ['four', 'for', 'fore']
  },
  {
    words: ['were', 'we\'re']
  },
  {
    words: ['an', 'ann', 'anne']
  },
  {
    words: ['with', 'wiz']  // Special case for Azure Speech recognition
  },
  {
    words: ['he', 'hey']    // Special case for Azure Speech recognition
  }
];

// Create a map for quick lookup
export const HOMOPHONE_MAP: Record<string, string> = HOMONYM_GROUPS.reduce((acc, group) => {
  // For each word in the group, map it to the first word in the group
  const baseWord = group.words[0];
  group.words.forEach(word => {
    acc[word] = baseWord;
  });
  return acc;
}, {} as Record<string, string>);

// Helper function to check if two words are homonyms
export function areHomonyms(word1: string, word2: string): boolean {
  const normalizedWord1 = word1.toLowerCase();
  const normalizedWord2 = word2.toLowerCase();
  
  // If they're the same word, they're not homonyms
  if (normalizedWord1 === normalizedWord2) return false;
  
  // Check if they're in the same homonym group
  return HOMONYM_GROUPS.some(group => 
    group.words.includes(normalizedWord1) && group.words.includes(normalizedWord2)
  );
}

// Helper function to get all homonyms for a word
export function getHomonyms(word: string): string[] {
  const normalizedWord = word.toLowerCase();
  const group = HOMONYM_GROUPS.find(group => group.words.includes(normalizedWord));
  return group ? group.words.filter(w => w !== normalizedWord) : [];
} 