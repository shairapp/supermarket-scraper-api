const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const allowedOrigins = [
  'https://smart-cart-compare-ai.lovable.app',
  'https://preview--smart-cart-compare-ai.lovable.app',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.options('/scrape', cors()); // Preflight

app.post('/scrape', async (req, res) => {
  const { shoppingList } = req.body;

  if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid shoppingList array' });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {
    tesco: [],
    sainsburys: []
  };

  try {
    const searchTerm = shoppingList[0]?.name || '';
    console.log('🔍 Scraping for:', searchTerm);

    // 🛒 Tesco
    try {
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-list--list-item', { timeout: 8000 });
      results.tesco = await page.$$eval('.product-list--list-item', items =>
        items.slice(0, 3).map(item => {
          const title = item.querySelector('h3 a')?.innerText || '';
          const price = item.querySelector('.value')?.innerText || '';
          const unitPrice = item.querySelector('.price-per-quantity-weight')?.innerText || '';
          const link = 'https://www.tesco.com' + (item.querySelector('h3 a')?.getAttribute('href') || '');
          return { store: 'Tesco', title, price, unitPrice, link };
        })
      );
    } catch (tescoError) {
      console.error('❌ Tesco scraping failed:', tescoError.message);
    }

    // 🛒 Sainsbury's
    try {
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-test-id="product-list"]', { timeout: 8000 });
      results.sainsburys = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
        items.slice(0, 3).map(item => {
          const title = item.querySelector('h2, h3')?.innerText || '';
          const price = item.querySelector('[data-test-id="price"]')?.innerText || '';
          const unitPrice = item.querySelector('[data-test-id="unit-price"]')?.innerText || '';
          const link = item.querySelector('a')?.href || '';
          return { store: "Sainsbury's", title, price, unitPrice, link };
        })
      );
    } catch (sainsburysError) {
      console.error('❌ Sainsbury\'s scraping failed:', sainsburysError.message);
    }

    res.json(results);

  } catch (err) {
    console.error('💥 Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛒 Scraper API running on http://localhost:${PORT}`));
