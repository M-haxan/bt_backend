const Worker = require('../models/Worker');
const Order = require('../models/Order');
const catchAsync = require('../middleware/asyncHandler');
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary');

// 1. CREATE WORKER
const createWorker = catchAsync(async (req, res) => {
    const { name, phone, password, perSuitWage, advanceAmount, address, specialization } = req.body;

    if (!name || !phone || !password || perSuitWage === undefined) {
        res.status(400);
        throw new Error('Name, phone, password, and per-suit wage are required');
    }

    const workerExists = await Worker.findOne({ phone });
    if (workerExists) {
        res.status(400);
        throw new Error('A worker with this phone number already exists');
    }

    let profileImage = { url: '', public_id: '' };
    if (req.file) {
        const { imageUrl, imagePublicId } = getImageMetadata(req.file);
        profileImage = { url: imageUrl, public_id: imagePublicId };
    }

    const worker = await Worker.create({
        name,
        phone: Number(phone),
        password,
        profileImage,
        perSuitWage: Number(perSuitWage),
        advanceAmount: Number(advanceAmount) || 0,
        address,
        specialization
    });

    res.status(201).json({
        _id: worker._id,
        name: worker.name,
        phone: worker.phone,
        profileImage: worker.profileImage,
        perSuitWage: worker.perSuitWage,
        advanceAmount: worker.advanceAmount,
        address: worker.address,
        specialization: worker.specialization
    });
});

// 2. GET ALL WORKERS
const getWorkers = catchAsync(async (req, res) => {
    const workers = await Worker.find({}).sort({ createdAt: -1 });
    res.status(200).json(workers);
});

// 3. GET WORKER BY ID
const getWorkerById = catchAsync(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
        res.status(404);
        throw new Error('Worker not found');
    }
    res.status(200).json(worker);
});

// 4. UPDATE WORKER
const updateWorker = catchAsync(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
        res.status(404);
        throw new Error('Worker not found');
    }

    const { name, phone, password, perSuitWage, advanceAmount, address, specialization, isActive } = req.body;

    worker.name = name || worker.name;
    worker.phone = phone ? Number(phone) : worker.phone;
    worker.perSuitWage = perSuitWage !== undefined ? Number(perSuitWage) : worker.perSuitWage;
    worker.advanceAmount = advanceAmount !== undefined ? Number(advanceAmount) : worker.advanceAmount;
    worker.address = address !== undefined ? address : worker.address;
    worker.specialization = specialization !== undefined ? specialization : worker.specialization;
    worker.isActive = isActive !== undefined ? isActive : worker.isActive;

    if (password) {
        worker.password = password; // pre-save hook will hash it
    }

    if (req.file) {
        // Delete old image from Cloudinary
        if (worker.profileImage && worker.profileImage.public_id) {
            await deleteUploadedImage(worker.profileImage.public_id);
        }
        const { imageUrl, imagePublicId } = getImageMetadata(req.file);
        worker.profileImage = { url: imageUrl, public_id: imagePublicId };
    }

    const updatedWorker = await worker.save();
    res.status(200).json(updatedWorker);
});

// 5. DELETE WORKER
const deleteWorker = catchAsync(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
        res.status(404);
        throw new Error('Worker not found');
    }

    if (worker.profileImage && worker.profileImage.public_id) {
        await deleteUploadedImage(worker.profileImage.public_id);
    }

    await worker.deleteOne();
    res.status(200).json({ message: 'Worker deleted successfully' });
});

// 6. GET WORKER DASHBOARD DATA
const getWorkerDashboard = catchAsync(async (req, res) => {
    const workerId = req.user._id;
    const worker = await Worker.findById(workerId);
    
    if (!worker) {
        res.status(404);
        throw new Error('Worker profile not found');
    }

    // Find all orders that have suits assigned to this worker
    const orders = await Order.find({ 'suits.assignedWorker': workerId })
        .populate('customer')
        .populate('suits.wearer')
        .sort({ bookingDate: -1 });

    const assignedSuits = [];
    const stitchedSuits = [];

    orders.forEach(order => {
        order.suits.forEach(suit => {
            if (suit.assignedWorker && suit.assignedWorker.toString() === workerId.toString()) {
                const suitData = {
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    bookingDate: order.bookingDate,
                    deliveryDate: order.deliveryDate,
                    customerName: order.customer?.name || 'Unknown',
                    customerPhone: order.customer?.phone || '',
                    suitId: suit._id,
                    fabricDetails: suit.fabricDetails,
                    volumeNo: suit.volumeNo,
                    staticTags: suit.staticTags || [],
                    customDesign: suit.customDesign || '',
                    fabricImage: suit.fabricImage,
                    wearerName: suit.wearer?.name || order.customer?.name || 'Unknown',
                    price: suit.price,
                    stitchingStatus: suit.stitchingStatus
                };

                if (suit.stitchingStatus === 'Stitched') {
                    stitchedSuits.push(suitData);
                } else {
                    assignedSuits.push(suitData);
                }
            }
        });
    });

    const totalStitched = stitchedSuits.length;
    const totalEarnings = totalStitched * worker.perSuitWage;
    const balanceDue = totalEarnings - worker.advanceAmount;

    res.status(200).json({
        worker: {
            name: worker.name,
            phone: worker.phone,
            profileImage: worker.profileImage,
            perSuitWage: worker.perSuitWage,
            advanceAmount: worker.advanceAmount,
            address: worker.address,
            specialization: worker.specialization
        },
        stats: {
            totalStitched,
            totalEarnings,
            advanceTaken: worker.advanceAmount,
            balanceDue
        },
        assignedSuits,
        stitchedSuits
    });
});

// 7. MARK SUIT AS STITCHED
const markSuitAsStitched = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;
    const workerId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    const suit = order.suits.id(suitId);
    if (!suit) {
        res.status(404);
        throw new Error('Suit not found inside the order');
    }

    if (!suit.assignedWorker || suit.assignedWorker.toString() !== workerId.toString()) {
        res.status(403);
        throw new Error('You are not assigned to stitch this suit');
    }

    suit.stitchingStatus = 'Stitched';
    await order.save();

    res.status(200).json({ message: 'Suit marked as stitched successfully', suitId });
});

// 8. ADMIN ASSIGN WORKER TO SUIT
const adminAssignWorker = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;
    const { workerId } = req.body; // Pass empty string to unassign

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    const suit = order.suits.id(suitId);
    if (!suit) {
        res.status(404);
        throw new Error('Suit not found');
    }

    if (!workerId) {
        // Unassign worker
        suit.assignedWorker = undefined;
        suit.stitchingStatus = 'Pending';
    } else {
        const worker = await Worker.findById(workerId);
        if (!worker) {
            res.status(404);
            throw new Error('Worker not found');
        }
        suit.assignedWorker = workerId;
        suit.stitchingStatus = 'Assigned';
    }

    await order.save();
    
    // Return populated order to update frontend state
    const updatedOrder = await Order.findById(orderId)
        .populate('customer')
        .populate('suits.wearer')
        .populate('alterations.wearer');

    res.status(200).json(updatedOrder);
});

module.exports = {
    createWorker,
    getWorkers,
    getWorkerById,
    updateWorker,
    deleteWorker,
    getWorkerDashboard,
    markSuitAsStitched,
    adminAssignWorker
};
