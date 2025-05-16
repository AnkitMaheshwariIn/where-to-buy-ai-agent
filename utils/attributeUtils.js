/**
 * Utility functions for product attribute detection and processing
 */

// Patterns for weight/volume detection
const weightPatterns = [
  /([0-9.]+)\s*(kg|g|gm|gram|ml|l|liter|litre)/i,  // Standard format: 2L, 500g
  /([0-9.]+)\s*-?\s*(kg|g|gm|gram|ml|l|liter|litre)/i,  // Handle hyphenated: 2-liter
  /([0-9.]+)(kg|g|gm|gram|ml|l)/i  // No space: 2L, 500g
];

// Patterns for pack size detection
const packPatterns = [
  /pack\s*of\s*([0-9]+)/i,  // Standard: pack of 4
  /([0-9]+)\s*x\s*[0-9.]+/i,  // Format: 4 x 100g
  /([0-9]+)\s*pack/i,  // Format: 4 pack
  /([0-9]+)\s*count/i,  // Format: 4 count
  /([0-9]+)\s*pc/i,  // Format: 4 pc
  /set\s*of\s*([0-9]+)/i  // Format: set of 4
];

// Feature keywords to detect
const featureKeywords = {
  'original': 'original',
  'fresh': 'fresh',
  'cool': 'cooling',
  'icy': 'cooling',
  'lemon': 'lemon',
  'germ protection': ['germ', 'protection'],
  'antibacterial': 'antibacterial',
  'anti-bacterial': 'antibacterial',
  'natural': 'natural',
  'organic': 'organic',
  'fragrance': 'fragrance',
  'scented': 'scented'
};

/**
 * Extracts weight/volume information from a product title
 * @param {string} title - The product title
 * @returns {object|null} - Weight match object or null if not found
 */
const extractWeight = (title) => {
  if (!title) return null;
  
  for (const pattern of weightPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match;
    }
  }
  
  return null;
};

/**
 * Extracts pack size information from a product title
 * @param {string} title - The product title
 * @returns {object|null} - Pack match object or null if not found
 */
const extractPackSize = (title) => {
  if (!title) return null;
  
  for (const pattern of packPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match;
    }
  }
  
  return null;
};

/**
 * Extracts special features from a product title
 * @param {string} title - The product title
 * @returns {string[]} - Array of detected features
 */
const extractFeatures = (title) => {
  if (!title) return [];
  
  const features = [];
  const lowerTitle = title.toLowerCase();
  
  // Check for single-word features
  Object.entries(featureKeywords).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Check if all words in the array are present
      if (value.every(word => lowerTitle.includes(word))) {
        features.push(key);
      }
    } else if (lowerTitle.includes(value)) {
      features.push(key);
    }
  });
  
  return features;
};

/**
 * Calculates standardized weight and unit price
 * @param {object} weightMatch - Weight match object
 * @param {object} packMatch - Pack match object
 * @param {number} priceValue - Product price
 * @returns {object} - Object with weight and price information
 */
const calculateWeightAndPrice = (weightMatch, packMatch, priceValue) => {
  let individualWeight = 0;
  let totalWeight = 0;
  let weightUnit = '';
  
  if (weightMatch) {
    const weightValue = parseFloat(weightMatch[1]);
    weightUnit = weightMatch[2].toLowerCase();
    
    // Standardize weight to grams or ml for comparison
    if (weightUnit === 'kg') {
      individualWeight = weightValue * 1000;
      weightUnit = 'g';
    } else if (weightUnit === 'l' || weightUnit === 'liter' || weightUnit === 'litre') {
      individualWeight = weightValue * 1000;
      weightUnit = 'ml';
    } else {
      individualWeight = weightValue;
    }
    
    // Calculate total weight
    totalWeight = individualWeight;
    if (packMatch) {
      const packSize = parseInt(packMatch[1]);
      totalWeight = individualWeight * packSize;
    }
  }
  
  // Calculate unit price (price per 100g/100ml)
  let unitPrice = 0;
  let unitPriceFormatted = null;
  
  if (totalWeight > 0) {
    unitPrice = (priceValue / totalWeight) * 100;
    unitPriceFormatted = `₹${unitPrice.toFixed(2)}/${weightUnit === 'ml' ? '100ml' : '100g'}`;
  }
  
  return {
    individualWeight,
    totalWeight,
    weightUnit,
    packSize: packMatch ? parseInt(packMatch[1]) : null,
    unitPrice,
    unitPriceFormatted
  };
};

/**
 * Compares a product size with a search size
 * @param {object} weightMatch - Product weight match object
 * @param {string} searchSize - Search size string
 * @returns {boolean} - True if sizes match
 */
const compareSizes = (weightMatch, searchSize) => {
  if (!weightMatch || !searchSize) return false;
  
  try {
    // Normalize sizes for comparison (e.g., "2 liter" should match "2L")
    const productSizeRaw = weightMatch[0].toLowerCase();
    const searchSizeValue = parseFloat(searchSize.match(/[\d.]+/)[0]);
    const productSizeValue = parseFloat(productSizeRaw.match(/[\d.]+/)[0]);
    
    // Check if units are compatible (both volume or both weight)
    const searchUnit = searchSize.replace(/[\d.\s]+/, '').trim();
    const productUnit = productSizeRaw.replace(/[\d.\s]+/, '').trim();
    
    const isVolumeSearch = ['l', 'liter', 'litre', 'ml'].some(u => searchUnit.includes(u));
    const isVolumeProduct = ['l', 'liter', 'litre', 'ml'].some(u => productUnit.includes(u));
    
    // Units are compatible if both are volume or both are weight
    const compatibleUnits = (isVolumeSearch && isVolumeProduct) || (!isVolumeSearch && !isVolumeProduct);
    
    // Match if values are the same and units are compatible
    return compatibleUnits && Math.abs(searchSizeValue - productSizeValue) < 0.1;
  } catch (error) {
    console.error('Error comparing sizes:', error);
    return false;
  }
};

module.exports = {
  weightPatterns,
  packPatterns,
  featureKeywords,
  extractWeight,
  extractPackSize,
  extractFeatures,
  calculateWeightAndPrice,
  compareSizes
};
