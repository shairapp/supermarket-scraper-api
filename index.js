const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Allow requests from Lovable
app.use(cors({
  origin: 'https://smart-cart-compare-ai.lovable.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ✅ Handle preflight
app.options('/scrape', cors());

// 🧠 Scraping endpoint
app.post('/scrape', async (req, res) => {
  const { shoppingList } = req.body;

  if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid shoppingList array' });
  }

  const searchTerm = shoppingList[0]?.name || '';
  if (!searchTerm) {
    return res.status(400).json({ error: 'Missing search term in shoppingList[0].name' });
  }

  console.log('🔍 Scraping for:', searchTerm);

  const results = {
    tesco: [],
    sainsburys: []
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // 🔍 Tesco
    try {
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('.product-list--list-item', { timeout: 5000 });
      results.tesco = await page.$$eval('.product-list--list-item', items =>
        items.slice(0, 3).map(item => {
          const title = item.querySelector('h3 a')?.innerText || '';
          const price = item.querySelector('.value')?.innerText || '';
          const unitPrice = item.querySelector('.price-per-quantity-weight')?.innerText || '';
          const link = 'https://www.tesco.com' + (item.querySelector('h3 a')?.getAttribute('href') || '');
          return { store: 'Tesco', title, price, unitPrice, link };
        })
      );
    } catch (err) {
      console.error('❌ Tesco scraping failed:', err.message);
    }

    // 🔍 Sainsbury’s
    try {
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('[data-test-id="product-list"]', { timeout: 5000 });
      results.sainsburys = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
        items.slice(0, 3).map(item => {
          const title = item.querySelector('h2, h3')?.innerText || '';
          const price = item.querySelector('[data-test-id="price"]')?.innerText || '';
          const unitPrice = item.querySelector('[data-test-id="unit-price"]')?.innerText || '';
          const link = item.querySelector('a')?.href || '';
          return { store: "Sainsbury's", title, price, unitPrice, link };
        })
      );
    } catch (err) {
      console.error('❌ Sainsbury’s scraping failed:', err.message);
    }

    res.json(results);
  } catch (err) {
    console.error('❌ Scraper error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await browser.close();
  }
});

// 🟢 Start server
app.listen(PORT, () => {
  console.log(`🛒 Scraper API running on http://localhost:${PORT}`);
});
