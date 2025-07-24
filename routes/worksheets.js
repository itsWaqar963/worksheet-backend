const express = require('express');
const multer = require('multer');
const Worksheet = require('../models/Worksheet');
const auth = require('../middleware/auth');
const supabase = require('../supabaseClient');
const { PDFDocument } = require('pdf-lib');
const { createCanvas, Image } = require('canvas');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

async function generateThumbnail(pdfBuffer) {
  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();

  // Render the first page to a PNG using canvas
  // pdf-lib does not support rendering, so we use a placeholder image for now
  // For production, use a service like pdf-poppler, or a headless browser, or a cloud function
  // Here, we'll just return a blank PNG as a placeholder
  const canvas = createCanvas(120, 160);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e0e6f7';
  ctx.fillRect(0, 0, 120, 160);
  ctx.fillStyle = '#7b6ef6';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('PDF', 40, 80);

  return canvas.toBuffer('image/png');
}

router.post('/upload', auth, upload.single('file'), async (req, res) => {
  const { title, description, category, tags, grade } = req.body;
  try {
    const file = req.file;
    const fileName = `${Date.now()}-${file.originalname}`;
    // 1. Upload PDF to Supabase
    const { data: pdfData, error: pdfError } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });
    if (pdfError) {
      return res.status(500).json({ message: 'Failed to upload PDF to Supabase', error: pdfError });
    }
    // 2. Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(file.buffer);
    const thumbName = `${Date.now()}-thumb-${file.originalname.replace(/\.[^/.]+$/, '')}.png`;
    // 3. Upload thumbnail to Supabase
    const { data: thumbData, error: thumbError } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(thumbName, thumbnailBuffer, {
        contentType: 'image/png',
        upsert: false
      });
    if (thumbError) {
      return res.status(500).json({ message: 'Failed to upload thumbnail to Supabase', error: thumbError });
    }
    // 4. Get public URLs
    const { data: pdfUrlData } = supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(fileName);
    const { data: thumbUrlData } = supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(thumbName);

    // 5. Save worksheet with both URLs
    const worksheet = new Worksheet({
      title,
      description,
      category,
      tags: tags.split(','),
      grade,
      fileUrl: pdfUrlData.publicUrl,
      thumbnailUrl: thumbUrlData.publicUrl,
      originalName: file.originalname
    });
    await worksheet.save();
    res.json({ success: true, worksheet });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

// Get all worksheets (public)
router.get('/', async (req, res) => {
  const { subject, grade, category } = req.query;
  let filter = {};
  if (subject && subject !== 'All') filter.category = subject;
  if (grade && grade !== 'All') filter.grade = grade;
  if (category && category !== 'All') filter.category = category;
  const worksheets = await Worksheet.find(filter).sort({ uploadDate: -1 });
  res.json(worksheets);
});

// Get worksheet by ID (public)
router.get('/:id', async (req, res) => {
  const worksheet = await Worksheet.findById(req.params.id);
  if (!worksheet) return res.status(404).json({ message: 'Not found' });
  res.json(worksheet);
});

// Edit worksheet (protected)
router.put('/:id', auth, async (req, res) => {
  const { title, description, category, tags, grade } = req.body;
  const worksheet = await Worksheet.findByIdAndUpdate(
    req.params.id,
    { title, description, category, tags: tags.split(','), grade },
    { new: true }
  );
  res.json({ success: true, worksheet });
});

// Delete worksheet (protected)
router.delete('/:id', auth, async (req, res) => {
  await Worksheet.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Popular worksheets (public)
router.get('/popular', async (req, res) => {
  const worksheets = await Worksheet.find().sort({ uploadDate: -1 }).limit(3);
  res.json(worksheets);
});

// Recent worksheets (public)
router.get('/recent', async (req, res) => {
  const worksheets = await Worksheet.find().sort({ uploadDate: -1 }).limit(3);
  res.json(worksheets);
});

router.get('/download/:id', async (req, res) => {
  try {
    const worksheet = await Worksheet.findById(req.params.id);
    if (!worksheet || !worksheet.fileUrl) {
      return res.status(404).send('File not found');
    }
    const filePath = path.join(__dirname, '..', worksheet.fileUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    res.download(filePath, worksheet.originalName || path.basename(filePath));
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router; 