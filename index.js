const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: [
    'https://smart-cart-compare-ai.lovable.app',
    'https://preview--smart-cart-compare-ai.lovable.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.options('/scrape', cors(corsOptions));
app.use(express.json());

app.post('/scrape', async (req, res) => {
  const shoppingList = req.body.shoppingList;
  if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid shoppingList array' });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  try {
    for (const item of shoppingList) {
      const searchTerm = item.name;
      const preference = item.preference || 'cheapest';

      const result = { productName: searchTerm, preference, options: [] };

      // Tesco
      await page.goto(`https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-list--list-item', { timeout: 10000 });
      const tescoItems = await page.$$eval('.product-list--list-item', items =>
        items.slice(0, 3).map((item, i) => ({
          id: `tesco-${i}`,
          name: item.querySelector('h3 a')?.innerText || '',
          price: parseFloat(item.querySelector('.value')?.innerText.replace('£', '') || '0'),
          quantity: '',
          pricePerUnit: item.querySelector('.price-per-quantity-weight')?.innerText || '',
          store: 'Tesco',
          qualityScore: Math.floor(Math.random() * 5) + 1,
          isPreferred: false,
          link: 'https://www.tesco.com' + (item.querySelector('h3 a')?.getAttribute('href') || '')
        }))
      );

      // Sainsbury’s
      await page.goto(`https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-test-id="product-list"]', { timeout: 10000 });
      const sainsburyItems = await page.$$eval('[data-test-id="product"], [data-test-id="product-tile"]', items =>
        items.slice(0, 3).map((item, i) => ({
          id: `sainsburys-${i}`,
          name: item.querySelector('h2, h3')?.innerText || '',
          price: parseFloat(item.querySelector('[data-test-id="price"]')?.innerText.replace('£', '') || '0'),
          quantity: '',
          pricePerUnit: item.querySelector('[data-test-id="unit-price"]')?.innerText || '',
          store: 'Sainsbury\'s',
          qualityScore: Math.floor(Math.random() * 5) + 1,
          isPreferred: false,
          link: item.querySelector('a')?.href || ''
        }))
      );

      result.options = [...tescoItems, ...sainsburyItems];

      // Set preference
      if (preference === 'cheapest') {
        result.options.sort((a, b) => a.price - b.price);
      } else if (preference === 'highest-quality') {
        result.options.sort((a, b) => b.qualityScore - a.qualityScore);
      } else if (preference === 'best-value') {
        result.options.sort((a, b) => (a.price / a.qualityScore) - (b.price / b.qualityScore));
      }

      if (result.options.length > 0) result.options[0].isPreferred = true;

      results.push(result);
    }

    await browser.close();
    return res.json({ results });
  } catch (error) {
    await browser.close();
    console.error("Scraper error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => console.log(`🛒 Scraper API running on http://localhost:${PORT}`));
