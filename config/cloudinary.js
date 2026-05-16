const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// Cloudinary ko apne credentials dena
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage engine set karna (Kahan aur kis folder mein save hoga)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'balouch_tailors/catalogue', // Cloudinary mein is naam ka folder ban jayega
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
    }
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
