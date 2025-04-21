const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// ✅ Explicit CORS config for Lovable
const corsOptions = {
  origin: 'https://smart-cart-compare-ai.lovable.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.options('/scrape', cors(corsOptions)); // ✅ Handle CORS preflight for /scrape

// ✅ Scraping endpoint
app.post('/scrape', async (req, res) => {
  const searchTerm = req.body.searchTerm;
  if (!searchTerm) return res.status(400).json({ error: 'Missing search term' });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {
    tesco: [],
    sainsburys: []
  };

  try {
    // 🔍 Tesco
    await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, { waitUntil: 'domcontentloaded' });
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

    // 🔍 Sainsbury's
    await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, { waitUntil: 'domcontentloaded' });
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

  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    await browser.close();
  }

  res.json(results);
});

// ✅ Launch server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛒 Scraper API running on http://localhost:${PORT}`));

