const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// ✅ CORS config for Lovable production & preview
const corsOptions = {
  origin: [
    'https://smart-cart-compare-ai.lovable.app',
    'https://preview--smart-cart-compare-ai.lovable.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ✅ Scraping handler
app.post('/scrape', async (req, res) => {
  const shoppingList = req.body.shoppingList;

  if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
    console.log('❌ Invalid shopping list:', shoppingList);
    return res.status(400).json({ error: 'Missing or invalid shopping list' });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  try {
    for (const item of shoppingList) {
      const searchTerm = item.name?.trim();
      const preference = item.preference || 'cheapest';

      if (!searchTerm) continue;
      console.log(`🔍 Searching for: ${searchTerm}`);

      // Tesco scrape
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-list--list-item', { timeout: 10000 });
      const tescoItems = await page.$$eval('.product-list--list-item', items =>
        items.slice(0, 3).map((item, i) => {
          const title = item.querySelector('h3 a')?.innerText || '';
          const price = item.querySelector('.value')?.innerText || '';
          const unitPrice = item.querySelector('.price-per-quantity-weight')?.innerText || '';
          const link = 'https://www.tesco.com' + (item.querySelector('h3 a')?.getAttribute('href') || '');
          return {
            id: `Tesco-${i}`,
            store: 'Tesco',
            title, price, unitPrice, link,
            qualityScore: Math.floor(Math.random() * 5) + 1
          };
        })
      );

      // Sainsbury's scrape
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-test-id="product-list"]', { timeout: 10000 });
      const sainsburyItems = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
        items.slice(0, 3).map((item, i) => {
          const title = item.querySelector('h2, h3')?.innerText || '';
          const price = item.querySelector('[data-test-id="price"]')?.innerText || '';
          const unitPrice = item.querySelector('[data-test-id="unit-price"]')?.innerText || '';
          const link = item.querySelector('a')?.href || '';
          return {
            id: `Sainsbury-${i}`,
            store: "Sainsbury's",
            title, price, unitPrice, link,
            qualityScore: Math.floor(Math.random() * 5) + 1
          };
        })
      );

      // Combine results
      let options = [...tescoItems, ...sainsburyItems];

      if (preference === 'cheapest') {
        options.sort((a, b) => parseFloat(a.price.replace(/[^\d.]/g, '')) - parseFloat(b.price.replace(/[^\d.]/g, '')));
      } else if (preference === 'highest-quality') {
        options.sort((a, b) => b.qualityScore - a.qualityScore);
      } else if (preference === 'best-value') {
        options.sort((a, b) => {
          const aVal = parseFloat(a.price.replace(/[^\d.]/g, '')) / a.qualityScore;
          const bVal = parseFloat(b.price.replace(/[^\d.]/g, '')) / b.qualityScore;
          return aVal - bVal;
        });
      }

      if (options.length > 0) options[0].isPreferred = true;

      results.push({
        productName: searchTerm,
        preference,
        options
      });
    }

    await browser.close();
    console.log(`✅ Done processing ${results.length} results`);
    res.json({ results });

  } catch (err) {
    console.error('❌ Scraper Error:', err);
    await browser.close();
    res.status(500).json({ error: 'Scraper failed', details: err.message });
  }
});

// ✅ Launch server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛒 Scraper API running on http://localhost:${PORT}`);
});

