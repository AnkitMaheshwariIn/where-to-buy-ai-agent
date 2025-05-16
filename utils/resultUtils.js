/**
 * Utility functions for search result categorization and processing
 */

const { checkBrandMatch } = require('./brandUtils');
const { extractWeight, extractPackSize, extractFeatures, calculateWeightAndPrice, compareSizes } = require('./attributeUtils');
const { extractNumericPrice, categorizeByPrice } = require('./priceUtils');

/**
 * Categorizes search results into exact matches and alternatives
 * @param {Array} results - Search results array
 * @param {Array} potentialBrands - Potential brand names from search query
 * @param {string} searchSize - Size from search query (if any)
 * @returns {Object} - Object with exactMatches and alternatives arrays
 */
const categorizeResults = (results, potentialBrands, searchSize) => {
  if (!results || !Array.isArray(results)) return { exactMatches: [], alternatives: [] };
  
  const exactMatches = [];
  const alternatives = [];
  
  results.forEach(item => {
    const title = item.title.toLowerCase();
    
    // Check for brand match
    const isExactBrandMatch = checkBrandMatch(title, potentialBrands);
    console.log(`Title: ${title} | Brand match: ${isExactBrandMatch}`);
    
    // Extract product attributes
    const weightMatch = extractWeight(title);
    const packMatch = extractPackSize(title);
    const priceValue = extractNumericPrice(item.price);
    
    // Calculate weight and unit price
    const { 
      individualWeight, 
      totalWeight, 
      weightUnit, 
      packSize, 
      unitPrice, 
      unitPriceFormatted 
    } = calculateWeightAndPrice(weightMatch, packMatch, priceValue);
    
    // Add weight and price info to the item in a backward-compatible way
    // Keep the new properties for future use
    item.weightInfo = weightMatch ? weightMatch[0] : null;
    item.packInfo = packMatch ? packMatch[0] : null;
    item.features = extractFeatures(title);
    item.unitPrice = unitPrice;
    item.unitPriceFormatted = unitPriceFormatted;
    
    // Also maintain the old attributes structure for backward compatibility with the frontend
    item.attributes = {
      weight: weightMatch ? weightMatch[0] : null,
      individualWeight: individualWeight,
      totalWeight: totalWeight,
      weightUnit: weightUnit,
      packSize: packSize,
      priceValue: priceValue || 0,
      unitPrice: unitPrice,
      unitPriceFormatted: unitPriceFormatted,
      features: item.features || []
    };
    
    // Determine if this is an exact match (brand + attributes)
    let isExactMatch = isExactBrandMatch;
    
    // If search included a specific size, check if this product matches that size
    if (isExactMatch && searchSize && weightMatch) {
      isExactMatch = compareSizes(weightMatch, searchSize);
      console.log(`Size comparison for ${title}: ${isExactMatch}`);
    }
    
    // Categorize based on matches
    if (isExactMatch) {
      exactMatches.push(item);
    } else {
      alternatives.push(item);
    }
  });
  
  // Categorize by price within each group
  const exactMatchesPriceCategories = categorizeByPrice(exactMatches);
  const alternativesPriceCategories = categorizeByPrice(alternatives);
  
  // Add price category to each item
  exactMatches.forEach(item => {
    item.priceCategory = exactMatchesPriceCategories[item.id] || 'medium';
  });
  
  alternatives.forEach(item => {
    item.priceCategory = alternativesPriceCategories[item.id] || 'medium';
  });
  
  return { exactMatches, alternatives };
};

/**
 * Removes duplicate products from results
 * @param {Array} results - Array of product results
 * @returns {Array} - Deduplicated results
 */
const removeDuplicates = (results) => {
  if (!results || !Array.isArray(results)) return [];
  
  const seen = new Set();
  return results.filter(item => {
    // Create a key based on title and price
    const key = `${item.title.toLowerCase()}_${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Simplifies product titles by removing unnecessary information
 * @param {string} title - Product title
 * @returns {string} - Simplified title
 */
const simplifyTitle = (title) => {
  if (!title) return '';
  
  // Remove common marketing phrases
  const marketingPhrases = [
    'best quality',
    'premium quality',
    'high quality',
    'top quality',
    'best selling',
    'new arrival',
    'special offer',
    'limited time',
    'exclusive',
    'authentic'
  ];
  
  let simplified = title;
  
  // Remove marketing phrases
  marketingPhrases.forEach(phrase => {
    const regex = new RegExp(phrase, 'gi');
    simplified = simplified.replace(regex, '');
  });
  
  // Remove excessive whitespace
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  // Truncate if too long (over 60 characters)
  if (simplified.length > 60) {
    simplified = simplified.substring(0, 57) + '...';
  }
  
  return simplified;
};

module.exports = {
  categorizeResults,
  removeDuplicates,
  simplifyTitle
};
