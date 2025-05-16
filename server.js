/**
 * Where-to-Buy AI Agent
 * 
 * This application uses official APIs from e-commerce platforms to search for products
 * across multiple sites. It implements proper authentication and rate limiting to ensure
 * compliance with each platform's terms of service.
 * 
 * APIs implemented:
 * - Amazon Product Advertising API
 * - Flipkart Affiliate API
 * - Other platforms through official partner programs
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');

// Import utility modules
const memoryCache = require('memory-cache');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create a new cache with a default TTL of 1 hour (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: function (req) {
    // Use API key or IP as the rate limit key
    return req.query.api_key || req.ip;
  }
});

// Apply rate limiting to all routes
app.use(limiter);

// API Key Authentication middleware
function apiKeyAuth(req, res, next) {
  // Check if API key is required in the current environment
  if (process.env.REQUIRE_API_KEY === 'true') {
    const apiKey = req.query.api_key;
    
    // If no API key is provided
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required', message: 'Please provide an API key via the api_key query parameter' });
    }
    
    // Check if the API key is valid (in a real app, you'd check against a database)
    const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
    if (!validApiKeys.includes(apiKey)) {
      return res.status(403).json({ error: 'Invalid API key', message: 'The provided API key is not valid' });
    }
  }
  
  // If API key is not required or is valid, proceed
  next();
}

// Apply API key authentication to API routes
app.use('/search', apiKeyAuth);
app.use('/admin', apiKeyAuth);

// Helper function to format search queries
function formatQuery(query) {
  return encodeURIComponent(query.trim());
}

// Import utility functions for result processing
const { removeDuplicates, detectBrands, extractWeight, categorizeResults } = require('./utils/resultUtils');

/**
 * Amazon Product Advertising API Integration
 * Documentation: https://webservices.amazon.com/paapi5/documentation/
 */
async function searchAmazon(product) {
  try {
    console.log(`Searching Amazon for: ${product}`);
    
    // Amazon PA-API requires several authentication parameters
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    const partnerTag = process.env.AMAZON_PARTNER_TAG;
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV'; // India marketplace
    
    if (!accessKey || !secretKey || !partnerTag) {
      console.error('Amazon API credentials not configured');
      return [];
    }
    
    // Create a timestamp for the request
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0].replace(/-/g, '');
    
    // Prepare the request payload
    const payload = {
      'Keywords': product,
      'Resources': [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Images.Primary.Medium'
      ],
      'PartnerTag': partnerTag,
      'PartnerType': 'Associates',
      'Marketplace': 'www.amazon.in',
      'Operation': 'SearchItems'
    };
    
    // Prepare the request headers with authentication
    const host = 'webservices.amazon.in';
    const path = '/paapi5/searchitems';
    
    // Create canonical request for Signature Version 4
    const canonicalHeaders = `host:${host}\nx-amz-date:${timestamp}\n`;
    const signedHeaders = 'host;x-amz-date';
    
    // Create the string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const region = 'eu-west-1';
    const service = 'ProductAdvertisingAPI';
    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    
    // Calculate the signature
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
    
    // Calculate the signing key
    const getSignatureKey = (key, dateStamp, regionName, serviceName) => {
      const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
      const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
      const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
      const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
      return kSigning;
    };
    
    const signingKey = getSignatureKey(secretKey, date, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    // Add the signature to the headers
    const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    const response = await axios({
      url: `https://${host}${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': timestamp,
        'Authorization': authorizationHeader
      },
      data: payload
    });
    
    // Process the response
    const results = [];
    if (response.data && response.data.SearchResult && response.data.SearchResult.Items) {
      response.data.SearchResult.Items.forEach(item => {
        if (item.ItemInfo && item.ItemInfo.Title && item.Offers && item.Offers.Listings && item.Offers.Listings[0].Price) {
          results.push({
            platform: 'Amazon',
            title: item.ItemInfo.Title.DisplayValue,
            price: `₹${item.Offers.Listings[0].Price.Amount}`,
            link: item.DetailPageURL,
            image: item.Images?.Primary?.Medium?.URL || ''
          });
        }
      });
    }
    
    console.log(`Amazon API returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Amazon API error:', error.message);
    return [];
  }
}

/**
 * Flipkart Affiliate API Integration
 * Documentation: https://affiliate.flipkart.com/api-docs/
 */
async function searchFlipkart(product) {
  try {
    console.log(`Searching Flipkart for: ${product}`);
    
    // Flipkart API requires authentication parameters
    const affiliateId = process.env.FLIPKART_AFFILIATE_ID;
    const affiliateToken = process.env.FLIPKART_AFFILIATE_TOKEN;
    
    if (!affiliateId || !affiliateToken) {
      console.error('Flipkart API credentials not configured');
      return [];
    }
    
    // Prepare the request
    const response = await axios({
      url: `https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query=${formatQuery(product)}&resultCount=10`,
      method: 'GET',
      headers: {
        'Fk-Affiliate-Id': affiliateId,
        'Fk-Affiliate-Token': affiliateToken
      }
    });
    
    // Process the response
    const results = [];
    if (response.data && response.data.products) {
      response.data.products.forEach(product => {
        results.push({
          platform: 'Flipkart',
          title: product.productBaseInfoV1.title,
          price: product.productBaseInfoV1.flipkartSpecialPrice?.amount ? 
                 `₹${product.productBaseInfoV1.flipkartSpecialPrice.amount}` : 
                 `₹${product.productBaseInfoV1.maximumRetailPrice.amount}`,
          link: product.productBaseInfoV1.productUrl,
          image: product.productBaseInfoV1.imageUrls?.['200x200'] || ''
        });
      });
    }
    
    console.log(`Flipkart API returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Flipkart API error:', error.message);
    return [];
  }
}

/**
 * Meesho API Integration (via Partner Program)
 * Note: This is a placeholder. You'll need to apply for Meesho's partner program
 * to get actual API access.
 */
async function searchMeesho(product) {
  try {
    console.log(`Searching Meesho for: ${product}`);
    
    // Meesho API credentials
    const apiKey = process.env.MEESHO_API_KEY;
    
    if (!apiKey) {
      console.error('Meesho API credentials not configured');
      return [];
    }
    
    // This is a placeholder for the actual API call
    // You would need to replace this with the actual Meesho API endpoint and parameters
    const response = await axios({
      url: `https://api.meesho.com/api/v1/search?q=${formatQuery(product)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Process the response (this is a placeholder based on assumed API structure)
    const results = [];
    if (response.data && response.data.products) {
      response.data.products.forEach(product => {
        results.push({
          platform: 'Meesho',
          title: product.name,
          price: `₹${product.discounted_price || product.price}`,
          link: `https://www.meesho.com/product/${product.id}`,
          image: product.image_url || ''
        });
      });
    }
    
    console.log(`Meesho API returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Meesho API error:', error.message);
    return [];
  }
}

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Cache middleware
function cacheMiddleware(duration) {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') return next();
    
    // Create a cache key from the full URL
    const key = req.originalUrl || req.url;
    
    // Check if we have a cache hit
    const cachedResponse = cache.get(key);
    if (cachedResponse) {
      console.log(`Cache hit for ${key}`);
      return res.json(cachedResponse);
    }
    
    // Store the original send function
    const originalSend = res.json;
    
    // Override the send function
    res.json = function(body) {
      // Store the response in cache
      cache.set(key, body, duration);
      
      // Call the original send function
      originalSend.call(this, body);
    };
    
    next();
  };
}

// API Endpoint with caching
app.get('/search', cacheMiddleware(process.env.CACHE_TTL || 3600), async (req, res) => {
  const product = req.query.product;
  if (!product) return res.status(400).json({ error: 'Missing "product" query parameter' });

  try {
    // Add timeout to prevent hanging requests
    const timeout = setTimeout(() => {
      throw new Error('Request timed out after 30 seconds');
    }, 30000);

    // Use Promise.allSettled to ensure all API calls run regardless of individual failures
    const results = await Promise.allSettled([
      searchAmazon(product).catch(err => { console.log(`Amazon API error: ${err.message}`); return []; }),
      searchFlipkart(product).catch(err => { console.log(`Flipkart API error: ${err.message}`); return []; }),
      searchMeesho(product).catch(err => { console.log(`Meesho API error: ${err.message}`); return []; })
    ]);

    clearTimeout(timeout);

    // Process results
    const amazon = results[0].status === 'fulfilled' ? results[0].value : [];
    const flipkart = results[1].status === 'fulfilled' ? results[1].value : [];
    const meesho = results[2].status === 'fulfilled' ? results[2].value : [];
    
    // Filter out results with empty or invalid links
    const validateResults = (results) => {
      return results.filter(item => {
        // Check if link exists and is valid
        return item.link && 
               item.link.trim() !== '' && 
               item.link.startsWith('http') &&
               item.title && 
               item.title.trim() !== '' &&
               item.price && 
               item.price.trim() !== '';
      });
    };
    
    // Combine all results and remove duplicates
    let allResults = [];
    let sources = {
      'Amazon': 0,
      'Flipkart': 0,
      'Meesho': 0
    };

    // Process results from each source
    if (results[0].status === 'fulfilled') {
      const validAmazon = validateResults(results[0].value);
      allResults = [...allResults, ...validAmazon];
      sources['Amazon'] = validAmazon.length;
    }

    if (results[1].status === 'fulfilled') {
      const validFlipkart = validateResults(results[1].value);
      allResults = [...allResults, ...validFlipkart];
      sources['Flipkart'] = validFlipkart.length;
    }

    if (results[2].status === 'fulfilled') {
      const validMeesho = validateResults(results[2].value);
      allResults = [...allResults, ...validMeesho];
      sources['Meesho'] = validMeesho.length;
    }
    
    // If no results were found, we'll just return an empty array
    if (allResults.length === 0) {
      console.log('No results found');
    }

    // Remove duplicates and combine results
    const uniqueAmazon = removeDuplicates(allResults.filter(item => item.platform === 'Amazon'));
    const uniqueFlipkart = removeDuplicates(allResults.filter(item => item.platform === 'Flipkart'));
    const uniqueMeesho = removeDuplicates(allResults.filter(item => item.platform === 'Meesho'));
    
    // Combine all unique results
    const combinedResults = [...uniqueAmazon, ...uniqueFlipkart, ...uniqueMeesho];
    
    // Apply the dynamic brand detection
    const potentialBrands = detectBrands(product);
    
    // Debug log for brand detection
    console.log('Search query:', product);
    console.log('Detected potential brands:', potentialBrands);
    
    // Extract specific size/volume if mentioned in search query
    const sizeMatch = extractWeight(product);
    const searchSize = sizeMatch ? sizeMatch[0].toLowerCase() : null;
    
    // Debug log for size detection
    console.log('Detected size:', searchSize);
    
    // Use the categorizeResults function
    const { exactMatches, alternatives } = categorizeResults(combinedResults, potentialBrands, searchSize);
    
    // Add timestamp and source information
    const response = {
      timestamp: new Date().toISOString(),
      query: product,
      sources: sources,
      count: combinedResults.length,
      exactMatches: exactMatches,
      alternatives: alternatives,
      potentialBrands: potentialBrands,
      valid: true
    };
    
    res.json(response);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    timestamp: new Date().toISOString(),
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    }
  });
});

// Cache management endpoints (for admin use)
app.get('/admin/cache/clear', (req, res) => {
  const keys = cache.keys();
  cache.flushAll();
  res.json({ status: 'ok', message: `Cleared ${keys.length} cache entries` });
});

// Serve the frontend for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', message: 'The requested resource was not found' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📊 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🔍 Search API: http://localhost:${PORT}/search?product=your+query`);
  console.log(`💻 Frontend: http://localhost:${PORT}`);
});
