/**
 * Utility functions for brand detection and matching
 */

// Common generic words to exclude (applicable across all categories)
const genericWords = [
  // Units and measurements
  'liter', 'litre', 'ml', 'kg', 'gram', 'gm', 'oz', 'inch', 'cm', 'mm',
  // Product types
  'liquid', 'soap', 'gel', 'powder', 'cream', 'oil', 'lotion', 'spray',
  // Descriptors
  'pack', 'set', 'box', 'case', 'bundle', 'refill', 'new', 'fresh',
  // Common adjectives
  'small', 'large', 'medium', 'mini', 'big', 'giant', 'tiny',
  // Colors
  'red', 'blue', 'green', 'black', 'white', 'yellow', 'pink',
  // Other common words
  'with', 'and', 'for', 'the', 'best', 'premium', 'quality', 'value',
  // Additional product descriptors
  'dishwash', 'bathing', 'bar', 'bottle', 'container', 'tube', 'jar'
];

/**
 * Detects potential brand names from a search query
 * @param {string} query - The search query
 * @returns {string[]} - Array of potential brand names
 */
const detectBrands = (query) => {
  // Split the query and analyze position and length
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  // First word has high probability of being a brand (if not generic)
  let potentialBrands = [];
  
  if (words.length > 0 && !genericWords.includes(words[0])) {
    potentialBrands.push(words[0]);
  }
  
  // Look for capitalized words in the original query (often brands)
  const capitalizedWords = query.split(/\s+/).filter(word => 
    word.length > 1 && 
    word[0] === word[0].toUpperCase() && 
    word[1] === word[1].toLowerCase() &&
    !genericWords.includes(word.toLowerCase())
  );
  
  capitalizedWords.forEach(word => {
    const normalized = word.toLowerCase();
    if (!potentialBrands.includes(normalized)) {
      potentialBrands.push(normalized);
    }
  });
  
  // If no brands detected yet, try words that aren't generic
  if (potentialBrands.length === 0) {
    potentialBrands = words.filter(word => !genericWords.includes(word));
  }
  
  return potentialBrands;
};

/**
 * Checks if a product title matches any of the potential brands
 * @param {string} title - The product title
 * @param {string[]} potentialBrands - Array of potential brand names
 * @returns {boolean} - True if the title matches any brand
 */
const checkBrandMatch = (title, potentialBrands) => {
  if (!title || potentialBrands.length === 0) return false;
  
  title = title.toLowerCase();
  let isMatch = false;
  
  // Try to match brands at the beginning of the title (most reliable)
  const titleWords = title.split(/\s+/);
  const firstTitleWord = titleWords[0].toLowerCase();
  
  // Check if first word in title matches any potential brand
  isMatch = potentialBrands.some(brand => 
    firstTitleWord === brand || firstTitleWord.includes(brand) || brand.includes(firstTitleWord)
  );
  
  // If no match found with first word, check anywhere in the first 20 characters
  if (!isMatch) {
    isMatch = potentialBrands.some(brand => 
      title.includes(brand) && title.indexOf(brand) < 20
    );
  }
  
  // More flexible approach if still no match
  if (!isMatch) {
    // Check if any potential brand appears anywhere in the title
    for (const brand of potentialBrands) {
      // Try different matching strategies
      const exactWordMatch = titleWords.some(word => word.toLowerCase() === brand);
      const partialMatch = titleWords.some(word => 
        word.toLowerCase().includes(brand) || brand.includes(word.toLowerCase())
      );
      
      if (exactWordMatch || partialMatch) {
        isMatch = true;
        break;
      }
    }
  }
  
  return isMatch;
};

module.exports = {
  genericWords,
  detectBrands,
  checkBrandMatch
};
