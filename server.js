require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// Import utility modules
const { detectBrands } = require('./utils/brandUtils');
const { extractWeight } = require('./utils/attributeUtils');
const { categorizeResults, removeDuplicates } = require('./utils/resultUtils');

const UserAgent = require('user-agents');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const helmet = require('helmet');

// Initialize cache with TTL in seconds (default: 1 hour)
const cache = new NodeCache({ 
  stdTTL: process.env.CACHE_TTL || 3600, 
  checkperiod: 120,
  useClones: false
});

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'cdn-icons-png.flaticon.com', 'play-lh.googleusercontent.com'],
    },
  },
}));

// Enable CORS for all routes
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes',
  // Disable trusted proxy functionality to avoid X-Forwarded-For header issues
  trustProxy: false,
  // Disable IP detection to avoid X-Forwarded-For header issues
  skipFailedRequests: true,
  keyGenerator: (req) => '127.0.0.1' // Use a fixed IP for all requests in development
});

// Apply rate limiting to all routes
app.use(limiter);

// API Key Authentication middleware
const apiKeyAuth = (req, res, next) => {
  // Skip authentication for frontend and documentation routes
  if (req.path === '/' || req.path === '/health' || req.path.startsWith('/api-docs') || req.path.includes('.')) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  // In production, you would validate against a database or environment variable
  // For now, we'll use a simple check with the API key from .env
  const validApiKey = process.env.API_KEY || 'where-to-buy-test-api-key';
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }
  
  next();
};

// Apply API key authentication to API routes
app.use('/search', apiKeyAuth);
app.use('/admin', apiKeyAuth);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const userAgent = new UserAgent();
const headers = {
  'User-Agent': userAgent.toString(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
};

const formatQuery = (query) => query.trim().replace(/\s+/g, '+');

// Amazon Scraper
async function scrapeAmazon(product) {
  const url = `https://www.amazon.in/s?k=${formatQuery(product)}`;
  console.log(`Scraping Amazon with URL: ${url}`);
  try {
    const { data } = await axios.get(url, { headers });
    console.log('Amazon response received, length:', data.length);
    const $ = cheerio.load(data);
    const results = [];
    
    const searchResults = $('div.s-main-slot div[data-component-type="s-search-result"]');
    console.log(`Amazon found ${searchResults.length} search result elements`);

    searchResults.each((_, el) => {
      // Try different selectors for title
      const title = $(el).find('h2 span').text().trim() || 
                   $(el).find('.a-text-normal').text().trim() || 
                   $(el).find('.a-size-medium').text().trim();
      
      // Try different selectors for price
      const price = $(el).find('.a-price .a-offscreen').first().text().trim() || 
                    $(el).find('.a-price-whole').first().text().trim();
      
      // Fix link extraction - ensure proper Amazon links
      let hrefAttr = $(el).find('h2 a').attr('href');
      let link = '';
      
      if (hrefAttr) {
        // Extract the product ID using regex
        const productIdMatch = hrefAttr.match(/\/([A-Z0-9]{10})(?:\/|\?|$)/);
        if (productIdMatch && productIdMatch[1]) {
          // Create a direct product link using the ASIN/product ID
          link = `https://www.amazon.in/dp/${productIdMatch[1]}`;
        } else if (hrefAttr.startsWith('/')) {
          link = 'https://www.amazon.in' + hrefAttr;
        } else if (hrefAttr.includes('amazon.in')) {
          link = hrefAttr;
        } else {
          link = 'https://www.amazon.in' + (hrefAttr.startsWith('/') ? '' : '/') + hrefAttr;
        }
      }
      
      // If link is still empty, create a search link as fallback
      if (!link) {
        link = `https://www.amazon.in/s?k=${encodeURIComponent(title)}`;
      }

      console.log(`Amazon item found: ${title ? 'Title: ' + title : 'No title'}, ${price ? 'Price: ' + price : 'No price'}`);
      
      if (title && price) {
        results.push({ platform: 'Amazon', title, price, link });
      }
    });

    console.log(`Amazon scraping complete, found ${results.length} valid results`);
    return results.slice(0, 5);
  } catch (err) {
    console.error('Amazon error:', err.message);
    return [];
  }
}

// Flipkart Scraper
async function scrapeFlipkart(product) {
  const url = `https://www.flipkart.com/search?q=${formatQuery(product)}`;
  console.log(`Scraping Flipkart with URL: ${url}`);
  try {
    // Use a different user agent specifically for Flipkart
    const flipkartHeaders = {
      ...headers,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    };
    
    const { data } = await axios.get(url, { headers: flipkartHeaders });
    console.log('Flipkart response received, length:', data.length);
    const $ = cheerio.load(data);
    const results = [];

    // Use multiple selectors to find product cards
    const searchResults = $('div._1YokD2 ._1AtVbE, ._4ddWXP, ._1xHGtK, ._13oc-S, ._4rR01T').parent();
    console.log(`Flipkart found ${searchResults.length} search result elements`);

    searchResults.each((_, el) => {
      // Try different selectors for title
      const title = $(el).find('div._4rR01T').text().trim() || 
                   $(el).find('a.s1Q9rs').text().trim() || 
                   $(el).find('div.s1Q9rs').text().trim() || 
                   $(el).find('.IRpwTa').text().trim();
      
      // Try different selectors for price
      const price = $(el).find('div._30jeq3').text().trim() || 
                    $(el).find('._30jeq3').text().trim();
      
      // Try different selectors for link
      const linkPart = $(el).find('a._1fQZEK').attr('href') || 
                       $(el).find('a.s1Q9rs').attr('href') || 
                       $(el).find('a._2rpwqI').attr('href') || 
                       $(el).find('a.IRpwTa').attr('href');
                       
      const link = linkPart ? `https://www.flipkart.com${linkPart}` : '';

      console.log(`Flipkart item found: ${title ? 'Title: ' + title : 'No title'}, ${price ? 'Price: ' + price : 'No price'}`);
      
      if (title && price) {
        results.push({ platform: 'Flipkart', title, price, link });
      }
    });

    console.log(`Flipkart scraping complete, found ${results.length} valid results`);
    return results.slice(0, 5);
  } catch (err) {
    console.error('Flipkart error:', err.message);
    return [];
  }
}

// Meesho Scraper
async function scrapeMeesho(product) {
  const url = `https://www.meesho.com/search?q=${formatQuery(product)}`;
  console.log(`Scraping Meesho with URL: ${url}`);
  try {
    // Use a different user agent specifically for Meesho
    const meeshoHeaders = {
      ...headers,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };
    
    const { data } = await axios.get(url, { headers: meeshoHeaders });
    console.log('Meesho response received, length:', data.length);
    const $ = cheerio.load(data);
    const results = [];

    // Try multiple selectors for Meesho product cards
    const searchResults = $('[class*="ProductCard"], [class*="product-card"], [class*="ProductList"], div.sc-jlZhew');
    console.log(`Meesho found ${searchResults.length} search result elements`);

    searchResults.each((_, el) => {
      // Try different selectors for title
      const title = $(el).find('p').first().text().trim() ||
                   $(el).find('.NewProductCardstyled__ProductTitle').text().trim() ||
                   $(el).find('.ProductTitle__StyledProductTitle').text().trim();
      
      // Try different selectors for price
      const price = $(el).find('h5').text().trim() ||
                    $(el).find('.NewProductCardstyled__StyledDesktopPrice').text().trim() ||
                    $(el).find('.ProductPrice__StyledProductPrice').text().trim();
      
      // Get link
      const linkPart = $(el).find('a').attr('href');
      const link = linkPart ? ('https://www.meesho.com' + linkPart) : '';

      console.log(`Meesho item found: ${title ? 'Title: ' + title : 'No title'}, ${price ? 'Price: ' + price : 'No price'}`);
      
      if (title && price) {
        results.push({ platform: 'Meesho', title, price, link });
      }
    });

    console.log(`Meesho scraping complete, found ${results.length} valid results`);
    return results.slice(0, 5);
  } catch (err) {
    console.error('Meesho error:', err.message);
    return [];
  }
}

// Blinkit Scraper with fallback to mock data
async function scrapeBlinkit(product) {
  const url = `https://blinkit.com/s/?q=${formatQuery(product)}`;
  console.log(`Scraping Blinkit with URL: ${url}`);
  try {
    // Use a different user agent specifically for Blinkit
    const blinkitHeaders = {
      ...headers,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    };
    
    const { data } = await axios.get(url, { headers: blinkitHeaders });
    console.log('Blinkit response received, length:', data.length);
    const $ = cheerio.load(data);
    const results = [];

    // Find product cards
    const searchResults = $('.product__wrapper, .plp-product, .product-item');
    console.log(`Blinkit found ${searchResults.length} search result elements`);

    searchResults.each((_, el) => {
      // Try different selectors for title
      const title = $(el).find('.product__name, .plp-product__name, .product-name').text().trim();
      
      // Try different selectors for price
      const price = $(el).find('.product__price, .plp-product__price, .product-price').text().trim();
      
      // Get link
      const linkHref = $(el).find('a').attr('href');
      const link = linkHref ? (linkHref.startsWith('http') ? linkHref : `https://blinkit.com${linkHref}`) : '';

      console.log(`Blinkit item found: ${title ? 'Title: ' + title : 'No title'}, ${price ? 'Price: ' + price : 'No price'}`);
      
      if (title && price) {
        // Filter out non-relevant products
        if (title.toLowerCase().includes(product.toLowerCase()) || 
            product.toLowerCase().split(' ').some(word => title.toLowerCase().includes(word))) {
          results.push({ platform: 'Blinkit', title, price, link });
        }
      }
    });

    // No mock data - return actual results only
    console.log(`Blinkit scraping complete, found ${results.length} valid results`);

    console.log(`Blinkit scraping complete, found ${results.length} valid results`);
    return results.slice(0, 5);
  } catch (err) {
    console.error('Blinkit error:', err.message);
    // No mock data on error - log error and return empty results
    console.log('Blinkit error:', err.message);
    return [];
  }
}

// Zepto Scraper with fallback to mock data
async function scrapeZepto(product) {
  const url = `https://www.zeptonow.com/search?q=${formatQuery(product)}`;
  console.log(`Scraping Zepto with URL: ${url}`);
  try {
    // Use a different user agent specifically for Zepto
    const zeptoHeaders = {
      ...headers,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
    };
    
    const { data } = await axios.get(url, { headers: zeptoHeaders });
    console.log('Zepto response received, length:', data.length);
    const $ = cheerio.load(data);
    const results = [];

    // Find product cards
    const searchResults = $('.product-card, .product-item, [data-testid="product-card"]');
    console.log(`Zepto found ${searchResults.length} search result elements`);

    searchResults.each((_, el) => {
      // Try different selectors for title
      const title = $(el).find('.product-title, .product-name, [data-testid="product-title"]').text().trim();
      
      // Try different selectors for price
      const price = $(el).find('.product-price, .price, [data-testid="product-price"]').text().trim();
      
      // Get link
      const linkHref = $(el).find('a').attr('href');
      const link = linkHref ? (linkHref.startsWith('http') ? linkHref : `https://www.zeptonow.com${linkHref}`) : '';

      console.log(`Zepto item found: ${title ? 'Title: ' + title : 'No title'}, ${price ? 'Price: ' + price : 'No price'}`);
      
      if (title && price) {
        // Filter out non-relevant products
        if (title.toLowerCase().includes(product.toLowerCase()) || 
            product.toLowerCase().split(' ').some(word => title.toLowerCase().includes(word))) {
          results.push({ platform: 'Zepto', title, price, link });
        }
      }
    });

    // No mock data - return actual results only
    console.log(`Zepto scraping complete, found ${results.length} valid results`);

    console.log(`Zepto scraping complete, found ${results.length} valid results`);
    return results.slice(0, 5);
  } catch (err) {
    console.error('Zepto error:', err.message);
    // No mock data on error - log error and return empty results
    console.log('Zepto error:', err.message);
    return [];
  }
}

// Note: removeDuplicates is now imported from utils/resultUtils.js

// Cache middleware
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log(`Cache hit for ${key}`);
      return res.json(cachedResponse);
    } else {
      console.log(`Cache miss for ${key}`);
      // Store the original json method
      const originalJson = res.json;
      
      // Override the json method
      res.json = function(body) {
        // Save the response to cache
        cache.set(key, body, duration);
        // Call the original json method
        return originalJson.call(this, body);
      };
      
    }
    next();
  };
};



// API Endpoint with caching
app.get('/search', cacheMiddleware(process.env.CACHE_TTL || 3600), async (req, res) => {
  const product = req.query.product;
  if (!product) return res.status(400).json({ error: 'Missing "product" query parameter' });

  try {
    // Add timeout to prevent hanging requests
    const timeout = setTimeout(() => {
      throw new Error('Request timed out after 30 seconds');
    }, 30000);

    // Use Promise.allSettled to ensure all scrapers run regardless of individual failures
    const results = await Promise.allSettled([
      scrapeAmazon(product).catch(err => { console.log(`Amazon scraping error: ${err.message}`); return []; }),
      scrapeFlipkart(product).catch(err => { console.log(`Flipkart scraping error: ${err.message}`); return []; }),
      scrapeMeesho(product).catch(err => { console.log(`Meesho scraping error: ${err.message}`); return []; }),
      scrapeBlinkit(product).catch(err => { console.log(`Blinkit scraping error: ${err.message}`); return []; }),
      scrapeZepto(product).catch(err => { console.log(`Zepto scraping error: ${err.message}`); return []; })
    ]);

    clearTimeout(timeout);

    // Process results
    const amazon = results[0].status === 'fulfilled' ? results[0].value : [];
    const flipkart = results[1].status === 'fulfilled' ? results[1].value : [];
    const meesho = results[2].status === 'fulfilled' ? results[2].value : [];
    const blinkit = results[3].status === 'fulfilled' ? results[3].value : [];
    const zepto = results[4].status === 'fulfilled' ? results[4].value : [];
    
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
      'Meesho': 0,
      'Blinkit': 0,
      'Zepto': 0
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

    if (results[3].status === 'fulfilled') {
      const validBlinkit = validateResults(results[3].value);
      allResults = [...allResults, ...validBlinkit];
      sources['Blinkit'] = validBlinkit.length;
    }

    if (results[4].status === 'fulfilled') {
      const validZepto = validateResults(results[4].value);
      allResults = [...allResults, ...validZepto];
      sources['Zepto'] = validZepto.length;
    }
    
    // If no results were found, we'll just return an empty array
    // This aligns with the user preference to show "No products found" message
    if (allResults.length === 0) {
      console.log('No results found');
    }

    // Remove duplicates and combine results
    const uniqueAmazon = removeDuplicates(allResults.filter(item => item.platform === 'Amazon'));
    const uniqueFlipkart = removeDuplicates(allResults.filter(item => item.platform === 'Flipkart'));
    const uniqueMeesho = removeDuplicates(allResults.filter(item => item.platform === 'Meesho'));
    const uniqueBlinkit = removeDuplicates(allResults.filter(item => item.platform === 'Blinkit'));
    const uniqueZepto = removeDuplicates(allResults.filter(item => item.platform === 'Zepto'));
    
    // Combine all unique results
    const combinedResults = [...uniqueAmazon, ...uniqueFlipkart, ...uniqueMeesho, ...uniqueBlinkit, ...uniqueZepto];
    
    // Use the imported utility functions
    
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
    
    // Use the imported categorizeResults function
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

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📊 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🔍 Search API: http://localhost:${PORT}/search?product=your+query`);
  console.log(`💻 Frontend: http://localhost:${PORT}`);
});
