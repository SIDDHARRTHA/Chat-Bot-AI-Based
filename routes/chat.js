const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/auth/login');
  next();
}

// Gemini API setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/* ------------------ Dashboard ------------------ */
router.get('/dashboard', requireLogin, async (req, res) => {
  const chats = await Chat.find({ userId: req.session.userId }).sort({ createdAt: -1 });
  res.render('chat/dashboard', { chats });
});

/* ------------------ New Chat ------------------ */
router.post('/new', requireLogin, async (req, res) => {
  const chat = new Chat({ userId: req.session.userId });
  await chat.save();
  res.redirect(`/chat/${chat._id}`);
});

/* ------------------ View Chat ------------------ */
router.get('/:id', requireLogin, async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, userId: req.session.userId }).populate('messages');
  if (!chat) return res.redirect('/dashboard');
  res.render('chat/chat', { chat });
});

/* ------------------ Send Message & Get AI Reply ------------------ */
router.post('/:id/message', requireLogin, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!chat) return res.redirect('/dashboard');

    const userText = req.body.text;

    // Save user message
    const userMsg = await Message.create({
      chatId: chat._id,
      sender: 'user',
      text: userText
    });
    chat.messages.push(userMsg);

    // Generate context from chat history
    const history = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });
    const prompt = history.map(m => `${m.sender === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');

    // Gemini generateContent call
    const result = await model.generateContent(`${prompt}\nUser: ${userText}`);
    const aiReply = result.response.text();

    // Save AI message
    const aiMsg = await Message.create({
      chatId: chat._id,
      sender: 'ai',
      text: aiReply
    });
    chat.messages.push(aiMsg);
    await chat.save();

    res.redirect(`/chat/${chat._id}`);
  } catch (err) {
    console.error('Gemini Error:', err.message);
    res.redirect('/dashboard');
  }
});

/* ------------------ Rename Chat ------------------ */
router.post('/:id/rename', requireLogin, async (req, res) => {
  await Chat.updateOne(
    { _id: req.params.id, userId: req.session.userId },
    { title: req.body.title }
  );
  res.redirect(`/chat/${req.params.id}`);
});

/* ------------------ Delete Chat ------------------ */
router.post('/:id/delete', requireLogin, async (req, res) => {
  await Chat.deleteOne({ _id: req.params.id, userId: req.session.userId });
  await Message.deleteMany({ chatId: req.params.id });
  res.redirect('/chat/dashboard');

});

/* ------------------ Export Chat ------------------ */
router.get('/:id/export', requireLogin, async (req, res) => {
  const messages = await Message.find({ chatId: req.params.id }).sort({ createdAt: 1 });
  const exportText = messages.map(m => `[${m.sender.toUpperCase()}]: ${m.text}`).join('\n');

  res.setHeader('Content-Disposition', 'attachment; filename=chat.txt');
  res.setHeader('Content-Type', 'text/plain');
  res.send(exportText);
});

/* ------------------ Search Chats ------------------ */
router.get('/search', requireLogin, async (req, res) => {
  const q = req.query.q;
  const chats = await Chat.find({
    userId: req.session.userId,
    title: { $regex: q, $options: 'i' }
  });
  res.render('chat/dashboard', { chats });
});

module.exports = router;
