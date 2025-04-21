const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());

// ✅ Explicit CORS config for Lovable
const corsOptions = {
  origin: 'https://smart-cart-compare-ai.lovable.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.options('/scrape', cors(corsOptions)); // Preflight handling

// ✅ The main API route
app.post('/scrape', async (req, res) => {
  const { searchTerm } = req.body;

  if (!searchTerm) {
    return res.status(400).json({ error: 'Missing search term' });
  }

  // You’ll add real scraping here later
  const fakeTesco = {
    store: 'Tesco',
    title: `Tesco ${searchTerm}`,
    price: 2.00,
    quantity: '500g',
    unitPrice: '£0.40/100g',
    link: `https://www.tesco.com/search?q=${searchTerm}`,
  };

  const fakeSainsburys = {
    store: 'Sainsbury\'s',
    title: `Sainsbury's ${searchTerm}`,
    price: 2.20,
    quantity: '500g',
    unitPrice: '£0.44/100g',
    link: `https://www.sainsburys.co.uk/shop/groceries/results?q=${searchTerm}`,
  };

  const results = {
    tesco: [fakeTesco],
    sainsburys: [fakeSainsburys],
  };

  // ✅ CORS headers for POST response
  res.set({
    'Access-Control-Allow-Origin': 'https://smart-cart-compare-ai.lovable.app',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });

  res.json(results);
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛒 API running at http://localhost:${PORT}`);
});
