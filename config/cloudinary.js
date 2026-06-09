const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

const isCloudinaryConfigured = () => Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary credentials are missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
}

// --- YAHAN CHANGE KAREIN ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim()
});
// ---------------------------
const upload = {
    single: (fieldName) => (req, res, next) => {
        const storage = multer.memoryStorage();
        const uploadInstance = multer({
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
        }).single(fieldName);

        uploadInstance(req, res, async (error) => {
            if (error) {
                return next(error);
            }

            if (!req.file) {
                return next();
            }

            try {
                const webpBuffer = await sharp(req.file.buffer).webp({ quality: 85 }).toBuffer();
                const uploadResult = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'balouch_tailors/catalogue',
                            resource_type: 'image',
                            //overwrite: false
                        },
                        (uploadError, result) => {
                            if (uploadError) {
                                reject(uploadError);
                                return;
                            }
                            resolve(result);
                        }
                    );

                    stream.end(webpBuffer);
                });

                req.file = {
                    fieldname: req.file.fieldname,
                    originalname: req.file.originalname,
                    encoding: req.file.encoding,
                    mimetype: 'image/webp',
                    filename: uploadResult.public_id || `${Date.now()}-${req.file.originalname}.webp`,
                    path: uploadResult.secure_url,
                    size: webpBuffer.length,
                    secure_url: uploadResult.secure_url,
                    public_id: uploadResult.public_id
                };

                next();
            } catch (uploadError) {
                next(uploadError);
            }
        });
    }
};

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
        imageUrl: file.path,
        imagePublicId: file.filename || null
    };
};

const deleteUploadedImage = async (imagePublicId) => {
    if (!imagePublicId) return;

    try {
        await cloudinary.uploader.destroy(imagePublicId);
    } catch (error) {
        console.warn('Cloudinary delete failed:', error.message);
    }
};

module.exports = { cloudinary, upload, getImageMetadata, deleteUploadedImage, isCloudinaryConfigured };
