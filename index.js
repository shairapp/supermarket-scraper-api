const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// ✅ CORS for Lovable preview domain
const corsOptions = {
  origin: 'https://preview--smart-cart-compare-ai.lovable.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.options('/scrape', cors(corsOptions));

// 🔁 Dynamic multi-item scraping
app.post('/scrape', async (req, res) => {
  const shoppingList = req.body.shoppingList;

  if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty shopping list' });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];

  try {
    for (const item of shoppingList) {
      const searchTerm = item.name;
      const preference = item.preference || 'cheapest';
      const productOptions = [];

      // 🔍 Tesco
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-list--list-item', { timeout: 10000 });
      const tescoResults = await page.$$eval('.product-list--list-item', items =>
        items.slice(0, 3).map((item, index) => {
          const title = item.querySelector('h3 a')?.innerText || '';
          const price = item.querySelector('.value')?.innerText || '';
          const unitPrice = item.querySelector('.price-per-quantity-weight')?.innerText || '';
          const link = 'https://www.tesco.com' + (item.querySelector('h3 a')?.getAttribute('href') || '');
          return {
            id: `Tesco-${searchTerm}-${index}`,
            name: title,
            price: parseFloat(price.replace(/[^\d.]/g, '')) || 0,
            quantity: '',
            pricePerUnit: unitPrice,
            qualityScore: Math.floor(Math.random() * 5) + 1,
            store: 'Tesco',
            isPreferred: false,
            link
          };
        })
      );

      // 🔍 Sainsbury's
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-test-id="product-list"]', { timeout: 10000 });
      const sainsburysResults = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
        items.slice(0, 3).map((item, index) => {
          const title = item.querySelector('h2, h3')?.innerText || '';
          const price = item.querySelector('[data-test-id="price"]')?.innerText || '';
          const unitPrice = item.querySelector('[data-test-id="unit-price"]')?.innerText || '';
          const link = item.querySelector('a')?.href || '';
          return {
            id: `Sainsburys-${searchTerm}-${index}`,
            name: title,
            price: parseFloat(price.replace(/[^\d.]/g, '')) || 0,
            quantity: '',
            pricePerUnit: unitPrice,
            qualityScore: Math.floor(Math.random() * 5) + 1,
            store: "Sainsbury's",
            isPreferred: false,
            link
          };
        })
      );

      const options = [...tescoResults, ...sainsburysResults];

      // ✅ Apply preference logic
      if (preference === 'cheapest') {
        options.sort((a, b) => a.price - b.price);
      } else if (preference === 'highest-quality') {
        options.sort((a, b) => b.qualityScore - a.qualityScore);
      } else if (preference === 'best-value') {
        options.sort((a, b) => a.price / a.qualityScore - b.price / b.qualityScore);
      }
      if (options.length > 0) options[0].isPreferred = true;

      results.push({ productName: searchTerm, preference, options });
    }
  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ error: 'Scraping failed' });
  } finally {
    await browser.close();
  }

  res.json({ results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛒 Scraper API running on http://localhost:${PORT}`));
