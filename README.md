# Where to Buy AI Agent

A full-stack web application that helps users find the best online platforms to purchase products in India. The app aggregates real-time data from top e-commerce platforms (Amazon, Flipkart, Meesho) using their official APIs and presents users with direct links, prices, and availability. The project emphasizes trust, usability, and compliance with platform terms of service by using official APIs and SVG platform logos.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Setup & Installation](#setup--installation)
- [Usage](#usage)
- [Platform Logos](#platform-logos)
- [Data Policy](#data-policy)
- [Contributing](#contributing)
- [License](#license)

---

## Features
- **Real-time Product Search:** Aggregates product listings from Amazon, Flipkart, and Meesho using their official APIs.
- **Platform Logos:** Uses locally hosted, official SVG logos for each platform (no emojis) for enhanced user trust and visibility.
- **Compliant with Terms of Service:** Uses official APIs instead of web scraping to comply with platform terms of service.
- **Modern UI/UX:** Clean, intuitive interface with responsive design and clear visual cues.
- **Fast & Secure:** Optimized for performance and security best practices.

---

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Backend:** Node.js (Express)
- **API Integration:** Official APIs for Amazon, Flipkart, and Meesho
- **Assets:** SVG logos hosted locally in `/public/assets/logos/`

---

## Project Structure
```
where-to-buy-ai-agent/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── main.js
│   └── assets/
│       └── logos/
│           ├── amazon.svg
│           ├── flipkart.svg
│           ├── meesho.svg
│           ├── blinkit.svg
│           └── zepto.svg
├── utils/
│   └── resultUtils.js
├── server.js
├── package.json
└── README.md
```

---

## How It Works
1. **User Search:** User enters a product name in the search bar.
2. **Backend Query:** The backend makes API calls to each supported platform.
3. **Results Aggregation:** API results are normalized and sent to the frontend.
4. **Display:** The frontend shows the results with platform logos, prices, and direct links. If no products are found, a helpful message with suggestions is shown.

---

## Setup & Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/AnkitMaheshwariIn/where-to-buy-ai-agent.git
   cd where-to-buy-ai-agent
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up API keys:**
   Create a `.env` file in the root directory with the following variables:
   ```
   # Amazon Product Advertising API
   AMAZON_ACCESS_KEY=your_amazon_access_key
   AMAZON_SECRET_KEY=your_amazon_secret_key
   AMAZON_PARTNER_TAG=your_amazon_partner_tag
   AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # India marketplace
   
   # Flipkart Affiliate API
   FLIPKART_AFFILIATE_ID=your_flipkart_affiliate_id
   FLIPKART_AFFILIATE_TOKEN=your_flipkart_affiliate_token
   
   # Meesho API (via Partner Program)
   MEESHO_API_KEY=your_meesho_api_key
   
   # General settings
   PORT=3000
   CACHE_TTL=3600
   REQUIRE_API_KEY=false
   ```
4. **Run the server:**
   ```bash
   node server.js
   ```
5. **Open in browser:**
   Visit [http://localhost:3000](http://localhost:3000)

---

## Usage
- Enter a product name (e.g., "iPhone 15") in the search bar and hit search.
- View real-time results from all supported platforms, each with official logo, price, and direct link.
- If no results are found, suggestions are shown to improve your search (e.g., try different spellings, use generic terms).

---

## Platform Logos
- All platform logos are official SVGs, hosted locally in `/public/assets/logos/`.
- Amazon uses the icon version for better contrast.
- Logos are styled for visibility against colored backgrounds.

---

## Data Policy
- **No Mock Data:** Only real-time, scraped results are shown.
- **Privacy:** No user data is stored or tracked.
- **Compliance:** Scrapers are designed to respect platform terms and avoid excessive requests.

---

## Contributing
Contributions are welcome! Please open issues or submit PRs for improvements or new features.

---

## License
This is a private project owned by Ankit Maheshwari. All rights reserved. Unauthorized use, distribution, or modification is strictly prohibited.
