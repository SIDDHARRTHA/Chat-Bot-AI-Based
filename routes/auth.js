const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');

router.get('/login', (req, res) => res.render('auth/login'));
router.get('/register', (req, res) => res.render('auth/register'));

/* ✅ Register */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Email already used
      return res.redirect('/auth/login');
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed });

    await user.save();
    req.session.userId = user._id;
    res.redirect('/chat/dashboard');
  } catch (err) {
    console.error('Registration error:', err);
    res.redirect('/auth/register');
  }
});

/* ✅ Login */
router.post('/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    // 🔁 User not found → redirect to register
    return res.redirect('/auth/register');
  }

  const isMatch = await bcrypt.compare(req.body.password, user.password);
  if (!isMatch) {
    return res.redirect('/auth/login');
  }

  req.session.userId = user._id;
  res.redirect('/chat/dashboard');
});

/* ✅ Logout */
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
