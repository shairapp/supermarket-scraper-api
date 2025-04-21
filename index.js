const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.send('🛒 Supermarket Scraper API is running!');
});

// POST /scrape endpoint
app.post('/scrape', async (req, res) => {
  const { shoppingList } = req.body;

  if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid shoppingList array' });
  }

  const searchTerm = shoppingList[0]?.name?.trim();
  if (!searchTerm) {
    return res.status(400).json({ error: 'Invalid or empty product name' });
  }

  console.log(`🔍 Scraping for: ${searchTerm}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.117 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  const results = {
    tesco: [],
    sainsburys: []
  };

  try {
    // 🔍 Tesco
    try {
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, {
        waitUntil: 'networkidle2',
        timeout: 20000
      });

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
    } catch (error) {
      console.error('❌ Tesco scraping failed:', error.message);
    }

    // 🔍 Sainsbury’s
    try {
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, {
        waitUntil: 'networkidle2',
        timeout: 20000
      });

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
      console.error("❌ Sainsbury’s scraping failed:", error.message);
    }

    console.log('✅ Scraping complete:', results);
    res.status(200).json(results);
  } catch (error) {
    console.error('🔥 Scraping crash:', error);
    res.status(500).json({ error: 'Scraping failed', details: error.message });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛒 Scraper API running on http://localhost:${PORT}`));
