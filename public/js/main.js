document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsContainer = document.getElementById('results');
    const loader = document.getElementById('loader');
    const stats = document.getElementById('stats');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKeyButton');
    
    // Platform icons - using actual platform logos for better trust and visibility
    const platformIcons = {
        'Amazon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/320px-Amazon_logo.svg.png',
        'Flipkart': 'https://logo.clearbit.com/flipkart.com',
        'Meesho': 'https://logo.clearbit.com/meesho.com',
        'Blinkit': 'https://logo.clearbit.com/blinkit.com',
        'Zepto': 'https://logo.clearbit.com/zeptonow.com'
    };
    
    // Platform colors
    const platformColors = {
        'Amazon': 'warning',
        'Flipkart': 'primary',
        'Meesho': 'danger',
        'Blinkit': 'success',
        'Zepto': 'info'
    };
    
    // API Key management (currently disabled in UI)
    function getApiKey() {
        const savedKey = localStorage.getItem('apiKey');
        // API key input is commented out, so we don't need to update the input value
        // if (savedKey && apiKeyInput) {
        //     apiKeyInput.value = savedKey;
        // }
        return savedKey || '';
    }
    
    // API key UI elements are commented out, but we'll keep the code for future use
    if (saveApiKeyButton) {
        saveApiKeyButton.addEventListener('click', function() {
            const key = apiKeyInput.value.trim();
            if (key) {
                localStorage.setItem('apiKey', key);
                alert('API key saved!');
            } else {
                localStorage.removeItem('apiKey');
                alert('API key removed!');
            }
        });
    }
    
    // Load API key on page load
    getApiKey();
    
    // Function to simplify product titles
    function simplifyTitle(title) {
        if (!title) return '';
        
        // Convert to lowercase for easier manipulation
        let simplified = title
            .replace(/\bpremium\b/i, '') // Remove 'premium'
            .replace(/\bquality\b/i, '') // Remove 'quality'
            .replace(/\boriginal\b/i, '') // Remove 'original'
            .replace(/\bspecial\b/i, '') // Remove 'special'
            .replace(/\boffer\b/i, '') // Remove 'offer'
            .replace(/\bdeal\b/i, '') // Remove 'deal'
            .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
            .trim();
        
        // If title is too long, truncate it
        if (simplified.length > 70) {
            simplified = simplified.substring(0, 67) + '...';
        }
        
        return simplified;
    }
    
    // Extract numeric price from price string
    function extractNumericPrice(priceStr) {
        const matches = priceStr.match(/[\d,]+\.?\d*/g);
        if (matches && matches.length > 0) {
            return parseFloat(matches[0].replace(/,/g, ''));
        }
        return Number.MAX_VALUE; // If price can't be parsed
    }
    
    // Function to create product card
    function createProductCard(product, priceCategory) {
        const platformIcon = platformIcons[product.platform] || '';
        const platformColor = platformColors[product.platform] || 'secondary';
        
        // Format attributes for display
        let attributesHTML = '';
        let unitPriceHTML = '';
        
        if (product.attributes) {
            const attrs = [];
            
            if (product.attributes.weight) {
                attrs.push(`<span class="badge bg-light text-dark">${product.attributes.weight}</span>`);
            }
            
            if (product.attributes.packSize) {
                attrs.push(`<span class="badge bg-light text-dark">Pack of ${product.attributes.packSize}</span>`);
            }
            
            if (product.attributes.features && product.attributes.features.length > 0) {
                product.attributes.features.forEach(feature => {
                    attrs.push(`<span class="badge bg-info text-white">${feature}</span>`);
                });
            }
            
            // Add unit price if available
            if (product.attributes.unitPriceFormatted) {
                unitPriceHTML = `<p class="card-text unit-price">Unit price: <strong>${product.attributes.unitPriceFormatted}</strong></p>`;
            }
            
            if (attrs.length > 0) {
                attributesHTML = `
                    <div class="product-attributes mb-2">
                        ${attrs.join(' ')}
                    </div>
                `;
            }
        }
        
        return `
            <div class="col-12 col-md-6 col-lg-4 mb-4">
                <div id="product-${product.id}" class="card result-card ${priceCategory}">
                    <div class="card-body">
                        <span class="badge bg-${platformColor} platform-badge">
                            <img src="${platformIcon}" class="platform-icon" alt="${product.platform}"> ${product.platform}
                        </span>
                        <h5 class="card-title mt-2">${simplifyTitle(product.title)}</h5>
                        ${attributesHTML}
                        <p class="card-text price">${product.price}</p>
                        ${unitPriceHTML}
                        <div class="mt-auto">
                            <a href="${product.link}" target="_blank" class="btn btn-sm btn-outline-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-box-arrow-up-right me-1" viewBox="0 0 16 16">
                                    <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                                    <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                                </svg>
                                View Product
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Search function
    function searchProducts() {
        const query = searchInput.value.trim();
        
        if (!query) return;
        
        // Show loader
        loader.style.display = 'block';
        resultsContainer.innerHTML = '';
        stats.innerHTML = '';
        
        fetch(`/search?product=${encodeURIComponent(query)}&api_key=${encodeURIComponent(getApiKey())}`)
            .then(response => response.json())
            .then(data => {
                // Hide loader
                loader.style.display = 'none';
                
                // Clear previous results
                resultsContainer.innerHTML = '';
                
                // Show stats
                stats.innerHTML = `
                    <div class="alert alert-info">
                        Found ${data.count} products from ${Object.keys(data.sources).filter(s => data.sources[s] > 0).length} sources
                    </div>
                `;
                stats.style.display = 'block';
                
                // Show "no results" message if no products found
                if (data.count === 0) {
                    resultsContainer.innerHTML = `
                        <div class="alert alert-warning text-center p-5 mt-4">
                            <h4>🔍 No products found</h4>
                            <p class="mt-3">We couldn't find any products matching your search. Please try:</p>
                            <ul class="text-start" style="display: inline-block;">
                                <li>Checking your spelling</li>
                                <li>Using more general keywords</li>
                                <li>Removing brand names</li>
                                <li>Searching for similar products</li>
                            </ul>
                        </div>
                    `;
                    return;
                }
                
                // Create comparison table with best options
                let resultsHTML = '';
                
                // Get top products for comparison (2 from exact matches, 1 from alternatives)
                const topProducts = [];
                
                // Add top exact matches
                if (data.exactMatches && data.exactMatches.length > 0) {
                    // Sort by unit price if available, otherwise by package price
                    const sortedExact = [...data.exactMatches].sort((a, b) => {
                        const aUnitPrice = a.attributes?.unitPrice || 0;
                        const bUnitPrice = b.attributes?.unitPrice || 0;
                        
                        if (aUnitPrice && bUnitPrice) return aUnitPrice - bUnitPrice;
                        if (aUnitPrice) return -1;
                        if (bUnitPrice) return 1;
                        return extractNumericPrice(a.price) - extractNumericPrice(b.price);
                    });
                    
                    // Add up to 2 top exact matches
                    topProducts.push(...sortedExact.slice(0, Math.min(2, sortedExact.length)));
                }
                
                // Add top alternative
                if (data.alternatives && data.alternatives.length > 0) {
                    // Sort by unit price if available, otherwise by package price
                    const sortedAlternatives = [...data.alternatives].sort((a, b) => {
                        const aUnitPrice = a.attributes?.unitPrice || extractNumericPrice(a.price);
                        const bUnitPrice = b.attributes?.unitPrice || extractNumericPrice(b.price);
                        return aUnitPrice - bUnitPrice;
                    });
                    
                    // Add the best alternative
                    if (sortedAlternatives.length > 0) {
                        topProducts.push(sortedAlternatives[0]);
                    }
                }
                
                // Create comparison table if we have products to compare
                if (topProducts.length > 0) {
                    // Find the best value product (lowest unit price)
                    let bestValueProduct = topProducts[0];
                    topProducts.forEach(product => {
                        const productUnitPrice = product.attributes?.unitPrice || 0;
                        const bestUnitPrice = bestValueProduct.attributes?.unitPrice || 0;
                        
                        if (productUnitPrice && 
                            (!bestUnitPrice || productUnitPrice < bestUnitPrice)) {
                            bestValueProduct = product;
                        }
                    });
                    
                    // Build single comparison card with products stacked vertically
                    resultsHTML += `
                        <div class="col-12 mb-4">
                            <h3 class="section-title">Quick Comparison</h3>
                            <div class="comparison-container">
                                <div class="comparison-card">
                                    <div class="comparison-header">
                                        <div class="row align-items-center">
                                            <div class="col-12 col-md-5">Product</div>
                                            <div class="col-4 col-md-2">Price</div>
                                            <div class="col-4 col-md-2">Platform</div>
                                            <div class="col-4 col-md-3">Action</div>
                                        </div>
                                    </div>
                    `;
                    
                    // Add each product to the comparison table
                    // Sort products by unit price for the color coding
                    const sortedByPrice = [...topProducts].sort((a, b) => {
                        const aUnitPrice = a.attributes?.unitPrice || extractNumericPrice(a.price);
                        const bUnitPrice = b.attributes?.unitPrice || extractNumericPrice(b.price);
                        return aUnitPrice - bUnitPrice;
                    });
                    
                    topProducts.forEach(product => {
                        const isBestValue = product.id === bestValueProduct.id;
                        const platformIcon = platformIcons[product.platform] || '';
                        
                        // Determine price class based on unit price ranking
                        let priceClass = 'mid-price';
                        const productUnitPrice = product.attributes?.unitPrice || extractNumericPrice(product.price);
                        
                        if (productUnitPrice === (sortedByPrice[0].attributes?.unitPrice || extractNumericPrice(sortedByPrice[0].price))) {
                            priceClass = 'best-price'; // Lowest price (green)
                        } else if (sortedByPrice.length > 2 && 
                                  productUnitPrice === (sortedByPrice[sortedByPrice.length-1].attributes?.unitPrice || 
                                                     extractNumericPrice(sortedByPrice[sortedByPrice.length-1].price))) {
                            priceClass = 'highest-price'; // Highest price (red)
                        }
                        const simplifiedTitle = simplifyTitle(product.title);
                        const weight = product.attributes?.weight || '';
                        const unitPriceFormatted = product.attributes?.unitPriceFormatted || '';
                        
                        resultsHTML += `
                            <div class="comparison-product ${isBestValue ? 'best-value' : ''} ${priceClass}">
                                <div class="row align-items-center">
                                    <div class="col-12 col-md-5 mb-3 mb-md-0">
                                        <div class="product-title">
                                            ${simplifiedTitle}
                                            ${isBestValue ? '<span class="best-value-badge">Best Value</span>' : ''}
                                        </div>
                                        ${weight ? `<div class="product-size">${weight}</div>` : ''}
                                    </div>
                                    <div class="col-4 col-md-2">
                                        <div class="product-price">${product.price}</div>
                                        <div class="unit-price">${unitPriceFormatted}</div>
                                    </div>
                                    <div class="col-4 col-md-2">
                                        <img src="${platformIcon}" class="platform-icon" alt="${product.platform}">
                                        <div>${product.platform}</div>
                                    </div>
                                    <div class="col-4 col-md-3">
                                        <a href="${product.link}" target="_blank" class="btn btn-sm btn-outline-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-box-arrow-up-right me-1" viewBox="0 0 16 16">
                                                <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                                                <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                                            </svg>
                                            View
                                        </a>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    resultsHTML += `
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Add exact matches section if available
                if (data.exactMatches && data.exactMatches.length > 0) {
                    resultsHTML += `
                        <div class="col-12 mb-4">
                            <h3 class="section-title">Exact Matches (${data.exactMatches.length})</h3>
                            <div class="row exact-matches" id="exactMatches"></div>
                        </div>
                    `;
                }
                
                // Add alternatives section if available
                if (data.alternatives && data.alternatives.length > 0) {
                    resultsHTML += `
                        <div class="col-12 mb-4">
                            <h3 class="section-title">Similar Products (${data.alternatives.length})</h3>
                            <div class="row alternatives" id="alternatives"></div>
                        </div>
                    `;
                }
                
                // Add the section containers
                resultsContainer.innerHTML = resultsHTML;
                
                // Process exact matches
                const exactMatchesWithPrice = data.exactMatches.map(product => ({
                    ...product,
                    numericPrice: extractNumericPrice(product.price),
                    unitPrice: product.attributes && product.attributes.unitPrice ? product.attributes.unitPrice : 0
                }));
                
                // Process alternatives
                const alternativesWithPrice = data.alternatives.map(product => ({
                    ...product,
                    numericPrice: extractNumericPrice(product.price),
                    unitPrice: product.attributes && product.attributes.unitPrice ? product.attributes.unitPrice : 0
                }));
                
                // Combine all products for price categorization
                const allWithPrice = [...exactMatchesWithPrice, ...alternativesWithPrice];
                
                // Find products with unit price for better comparison
                const productsWithUnitPrice = allWithPrice.filter(p => p.unitPrice > 0);
                
                // Find price range for categorization
                let cheapestUnitPrice = Number.MAX_VALUE;
                let mostExpensiveUnitPrice = 0;
                
                // Only proceed with unit price categorization if we have products with valid unit prices
                if (productsWithUnitPrice.length > 0) {
                    productsWithUnitPrice.forEach(product => {
                        if (product.unitPrice < cheapestUnitPrice) cheapestUnitPrice = product.unitPrice;
                        if (product.unitPrice > mostExpensiveUnitPrice) mostExpensiveUnitPrice = product.unitPrice;
                    });
                } else {
                    // Fallback to package price if no unit prices available
                    allWithPrice.forEach(product => {
                        if (product.numericPrice < cheapestUnitPrice) cheapestUnitPrice = product.numericPrice;
                        if (product.numericPrice > mostExpensiveUnitPrice) mostExpensiveUnitPrice = product.numericPrice;
                    });
                }
                
                const priceRange = mostExpensiveUnitPrice - cheapestUnitPrice;
                const mediumPriceThreshold = cheapestUnitPrice + (priceRange / 3);
                const expensivePriceThreshold = cheapestUnitPrice + (2 * priceRange / 3);
                
                // Determine price category for each product
                exactMatchesWithPrice.forEach(product => {
                    // Use unit price if available, otherwise fall back to package price
                    const priceToCompare = product.unitPrice > 0 ? product.unitPrice : product.numericPrice;
                    let priceCategory = '';
                    
                    if (priceToCompare <= mediumPriceThreshold) {
                        priceCategory = 'cheapest';
                    } else if (priceToCompare <= expensivePriceThreshold) {
                        priceCategory = 'medium-price';
                    } else {
                        priceCategory = 'expensive';
                    }
                    
                    product.priceCategory = priceCategory;
                });
                
                alternativesWithPrice.forEach(product => {
                    // Use unit price if available, otherwise fall back to package price
                    const priceToCompare = product.unitPrice > 0 ? product.unitPrice : product.numericPrice;
                    let priceCategory = '';
                    
                    if (priceToCompare <= mediumPriceThreshold) {
                        priceCategory = 'cheapest';
                    } else if (priceToCompare <= expensivePriceThreshold) {
                        priceCategory = 'medium-price';
                    } else {
                        priceCategory = 'expensive';
                    }
                    
                    product.priceCategory = priceCategory;
                });
                
                // Display exact matches
                if (exactMatchesWithPrice.length > 0) {
                    const exactMatchesContainer = document.getElementById('exactMatches');
                    exactMatchesWithPrice.forEach(product => {
                        exactMatchesContainer.innerHTML += createProductCard(product, product.priceCategory);
                    });
                }
                
                // Display alternatives
                if (alternativesWithPrice.length > 0) {
                    const alternativesContainer = document.getElementById('alternatives');
                    alternativesWithPrice.forEach(product => {
                        alternativesContainer.innerHTML += createProductCard(product, product.priceCategory);
                    });
                }
            })
            .catch(error => {
                loader.style.display = 'none';
                resultsContainer.innerHTML = '<div class="col-12 text-center"><p>Error searching for products. Please try again.</p></div>';
                console.error('Error:', error);
            });
    }
    
    // Event listeners
    searchButton.addEventListener('click', searchProducts);
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchProducts();
        }
    });
});
