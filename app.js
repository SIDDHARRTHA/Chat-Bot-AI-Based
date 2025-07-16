const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
require('dotenv').config();

const app = express();

// MongoDB Atlas connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});



// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Sessions
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/chat', require('./routes/chat'));

// // Dashboard (protected)
// app.get('/dashboard', (req, res) => {
//   if (!req.session.userId) return res.redirect('/auth/login');
//   res.send(`<%- include("partials/navbar") %><h1>Welcome to your dashboard</h1>`);
// });

// Home redirect
app.get('/', (req, res) => res.redirect('/auth/login'));

// Start server
app.listen(3000, () => console.log("Server running at http://localhost:3000"));
