const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

const uploadDir = path.join(__dirname, '..', 'uploads', 'catalogue');
fs.mkdirSync(uploadDir, { recursive: true });

const isCloudinaryConfigured = () => Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured()) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
} else {
    console.warn('Cloudinary credentials not found. Falling back to local file storage for uploads.');
}

const createLocalStorage = () => ({
    _handleFile: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]+/g, '-').toLowerCase();
        const filename = `${Date.now()}-${baseName}.webp`;
        const outputPath = path.join(uploadDir, filename);

        sharp(file.stream)
            .webp({ quality: 85 })
            .toFile(outputPath)
            .then(() => {
                cb(null, {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    encoding: file.encoding,
                    mimetype: 'image/webp',
                    filename,
                    path: outputPath,
                    size: fs.statSync(outputPath).size
                });
            })
            .catch((error) => cb(error));
    },
    _removeFile: (req, file, cb) => {
        if (file.path && fs.existsSync(file.path)) {
            fs.unlink(file.path, cb);
        } else {
            cb(null);
        }
    }
});

const storage = isCloudinaryConfigured()
    ? new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'balouch_tailors/catalogue',
            allowed_formats: ['webp'],
            format: 'webp'
        }
    })
    : createLocalStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
        }
    }
});

const getImageMetadata = (file) => {
    if (!file) {
        return { imageUrl: null, imagePublicId: null };
    }

    if (file.secure_url || file.path?.startsWith('http')) {
        return {
            imageUrl: file.secure_url || file.path,
            imagePublicId: file.public_id || file.filename || null
        };
    }

    return {
        imageUrl: `/uploads/catalogue/${file.filename}`,
        imagePublicId: file.filename || null
    };
};

const deleteUploadedImage = async (imagePublicId) => {
    if (!imagePublicId) return;

    if (isCloudinaryConfigured()) {
        await cloudinary.uploader.destroy(imagePublicId);
        return;
    }

    const localFilePath = path.join(uploadDir, imagePublicId);
    if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
    }
};

module.exports = { cloudinary, upload, getImageMetadata, deleteUploadedImage, isCloudinaryConfigured };
