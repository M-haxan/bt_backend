const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
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
    console.warn('Cloudinary credentials not found. Uploads will be stored locally as WebP.');
}

const createStorage = () => ({
    _handleFile: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]+/g, '-').toLowerCase();
        const filename = `${Date.now()}-${baseName}.webp`;
        const outputPath = path.join(uploadDir, filename);

        sharp(file.stream)
            .webp({ quality: 85 })
            .toFile(outputPath)
            .then(async () => {
                const localFile = {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    encoding: file.encoding,
                    mimetype: 'image/webp',
                    filename,
                    path: outputPath,
                    size: fs.statSync(outputPath).size
                };

                if (isCloudinaryConfigured()) {
                    try {
                        const result = await cloudinary.uploader.upload(outputPath, {
                            folder: 'balouch_tailors/catalogue',
                            resource_type: 'image',
                            overwrite: false
                        });

                        localFile.secure_url = result.secure_url;
                        localFile.public_id = result.public_id;
                        localFile.path = result.secure_url;
                        cb(null, localFile);
                        return;
                    } catch (uploadError) {
                        console.warn('Cloudinary upload failed, falling back to local storage:', uploadError.message);
                    }
                }

                cb(null, localFile);
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

const upload = multer({
    storage: createStorage(),
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
        try {
            await cloudinary.uploader.destroy(imagePublicId);
        } catch (error) {
            console.warn('Cloudinary delete failed:', error.message);
        }
        return;
    }

    const localFilePath = path.join(uploadDir, imagePublicId);
    if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
    }
};

module.exports = { cloudinary, upload, getImageMetadata, deleteUploadedImage, isCloudinaryConfigured };
