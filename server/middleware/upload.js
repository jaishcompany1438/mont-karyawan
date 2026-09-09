const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common office, pdf, archive, and image files
  const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|csv|zip|rar|txt/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowedExtensions.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipe berkas tidak didukung: .${ext}`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max limit
  fileFilter
});

module.exports = upload;
