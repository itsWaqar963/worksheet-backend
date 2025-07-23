require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors({
  origin: [
    'https://worksheet-frontend-e71fnonl8-waqar-ahmeds-projects-b1a3517c.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Optional: Friendly root route
app.get('/', (req, res) => {
  res.send('API is running!');
});

app.use('/api/admin', require('./routes/auth'));
app.use('/api/admin/pdfs', require('./routes/worksheets'));
app.use('/api/admin/admins', require('./routes/admins'));
app.use('/api/worksheets', require('./routes/worksheets'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 