const express = require('express');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');

const router  = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/', upload.fields([
  { name: 'photos', maxCount: 10 },
  { name: 'logo',   maxCount: 1  },
]), (req, res) => {
  const photos = (req.files['photos'] || []).map(f => ({ id: f.filename, url: `/uploads/${f.filename}` }));
  const logo   = req.files['logo']?.[0];

  res.json({
    photos,
    logo: logo ? { id: logo.filename, url: `/uploads/${logo.filename}` } : null,
  });
});

module.exports = router;
