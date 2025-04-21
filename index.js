const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());
app.use(cors());

// Preflight handler
app.options('/scrape', cors());

app.post('/scrape', async (req, res) => {
  const { shoppingList } = req.body;

  if (!Array.isArray(shoppingList) || shoppingList.length === 0 || !shoppingList[0].name) {
    return res.status(400).json({ error: 'Missing or invalid shoppingList array' });
  }

  const searchTerm = shoppingList[0].name;
  console.log(`🔍 Scraping for: ${searchTerm}`);

  const results = { tesco: [], sainsburys: [] };

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // TESCO SCRAPING
    try {
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

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

    // SAINSBURY'S SCRAPING
    try {
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      results.sainsburys = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
        items.slice(0, 3).map(item => {
          const title = item.querySelector('h2, h3')?.innerText || '';
          const price = item.querySelector('[data-test-id="price"]')?.innerText || '';
          const unitPrice = item.querySelector('[data-test-id="unit-price"]')?.innerText || '';
          const link = item.querySelector('a')?.href || '';
          return { store: "Sainsbury's", title, price, unitPrice, link };
        })
      );
    } catch (sainsError) {
      console.error('❌ Sainsbury\'s scraping failed:', sainsError.message);
    }

    await browser.close();
    return res.json(results);

  } catch (error) {
    console.error('❌ Scraper crashed:', error);
    return res.status(500).json({ error: 'Scraper crashed', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛒 Scraper API running on http://localhost:${PORT}`));
