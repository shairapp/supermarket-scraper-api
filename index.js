const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// ✅ Explicit CORS config for Lovable and Railway
const corsOptions = {
  origin: 'https://smart-cart-compare-ai.lovable.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
app.options('/scrape', cors(corsOptions));

// ✅ Scraping endpoint with validation and logs
app.post('/scrape', async (req, res) => {
  const { searchTerm } = req.body;

  console.log('🔍 Received POST /scrape request:', req.body);

  if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
    console.error('❌ Invalid searchTerm:', searchTerm);
    return res.status(400).json({ error: 'Missing or invalid search term' });
  }

  const results = {
    tesco: [],
    sainsburys: []
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Tesco
    console.log(`🛒 Scraping Tesco for "${searchTerm}"`);
    await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(searchTerm)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.product-list--list-item', { timeout: 10000 });
    results.tesco = await page.$$eval('.product-list--list-item', items =>
      items.slice(0, 3).map(item => {
        const title = item.querySelector('h3 a')?.innerText || '';
        const price = item.querySelector('.value')?.innerText || '';
        const unitPrice = item.querySelector('.price-per-quantity-weight')?.innerText || '';
        const link = 'https://www.tesco.com' + (item.querySelector('h3 a')?.getAttribute('href') || '');
        return { store: 'Tesco', title, price, unitPrice, link };
      })
    );

    // Sainsbury's
    console.log(`🛒 Scraping Sainsbury's for "${searchTerm}"`);
    await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(searchTerm)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-test-id="product-list"]', { timeout: 10000 });
    results.sainsburys = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
      items.slice(0, 3).map(item => {
        const title = item.querySelector('h2, h3')?.innerText || '';
        const price = item.querySelector('[data-test-id="price"]')?.innerText || '';
        const unitPrice = item.querySelector('[data-test-id="unit-price"]')?.innerText || '';
        const link = item.querySelector('a')?.href || '';
        return { store: "Sainsbury's", title, price, unitPrice, link };
      })
    );

    console.log('✅ Scraping complete:', results);

    res.json(results);
  } catch (error) {
    console.error('🔥 Scraping error:', error);
    res.status(500).json({ error: 'Internal scraping error', message: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Scraper API running on http://localhost:${PORT}`);
});
