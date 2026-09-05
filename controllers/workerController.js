const Worker = require('../models/Worker');
const Order = require('../models/Order');
const WorkerLedger = require('../models/WorkerLedger');
const WorkerPayment = require('../models/WorkerPayment');
const Expense = require('../models/Expense');
const Supplier = require('../models/Supplier');
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

    if (worker.advanceAmount > 0) {
        await WorkerLedger.create({
            worker: worker._id,
            type: 'advance',
            amount: worker.advanceAmount,
            description: 'Initial Advance Balance',
            status: 'Pending',
            date: new Date()
        });
    }

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

    // Find all orders that have suits assigned to this worker (in main field or stage fields)
    const orders = await Order.find({
        $or: [
            { 'suits.assignedWorker': workerId },
            { 'suits.stitching.assignedWorker': workerId },
            { 'suits.cutting.assignedWorker': workerId },
            { 'suits.finishing.assignedWorker': workerId }
        ]
    })
        .populate('customer')
        .populate('suits.wearer')
        .sort({ bookingDate: -1 });

    const assignedSuits = [];
    const underInspectionSuits = [];
    const reworkSuits = [];
    const stitchedSuits = [];

    orders.forEach(order => {
        order.suits.forEach(suit => {
            const isAssigned = (suit.assignedWorker && suit.assignedWorker.toString() === workerId.toString()) ||
                               (suit.stitching?.assignedWorker && suit.stitching.assignedWorker.toString() === workerId.toString());
            
            if (isAssigned) {
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
                    stitchingStatus: suit.stitchingStatus,
                    reworkNotes: suit.stitching?.reworkNotes || '',
                    cutting: suit.cutting,
                    stitching: suit.stitching,
                    finishing: suit.finishing
                };

                if (suit.stitchingStatus === 'Stitched') {
                    stitchedSuits.push(suitData);
                } else if (suit.stitchingStatus === 'Submitted for Inspection') {
                    underInspectionSuits.push(suitData);
                } else if (suit.stitchingStatus === 'Rework Required') {
                    reworkSuits.push(suitData);
                } else {
                    assignedSuits.push(suitData);
                }
            }
        });
    });

    // Fetch all pending ledger entries for this worker
    const pendingEntries = await WorkerLedger.find({ worker: workerId, status: 'Pending' });
    let totalStitched = 0;
    let totalEarnings = 0;
    let advanceTaken = 0;

    pendingEntries.forEach(entry => {
        if (entry.type === 'suit') {
            totalStitched++;
            totalEarnings += entry.amount;
        } else if (entry.type === 'advance') {
            advanceTaken += entry.amount;
        }
    });

    const balanceDue = totalEarnings - advanceTaken;

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
            advanceTaken,
            balanceDue
        },
        assignedSuits,
        underInspectionSuits,
        reworkSuits,
        stitchedSuits
    });
});

// 7. WORKER SUBMITS SUIT FOR INSPECTION (NO LEDGER CREDIT YET)
const submitSuitForInspection = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;

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

    const workerId = req.user._id;
    const isAdmin = req.user.role === 'admin' || req.user.role !== 'worker';

    if (!isAdmin) {
        const isAssigned = (suit.assignedWorker && suit.assignedWorker.toString() === workerId.toString()) ||
                           (suit.stitching?.assignedWorker && suit.stitching.assignedWorker.toString() === workerId.toString());
        if (!isAssigned) {
            res.status(403);
            throw new Error('You are not assigned to stitch this suit');
        }
    }

    if (suit.stitchingStatus === 'Stitched') {
        res.status(400);
        throw new Error('Suit is already approved and stitched');
    }

    suit.stitchingStatus = 'Submitted for Inspection';
    if (!suit.stitching) suit.stitching = {};
    suit.stitching.status = 'Submitted for Inspection';
    
    // Cutting should also be marked completed if not already
    if (suit.cutting && suit.cutting.status !== 'Completed') {
        suit.cutting.status = 'Completed';
    }

    await order.save();

    res.status(200).json({ 
        message: 'Suit submitted for admin inspection successfully. Wage will be credited once approved by Admin.',
        suitId,
        stitchingStatus: suit.stitchingStatus
    });
});

// 7.1 ADMIN APPROVE SUIT (QUALITY CHECK PASSED -> RELEASE WAGE & UPDATE STATUS)
const adminApproveSuit = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;

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

    if (suit.stitchingStatus === 'Stitched') {
        res.status(400);
        throw new Error('Suit is already approved');
    }

    suit.stitchingStatus = 'Stitched';
    if (!suit.stitching) suit.stitching = {};
    suit.stitching.status = 'Approved';
    suit.stitching.reworkNotes = '';
    suit.stitching.approvedAt = new Date();

    if (suit.cutting && suit.cutting.status !== 'Completed') {
        suit.cutting.status = 'Completed';
    }
    if (suit.finishing && suit.finishing.status !== 'Completed') {
        suit.finishing.status = 'Completed';
    }

    // Determine worker to credit
    const workerId = suit.stitching?.assignedWorker || suit.assignedWorker;
    const isSelf = suit.stitching?.isSelf || (!workerId);

    // If assigned to an external worker and not already credited
    if (!isSelf && workerId) {
        const existingEntry = await WorkerLedger.findOne({
            orderId: order._id,
            suitId: suit._id.toString(),
            type: 'suit'
        });

        if (!existingEntry) {
            const worker = await Worker.findById(workerId);
            const wageAmount = suit.stitching?.wage || (worker ? worker.perSuitWage : 0);

            if (worker && wageAmount > 0) {
                await WorkerLedger.create({
                    worker: workerId,
                    type: 'suit',
                    amount: wageAmount,
                    description: `QC Approved Suit: ${suit.fabricDetails} (Order #BT-${order.orderNumber})`,
                    orderId: order._id,
                    suitId: suit._id.toString(),
                    status: 'Pending'
                });
            }
        }
    }

    // Check if all suits in the order are stitched
    const allStitched = order.suits.every(s => s.stitchingStatus === 'Stitched');
    if (allStitched && order.orderStatus === 'Pending') {
        order.orderStatus = 'In Progress';
    }

    await order.save();

    const updatedOrder = await Order.findById(orderId)
        .populate('customer')
        .populate('suits.wearer')
        .populate('alterations.wearer');

    res.status(200).json({ 
        message: 'Suit approved successfully! Wage credited to worker ledger.', 
        order: updatedOrder,
        suitId 
    });
});

// 7.2 ADMIN REJECT / REQUEST REWORK ON SUIT
const adminRejectSuit = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;
    const { reworkNotes } = req.body;

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

    suit.stitchingStatus = 'Rework Required';
    if (!suit.stitching) suit.stitching = {};
    suit.stitching.status = 'Rework Required';
    suit.stitching.reworkNotes = reworkNotes || 'Defect found during QC inspection. Please review and rectify.';

    // If an existing ledger entry was mistakenly created, remove it
    await WorkerLedger.deleteMany({
        orderId: order._id,
        suitId: suit._id.toString(),
        type: 'suit',
        status: 'Pending'
    });

    await order.save();

    const updatedOrder = await Order.findById(orderId)
        .populate('customer')
        .populate('suits.wearer')
        .populate('alterations.wearer');

    res.status(200).json({
        message: 'Suit sent back for rework/alteration. Worker notified.',
        order: updatedOrder,
        suitId
    });
});

// 7.3 DIRECT MARK SUIT AS STITCHED (Backward Compatible for Admin)
const markSuitAsStitched = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;

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

    let workerId = req.user._id;
    const isAdmin = req.user.role === 'admin' || req.user.role !== 'worker';

    if (isAdmin) {
        // Admin direct mark uses approval flow
        return adminApproveSuit(req, res);
    } else {
        // Worker must submit for inspection
        return submitSuitForInspection(req, res);
    }
});

// 8. ADMIN ASSIGN STAGE (CUTTING, STITCHING, FINISHING OR OWNER/SELF)
const adminAssignStage = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;
    const { stage, isSelf, workerId, wage, status } = req.body;

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

    const targetStage = stage || 'stitching';

    if (!suit[targetStage]) {
        suit[targetStage] = {};
    }

    if (isSelf) {
        suit[targetStage].isSelf = true;
        suit[targetStage].assignedWorker = null;
        if (targetStage === 'stitching') {
            suit.assignedWorker = undefined;
        }
    } else if (workerId) {
        const worker = await Worker.findById(workerId);
        if (!worker) {
            res.status(404);
            throw new Error('Worker not found');
        }
        suit[targetStage].isSelf = false;
        suit[targetStage].assignedWorker = workerId;
        suit[targetStage].wage = wage !== undefined ? Number(wage) : worker.perSuitWage;
        if (targetStage === 'stitching') {
            suit.assignedWorker = workerId;
            if (suit.stitchingStatus === 'Pending') {
                suit.stitchingStatus = 'Assigned';
            }
        }
    } else {
        // Unassigned
        suit[targetStage].isSelf = false;
        suit[targetStage].assignedWorker = null;
        if (targetStage === 'stitching') {
            suit.assignedWorker = undefined;
            suit.stitchingStatus = 'Pending';
        }
    }

    if (status) {
        suit[targetStage].status = status;
        if (targetStage === 'stitching') {
            suit.stitchingStatus = status === 'Completed' ? 'Stitched' : status;
        }
    }

    await order.save();

    const updatedOrder = await Order.findById(orderId)
        .populate('customer')
        .populate('suits.wearer')
        .populate('alterations.wearer');

    res.status(200).json(updatedOrder);
});

// 8.1 ADMIN ASSIGN WORKER TO SUIT (LEGACY COMPATIBILITY)
const adminAssignWorker = catchAsync(async (req, res) => {
    const { orderId, suitId } = req.params;
    const { workerId, isSelf } = req.body;

    req.body.stage = 'stitching';
    req.body.isSelf = isSelf || (workerId === 'self');
    req.body.workerId = (workerId === 'self' || !workerId) ? null : workerId;

    return adminAssignStage(req, res);
});

// 8.2 SHOP FINANCIAL SUMMARY (OWNER PROFIT VS WORKER EXPENSES VS OWNER LABOR)
const getFinancialSummary = catchAsync(async (req, res) => {
    // 1. All Orders Financials
    const orders = await Order.find({});
    
    let totalRevenue = 0;
    let totalAdvanceReceived = 0;
    let totalBalanceReceivable = 0;
    let totalSuitsCount = 0;
    
    let ownerStitchedCount = 0;
    let ownerCuttingCount = 0;
    let workerStitchedCount = 0;
    let pendingInspectionCount = 0;
    let reworkCount = 0;

    orders.forEach(order => {
        totalRevenue += (order.totalAmount || 0);
        totalAdvanceReceived += (order.advancePaid || 0);
        totalBalanceReceivable += (order.balanceAmount || 0);

        if (order.suits && order.suits.length > 0) {
            order.suits.forEach(suit => {
                totalSuitsCount++;

                // Stitching analysis
                if (suit.stitching?.isSelf || (!suit.assignedWorker && !suit.stitching?.assignedWorker)) {
                    if (suit.stitchingStatus === 'Stitched') {
                        ownerStitchedCount++;
                    }
                } else {
                    if (suit.stitchingStatus === 'Stitched') {
                        workerStitchedCount++;
                    }
                }

                // Cutting analysis
                if (suit.cutting?.isSelf) {
                    if (suit.cutting?.status === 'Completed' || suit.stitchingStatus === 'Stitched') {
                        ownerCuttingCount++;
                    }
                }

                if (suit.stitchingStatus === 'Submitted for Inspection') {
                    pendingInspectionCount++;
                } else if (suit.stitchingStatus === 'Rework Required') {
                    reworkCount++;
                }
            });
        }
    });

    // 2. Worker Ledgers Financials (Expenses)
    const suitLedgers = await WorkerLedger.find({ type: 'suit' });
    const advanceLedgers = await WorkerLedger.find({ type: 'advance' });

    let totalWorkerWagesIncurred = 0;
    let totalWorkerWagesPaid = 0;
    let totalWorkerWagesPending = 0;

    suitLedgers.forEach(entry => {
        totalWorkerWagesIncurred += entry.amount;
        if (entry.status === 'Paid') {
            totalWorkerWagesPaid += entry.amount;
        } else {
            totalWorkerWagesPending += entry.amount;
        }
    });

    let totalAdvancesGiven = 0;
    advanceLedgers.forEach(entry => {
        totalAdvancesGiven += entry.amount;
    });

    // 3. Direct Shop Expenses & Material Expenses
    const allExpenses = await Expense.find({});
    let totalShopExpenses = 0;
    allExpenses.forEach(exp => {
        totalShopExpenses += (exp.amount || 0);
    });

    // 4. Supplier Material Outstanding Debt (Abhi deny hain Material walon ko)
    const allSuppliers = await Supplier.find({});
    let totalSupplierPayable = 0;
    let totalSupplierPurchases = 0;
    let totalSupplierPaid = 0;

    allSuppliers.forEach(sup => {
        totalSupplierPayable += (sup.balancePayable || 0);
        totalSupplierPurchases += (sup.totalPurchases || 0);
        totalSupplierPaid += (sup.totalPaid || 0);
    });

    // Total Kharcha = Worker Wages + Shop Expenses (Rent, Bills, Materials, etc.)
    const totalKharcha = totalWorkerWagesIncurred + totalShopExpenses;

    // Net Business Profit = Total Kaam (Sales) - Total Kharcha
    const netShopBusinessProfit = totalRevenue - totalKharcha;

    // Standard baseline rate for owner labor estimation (e.g. standard stitch wage 600, cutting 200)
    const estimatedOwnerStitchValue = ownerStitchedCount * 600;
    const estimatedOwnerCutValue = ownerCuttingCount * 200;
    const totalOwnerLaborEarnings = estimatedOwnerStitchValue + estimatedOwnerCutValue;

    res.status(200).json({
        totalRevenue, // Total Kaam (Sales)
        totalAdvanceReceived, // Total Receiving (Advance collected)
        totalBalanceReceivable, // Abhi Lenay Hain (Customer Udhar)
        totalSuitsCount,
        totalKharcha, // Total Kharcha (Worker wages + Shop Expenses)
        totalShopExpenses, // Shop General + Material Expenses
        counts: {
            ownerStitchedCount,
            ownerCuttingCount,
            workerStitchedCount,
            pendingInspectionCount,
            reworkCount
        },
        workerExpenses: {
            totalWorkerWagesIncurred,
            totalWorkerWagesPaid,
            totalWorkerWagesPending, // Abhi Denay Hain (Workers)
            totalAdvancesGiven
        },
        supplierExpenses: {
            totalSupplierPayable, // Abhi Denay Hain (Material Suppliers)
            totalSupplierPurchases,
            totalSupplierPaid
        },
        ownerLabor: {
            estimatedOwnerStitchValue,
            estimatedOwnerCutValue,
            totalOwnerLaborEarnings
        },
        netShopBusinessProfit // Net Profit = Total Kaam - Total Kharcha
    });
});

// 9. GET WORKER LEDGER
const getWorkerLedger = catchAsync(async (req, res) => {
    const workerId = req.params.id;

    // Auth check: Admin or the worker themselves
    if (req.user.role !== 'admin' && req.user._id.toString() !== workerId.toString()) {
        res.status(403);
        throw new Error('Not authorized to view this ledger');
    }

    const ledger = await WorkerLedger.find({ worker: workerId }).sort({ date: -1 });
    res.status(200).json(ledger);
});

// 10. RECORD ADVANCE TRANSACTION
const addWorkerAdvance = catchAsync(async (req, res) => {
    const workerId = req.params.id;
    const { amount, operation, description, date } = req.body;

    if (amount === undefined || isNaN(amount) || Number(amount) < 0) {
        res.status(400);
        throw new Error('Please provide a valid positive amount');
    }

    const worker = await Worker.findById(workerId);
    if (!worker) {
        res.status(404);
        throw new Error('Worker not found');
    }

    const value = Number(amount);
    let ledgerAmount = value;
    let desc = description || 'Advance Taken';

    if (operation === 'add') {
        worker.advanceAmount += value;
        ledgerAmount = value;
    } else if (operation === 'subtract') {
        worker.advanceAmount = Math.max(0, worker.advanceAmount - value);
        ledgerAmount = -value;
        desc = description || 'Advance Deducted / Paid Back';
    } else if (operation === 'set') {
        const diff = value - worker.advanceAmount;
        worker.advanceAmount = value;
        ledgerAmount = diff;
        desc = description || `Advance Adjusted to Rs ${value}`;
    } else {
        res.status(400);
        throw new Error('Invalid operation type');
    }

    await worker.save();

    // Create ledger entry if it's not zero change
    let ledgerEntry = null;
    if (ledgerAmount !== 0) {
        ledgerEntry = await WorkerLedger.create({
            worker: workerId,
            type: 'advance',
            amount: ledgerAmount,
            description: desc,
            status: 'Pending',
            date: date ? new Date(date) : new Date()
        });
    }

    res.status(200).json({
        message: 'Advance recorded successfully',
        worker: {
            _id: worker._id,
            name: worker.name,
            advanceAmount: worker.advanceAmount
        },
        ledgerEntry
    });
});

// 11. CALCULATE WORKER SALARY (DRY RUN)
const calculateWorkerSalary = catchAsync(async (req, res) => {
    const workerId = req.params.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Please provide both start date and end date');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Find all Pending ledger entries in date range
    const pendingEntries = await WorkerLedger.find({
        worker: workerId,
        status: 'Pending',
        date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    let totalEarned = 0;
    let totalAdvance = 0;

    const suits = [];
    const advances = [];

    pendingEntries.forEach(entry => {
        if (entry.type === 'suit') {
            totalEarned += entry.amount;
            suits.push(entry);
        } else if (entry.type === 'advance') {
            totalAdvance += entry.amount;
            advances.push(entry);
        }
    });

    const netPaid = totalEarned - totalAdvance;

    res.status(200).json({
        workerId,
        startDate: start,
        endDate: end,
        totalEarned,
        totalAdvance,
        netPaid,
        suits,
        advances
    });
});

// 12. PAY WORKER SALARY (SETTLE LEDGER ENTRIES)
const payWorkerSalary = catchAsync(async (req, res) => {
    const workerId = req.params.id;
    const { startDate, endDate, notes } = req.body;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Please provide both start date and end date');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const worker = await Worker.findById(workerId);
    if (!worker) {
        res.status(404);
        throw new Error('Worker not found');
    }

    // Get pending entries in range
    const pendingEntries = await WorkerLedger.find({
        worker: workerId,
        status: 'Pending',
        date: { $gte: start, $lte: end }
    });

    if (pendingEntries.length === 0) {
        res.status(400);
        throw new Error('No pending ledger entries found in this date range');
    }

    let totalEarned = 0;
    let totalAdvance = 0;

    pendingEntries.forEach(entry => {
        if (entry.type === 'suit') {
            totalEarned += entry.amount;
        } else if (entry.type === 'advance') {
            totalAdvance += entry.amount;
        }
    });

    const netPaid = totalEarned - totalAdvance;

    // Create Payment history record
    const payment = await WorkerPayment.create({
        worker: workerId,
        startDate: start,
        endDate: end,
        totalEarned,
        totalAdvance,
        netPaid,
        notes: notes || ''
    });

    // Update ledger entries status to Paid
    await WorkerLedger.updateMany(
        { _id: { $in: pendingEntries.map(e => e._id) } },
        { status: 'Paid', paymentId: payment._id }
    );

    // Update worker running advance total
    worker.advanceAmount = Math.max(0, worker.advanceAmount - totalAdvance);
    await worker.save();

    res.status(201).json({
        message: 'Salary payment processed successfully',
        payment,
        worker: {
            _id: worker._id,
            name: worker.name,
            advanceAmount: worker.advanceAmount
        }
    });
});

// 13. GET WORKER SALARY PAYMENT HISTORY
const getWorkerPayments = catchAsync(async (req, res) => {
    const workerId = req.params.id;

    if (req.user.role !== 'admin' && req.user._id.toString() !== workerId.toString()) {
        res.status(403);
        throw new Error('Not authorized to view payment history');
    }

    const payments = await WorkerPayment.find({ worker: workerId }).sort({ paymentDate: -1 });
    res.status(200).json(payments);
});

// 14. GET WORKER DETAILS FOR ADMIN
const getWorkerDetails = catchAsync(async (req, res) => {
    const workerId = req.params.id;
    const worker = await Worker.findById(workerId);
    
    if (!worker) {
        res.status(404);
        throw new Error('Worker not found');
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
                    suitId: suit._id,
                    fabricDetails: suit.fabricDetails,
                    volumeNo: suit.volumeNo,
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

    res.status(200).json({
        worker,
        assignedSuits,
        stitchedSuits
    });
});

// 15. UPDATE LEDGER ENTRY (ADMIN ONLY)
const updateLedgerEntry = catchAsync(async (req, res) => {
    const { ledgerId } = req.params;
    const { amount, date, description } = req.body;

    const entry = await WorkerLedger.findById(ledgerId);
    if (!entry) {
        res.status(404);
        throw new Error('Ledger entry not found');
    }

    if (entry.status === 'Paid') {
        res.status(400);
        throw new Error('Cannot edit a paid ledger entry');
    }

    const worker = await Worker.findById(entry.worker);
    if (!worker) {
        res.status(404);
        throw new Error('Worker associated with ledger entry not found');
    }

    const oldAmount = entry.amount;
    const newAmount = Number(amount);

    if (isNaN(newAmount)) {
        res.status(400);
        throw new Error('Invalid amount');
    }

    // Update ledger entry
    entry.amount = newAmount;
    entry.date = date ? new Date(date) : entry.date;
    entry.description = description || entry.description;
    await entry.save();

    // If it's an advance, update worker's running advance total
    if (entry.type === 'advance') {
        worker.advanceAmount = Math.max(0, worker.advanceAmount - oldAmount + newAmount);
        await worker.save();
    }

    res.status(200).json({
        message: 'Ledger entry updated successfully',
        entry,
        workerAdvance: worker.advanceAmount
    });
});

// 16. DELETE LEDGER ENTRY (ADMIN ONLY)
const deleteLedgerEntry = catchAsync(async (req, res) => {
    const { ledgerId } = req.params;

    const entry = await WorkerLedger.findById(ledgerId);
    if (!entry) {
        res.status(404);
        throw new Error('Ledger entry not found');
    }

    if (entry.status === 'Paid') {
        res.status(400);
        throw new Error('Cannot delete a paid ledger entry');
    }

    const worker = await Worker.findById(entry.worker);
    if (worker && entry.type === 'advance') {
        worker.advanceAmount = Math.max(0, worker.advanceAmount - entry.amount);
        await worker.save();
    }

    // If it's a suit entry, reset its stitchingStatus in the Order back to 'Assigned'
    if (entry.type === 'suit' && entry.orderId && entry.suitId) {
        const order = await Order.findById(entry.orderId);
        if (order) {
            const suit = order.suits.id(entry.suitId);
            if (suit) {
                suit.stitchingStatus = 'Assigned';
                await order.save();
            }
        }
    }

    await entry.deleteOne();

    res.status(200).json({
        message: 'Ledger entry deleted successfully',
        ledgerId,
        workerAdvance: worker ? worker.advanceAmount : 0
    });
});

module.exports = {
    createWorker,
    getWorkers,
    getWorkerById,
    updateWorker,
    deleteWorker,
    getWorkerDashboard,
    submitSuitForInspection,
    adminApproveSuit,
    adminRejectSuit,
    adminAssignStage,
    getFinancialSummary,
    markSuitAsStitched,
    adminAssignWorker,
    getWorkerLedger,
    addWorkerAdvance,
    calculateWorkerSalary,
    payWorkerSalary,
    getWorkerPayments,
    getWorkerDetails,
    updateLedgerEntry,
    deleteLedgerEntry
};
