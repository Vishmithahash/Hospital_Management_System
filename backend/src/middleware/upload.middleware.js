const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.resolve(process.cwd(), 'backend', 'uploads');

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const timestamp = Date.now();
    const safeOriginal = (file.originalname || 'image').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${timestamp}_${safeOriginal}`);
  }
});

function fileFilter(_req, file, cb) {
  if (!/^image\//.test(file.mimetype)) {
    return cb(new Error('Only image uploads are allowed'));
  }
  cb(null, true);
}

const imageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = {
  imageUpload
};

