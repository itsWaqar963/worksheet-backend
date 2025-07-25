const mongoose = require('mongoose');

const WorksheetSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  subject: { type: String, required: true, default: "Other" },
  tags: [String],
  grade: String,
  ageGroup: String,
  fileUrl: String,
  originalName: String, // store the original filename
  uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Worksheet', WorksheetSchema); 