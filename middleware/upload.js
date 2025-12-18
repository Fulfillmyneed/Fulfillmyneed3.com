const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || './public/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  }
});

// Middleware to process and optimize images
const processImage = async (req, res, next) => {
  if (!req.files && !req.file) {
    return next();
  }

  try {
    const files = req.files || [req.file];
    const processedFiles = [];

    for (const file of files) {
      const filePath = path.join(uploadDir, file.filename);
      
      // Optimize image
      await sharp(filePath)
        .resize(1200, 1200, { // Max dimensions
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80, progressive: true })
        .png({ quality: 80, progressive: true })
        .webp({ quality: 80 })
        .toFile(filePath + '.optimized')
        .catch(err => {
          console.error('Error optimizing image:', err);
          // If optimization fails, use original
        });

      // Replace original with optimized if successful
      if (fs.existsSync(filePath + '.optimized')) {
        fs.unlinkSync(filePath);
        fs.renameSync(filePath + '.optimized', filePath);
      }

      // Generate thumbnail
      const thumbnailPath = path.join(uploadDir, 'thumb_' + file.filename);
      await sharp(filePath)
        .resize(300, 300, {
          fit: 'cover',
          position: 'center'
        })
        .toFile(thumbnailPath);

      processedFiles.push({
        original: `/uploads/${file.filename}`,
        thumbnail: `/uploads/thumb_${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      });
    }

    req.processedFiles = processedFiles;
    next();
  } catch (error) {
    console.error('Error processing images:', error);
    next(error);
  }
};

// Delete file middleware
const deleteFile = (filePath) => {
  const fullPath = path.join(uploadDir, path.basename(filePath));
  const thumbPath = path.join(uploadDir, 'thumb_' + path.basename(filePath));

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  if (fs.existsSync(thumbPath)) {
    fs.unlinkSync(thumbPath);
  }
};

module.exports = {
  upload,
  processImage,
  deleteFile,
  uploadDir
};