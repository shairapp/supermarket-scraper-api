const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

app.options('/scrape', cors());

app.post('/scrape', async (req, res) => {
  const { shoppingList } = req.body;

  if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid shoppingList array' });
  }

  const results = { tesco: [], sainsburys: [] };

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    const searchTerm = shoppingList[0].name;

    console.log('🔍 Scraping for:', searchTerm);

    // Tesco
    try {
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, {
        waitUntil: 'domcontentloaded',
      });

      await page.waitForSelector('.product-list--list-item', { timeout: 10000 });

      results.tesco = await page.$$eval('.product-list--list-item', items =>
        items.slice(0, 3).map(item => {
          const title = item.querySelector('h3 a')?.innerText || '';
          const price = item.querySelector('.value')?.innerText || '';
          const unitPrice = item.querySelector('.price-per-quantity-weight')?.innerText || '';
          const link = 'https://www.tesco.com' + (item.querySelector('h3 a')?.getAttribute('href') || '');
          return { store: 'Tesco', title, price, unitPrice, link };
        }),
      );
    } catch (err) {
      console.error('❌ Tesco scraping failed:', err.message);
    }

    // Sainsbury’s
    try {
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, {
        waitUntil: 'domcontentloaded',
      });

      await page.waitForSelector('[data-test-id="product-list"]', { timeout: 10000 });

      results.sainsburys = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
        items.slice(0, 3).map(item => {
          const title = item.querySelector('h2, h3')?.innerText || '';
          const price = item.querySelector('[data-test-id="price"]')?.innerText || '';
          const unitPrice = item.querySelector('[data-test-id="unit-price"]')?.innerText || '';
          const link = item.querySelector('a')?.href || '';
          return { store: "Sainsbury's", title, price, unitPrice, link };
        }),
      );
    } catch (err) {
      console.error('❌ Sainsbury’s scraping failed:', err.message);
    }
  } catch (err) {
    console.error('❌ Unexpected scraping error:', err.message);
  } finally {
    await browser.close();
  }

  console.log('✅ Scraping results sent:', results);
  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛒 Scraper API running on http://localhost:${PORT}`));

