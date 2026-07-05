const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${req.user.userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, name);
  }
});

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Image must be JPEG, PNG, WebP, or GIF'));
  }
}).single('file');

const cvUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (CV_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('CV must be a PDF or Word document'));
  }
}).single('file');

// Wrap multer so its errors become clean JSON instead of crashing.
function runUpload(handler) {
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
        return res.status(400).json({ success: false, data: null, error: message });
      }
      next();
    });
  };
}

module.exports = {
  UPLOAD_DIR,
  uploadImage: runUpload(imageUpload),
  uploadCv: runUpload(cvUpload)
};
