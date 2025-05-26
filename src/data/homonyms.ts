// Define the structure for homonym groups
export interface HomonymGroup {
  words: string[];
}

// Define the homonym groups
export const HOMONYM_GROUPS: HomonymGroup[] = [
  {
    words: ['to', 'two', 'too', '2']
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
    words: ['one', 'won', '1']
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
  },
  {
    words: ['b', 'be']      // Special case for Azure Speech recognition
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
  // Normalize both words
  const normalizeWord = (word: string) => {
    const normalized = word.toLowerCase().replace(/[.,!?]/g, '').trim();
    console.log(`Normalizing word in homonyms check: "${word}" -> "${normalized}"`);
    return normalized;
  };
  
  const normalizedWord1 = normalizeWord(word1);
  const normalizedWord2 = normalizeWord(word2);
  
  console.log('Homonyms check:', {
    original: { word1, word2 },
    normalized: { word1: normalizedWord1, word2: normalizedWord2 }
  });

  // If words are identical after normalization, they are a match
  if (normalizedWord1 === normalizedWord2) {
    console.log('Words are identical after normalization');
    return true;
  }

  // Check if either word is in the homonyms map
  const word1Homonyms = HOMONYM_GROUPS.find(group => 
    group.words.some(w => normalizeWord(w) === normalizedWord1)
  );
  const word2Homonyms = HOMONYM_GROUPS.find(group => 
    group.words.some(w => normalizeWord(w) === normalizedWord2)
  );

  console.log('Homonym groups found:', {
    word1Group: word1Homonyms,
    word2Group: word2Homonyms
  });

  // If either word has homonyms, check if they're in the same group
  if (word1Homonyms && word2Homonyms) {
    const areInSameGroup = word1Homonyms.words.some(w => normalizeWord(w) === normalizedWord2);
    console.log('Words are in same homonym group:', areInSameGroup);
    return areInSameGroup;
  }

  console.log('No matching homonym groups found');
  return false;
}

// Helper function to get all homonyms for a word
export function getHomonyms(word: string): string[] {
  const normalizedWord = word.toLowerCase();
  const group = HOMONYM_GROUPS.find(group => group.words.includes(normalizedWord));
  return group ? group.words.filter(w => w !== normalizedWord) : [];
} 