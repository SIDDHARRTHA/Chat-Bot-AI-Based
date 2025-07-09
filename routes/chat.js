const express = require('express');
const axios = require('axios');
const Session = require('../models/Session');
const router = express.Router();

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Get chat history
router.get('/history', isAuthenticated, async (req, res) => {
  const session = await Session.findOne({ userId: req.session.userId });
  res.json(session ? session.messages : []);
});

// Send message to Gemini API
router.post('/message', isAuthenticated, async (req, res) => {
  const { text } = req.body;
  try {
    // Save user message
    let session = await Session.findOne({ userId: req.session.userId });
    if (!session) session = new Session({ userId: req.session.userId, messages: [] });
    session.messages.push({ sender: 'user', text });

    // Try Gemini 2.0 Flash generative model for chat response
    let aiText = null;
    try {
      const geminiRes = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          contents: [
            {
              parts: [ { text } ]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': process.env.GEMINI_API_KEY.replace(/"/g, '')
          }
        }
      );
      aiText = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
      session.messages.push({ sender: 'ai', text: aiText });
      await session.save();
      return res.json({ text: aiText });
    } catch (apiErr) {
      // Log and fall back to embedding if generative fails
      console.error('Gemini generative API error:', apiErr.response?.data || apiErr.message || apiErr);
    }

    // Fallback: Call Gemini Embedding API (embedding-gecko-001)
    try {
      const embeddingRes = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/embedding-gecko-001:embedText',
        { text },
        { params: { key: process.env.GEMINI_API_KEY.replace(/"/g, '') } }
      );
      const embedding = embeddingRes.data.embedding || [];
      session.messages.push({ sender: 'ai', text: 'Embedding vector generated.', embedding });
      await session.save();
      res.json({ embedding });
    } catch (err2) {
      console.error('Gemini Embedding API error:', err2.response?.data || err2.message || err2);
      res.status(500).json({ error: 'AI error', details: err2.response?.data || err2.message || err2 });
    }
  } catch (err) {
    console.error('Gemini API error:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'AI error', details: err.response?.data || err.message || err });
  }
});

module.exports = router;
