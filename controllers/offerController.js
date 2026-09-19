const Offer = require('../models/Offer');
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary');
const catchAsync = require('../middleware/asyncHandler');

// Default initial offers if collection is empty
const defaultOffers = [
    {
        title: "Bespoke Shalwar Kameez",
        desc: "Experience the ultimate comfort and traditional elegance with our custom-tailored Shalwar Kameez, designed to fit your body and personality perfectly.",
        details: [
            "Premium fabrics including imported Egyptian cotton, wash-and-wear, and luxury blends.",
            "Custom collar styles (Sherwani, Ban, or classic collar).",
            "Hidden or visible plackets with matching or contrasting buttons.",
            "Precision tailoring to flatter your specific body type."
        ],
        imageUrl: "/images/shalwar-kameez.jpg",
        order: 1,
        isActive: true
    },
    {
        title: "Elegant Kurta Collection",
        desc: "From casual daily wear to formal festive events, our expert tailors craft Kurtas that blend modern trends with timeless craftsmanship.",
        details: [
            "Hand-embroidered motifs and delicate thread work for festive occasions.",
            "Breathable, lightweight fabrics for casual, daily elegance.",
            "Modern cuts including straight, A-line, and asymmetrical hems.",
            "Personalized fitting to ensure maximum comfort and style."
        ],
        imageUrl: "/images/kurta.jpg",
        order: 2,
        isActive: true
    },
    {
        title: "Custom Dress Shirts",
        desc: "Look sharp in every meeting. Get perfectly fitted formal and semi-formal dress shirts, customized with your choice of collars, cuffs, and premium fabrics.",
        details: [
            "Vast selection of premium cottons, linens, and wrinkle-free fabrics.",
            "Your choice of collar (Spread, Point, Button-down) and cuffs (French, Barrel).",
            "Monogramming options for that ultimate personalized touch.",
            "Perfected armholes and sleeve lengths to match your exact measurements."
        ],
        imageUrl: "/images/dress-shirt.jpg",
        order: 3,
        isActive: true
    }
];

const parseDetails = (details) => {
    if (!details) return [];
    if (Array.isArray(details)) return details.map(d => String(d).trim()).filter(Boolean);
    if (typeof details === 'string') {
        try {
            const parsed = JSON.parse(details);
            if (Array.isArray(parsed)) return parsed.map(d => String(d).trim()).filter(Boolean);
        } catch {
            return details.split('\n').map(d => d.trim()).filter(Boolean);
        }
    }
    return [];
};

// 1. READ - Get all offers (Auto-seed if empty)
const getOffers = catchAsync(async (req, res) => {
    let offers = await Offer.find().sort({ order: 1, createdAt: 1 });

    if (!offers || offers.length === 0) {
        try {
            offers = await Offer.insertMany(defaultOffers);
        } catch (e) {
            console.warn('Auto-seed default offers fallback:', e.message);
            return res.status(200).json(defaultOffers);
        }
    }

    res.status(200).json(offers);
});

// 2. CREATE - Add new offer
const addOffer = catchAsync(async (req, res) => {
    const { title, desc, details, order, imageUrl: bodyImageUrl } = req.body;

    if (!title || !desc) {
        res.status(400);
        throw new Error('Title and description are required');
    }

    let finalImageUrl = bodyImageUrl || '';
    let finalPublicId = null;

    if (req.file) {
        const metadata = getImageMetadata(req.file);
        finalImageUrl = metadata.imageUrl;
        finalPublicId = metadata.imagePublicId;
    }

    if (!finalImageUrl) {
        res.status(400);
        throw new Error('Service/Offer image is required');
    }

    const newOffer = new Offer({
        title,
        desc,
        details: parseDetails(details),
        imageUrl: finalImageUrl,
        imagePublicId: finalPublicId,
        order: Number(order) || 0,
        isActive: true
    });

    const savedOffer = await newOffer.save();
    res.status(201).json(savedOffer);
});

// 3. UPDATE - Edit offer
const updateOffer = catchAsync(async (req, res) => {
    const { title, desc, details, order, isActive, imageUrl: bodyImageUrl } = req.body;
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
        res.status(404);
        throw new Error('Offer not found');
    }

    if (req.file) {
        if (offer.imagePublicId) {
            await deleteUploadedImage(offer.imagePublicId);
        }
        const metadata = getImageMetadata(req.file);
        offer.imageUrl = metadata.imageUrl;
        offer.imagePublicId = metadata.imagePublicId;
    } else if (bodyImageUrl) {
        offer.imageUrl = bodyImageUrl;
    }

    if (title) offer.title = title;
    if (desc) offer.desc = desc;
    if (details !== undefined) offer.details = parseDetails(details);
    if (order !== undefined) offer.order = Number(order);
    if (isActive !== undefined) offer.isActive = Boolean(isActive);

    const updatedOffer = await offer.save();
    res.status(200).json(updatedOffer);
});

// 4. DELETE - Remove offer
const deleteOffer = catchAsync(async (req, res) => {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
        res.status(404);
        throw new Error('Offer not found');
    }

    if (offer.imagePublicId) {
        await deleteUploadedImage(offer.imagePublicId);
    }

    await offer.deleteOne();
    res.status(200).json({ message: 'Offer deleted successfully' });
});

module.exports = {
    getOffers,
    addOffer,
    updateOffer,
    deleteOffer
};
