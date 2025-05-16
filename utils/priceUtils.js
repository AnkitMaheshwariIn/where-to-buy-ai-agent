/**
 * Utility functions for price extraction and comparison
 */

/**
 * Extracts numeric price from a price string
 * @param {string} priceStr - Price string (e.g., "₹499.00")
 * @returns {number} - Extracted numeric price
 */
const extractNumericPrice = (priceStr) => {
  if (!priceStr) return Number.MAX_VALUE;
  
  const matches = priceStr.match(/[\d,]+\.?\d*/g);
  if (matches && matches.length > 0) {
    return parseFloat(matches[0].replace(/,/g, ''));
  }
  return Number.MAX_VALUE; // If price can't be parsed
};

/**
 * Categorizes products by price (cheapest, medium, expensive)
 * @param {Array} products - Array of product objects
 * @returns {Object} - Object with categorized products
 */
const categorizeByPrice = (products) => {
  if (!products || products.length === 0) return {};
  
  // Sort products by unit price (if available) or by total price
  const sortedProducts = [...products].sort((a, b) => {
    // If both have unit price, compare by unit price
    if (a.unitPrice && b.unitPrice) {
      return a.unitPrice - b.unitPrice;
    }
    // If only one has unit price, prioritize the one with unit price
    if (a.unitPrice) return -1;
    if (b.unitPrice) return 1;
    
    // Otherwise compare by total price
    return extractNumericPrice(a.price) - extractNumericPrice(b.price);
  });
  
  // Categorize based on position in sorted array
  const result = {};
  
  if (sortedProducts.length === 1) {
    result[sortedProducts[0].id] = 'cheapest';
  } else if (sortedProducts.length === 2) {
    result[sortedProducts[0].id] = 'cheapest';
    result[sortedProducts[1].id] = 'expensive';
  } else {
    // For 3 or more products
    result[sortedProducts[0].id] = 'cheapest';
    
    // Middle products are medium
    for (let i = 1; i < sortedProducts.length - 1; i++) {
      result[sortedProducts[i].id] = 'medium';
    }
    
    // Last product is expensive
    result[sortedProducts[sortedProducts.length - 1].id] = 'expensive';
  }
  
  return result;
};

/**
 * Formats a price for display
 * @param {string|number} price - Price to format
 * @returns {string} - Formatted price
 */
const formatPrice = (price) => {
  if (!price) return '₹0.00';
  
  // If price is already a string with currency symbol
  if (typeof price === 'string' && price.includes('₹')) {
    return price;
  }
  
  // Convert to number if string
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  // Format with Indian Rupee symbol and 2 decimal places
  return `₹${numPrice.toFixed(2)}`;
};

module.exports = {
  extractNumericPrice,
  categorizeByPrice,
  formatPrice
};
