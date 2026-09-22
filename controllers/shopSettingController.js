const ShopSetting = require('../models/ShopSetting');
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary');
const catchAsync = require('../middleware/asyncHandler');

// 1. GET - Fetch active shop settings (Auto-seed defaults if not found)
const getShopSettings = catchAsync(async (req, res) => {
    let settings = await ShopSetting.findOne();

    if (!settings) {
        settings = await ShopSetting.create({
            shopName: 'Balouch Tailors',
            tagline: 'Gents Shalwar Qameez Specialist',
            proprietor: 'Zubair Balouch',
            primaryPhone: '0313-4389192',
            secondaryPhone: '0306-7379919',
            address: 'Hazori Bagh Road, Street 1, Muhallah Muhammadi, Near Peer Muhammad Murad Masjid, Multan',
            logoUrl: ''
        });
    }

    res.status(200).json(settings);
});

// 2. UPDATE - Update shop branding & contact info (Protected)
const updateShopSettings = catchAsync(async (req, res) => {
    const { 
        shopName, 
        tagline, 
        proprietor, 
        primaryPhone, 
        secondaryPhone, 
        address,
        logoUrl: bodyLogoUrl 
    } = req.body;

    let settings = await ShopSetting.findOne();
    if (!settings) {
        settings = new ShopSetting();
    }

    if (req.file) {
        if (settings.logoPublicId) {
            await deleteUploadedImage(settings.logoPublicId);
        }
        const metadata = getImageMetadata(req.file);
        settings.logoUrl = metadata.imageUrl;
        settings.logoPublicId = metadata.imagePublicId;
    } else if (bodyLogoUrl !== undefined) {
        settings.logoUrl = bodyLogoUrl;
    }

    if (shopName !== undefined) settings.shopName = shopName.trim();
    if (tagline !== undefined) settings.tagline = tagline.trim();
    if (proprietor !== undefined) settings.proprietor = proprietor.trim();
    if (primaryPhone !== undefined) settings.primaryPhone = primaryPhone.trim();
    if (secondaryPhone !== undefined) settings.secondaryPhone = secondaryPhone.trim();
    if (address !== undefined) settings.address = address.trim();

    const saved = await settings.save();
    res.status(200).json(saved);
});

module.exports = {
    getShopSettings,
    updateShopSettings
};
