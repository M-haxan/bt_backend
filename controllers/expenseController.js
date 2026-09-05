const Supplier = require('../models/Supplier');
const SupplierLedger = require('../models/SupplierLedger');
const Expense = require('../models/Expense');
const catchAsync = require('../middleware/asyncHandler');

// 1. Create Supplier
const createSupplier = catchAsync(async (req, res) => {
    const { name, shopName, phone, category, address } = req.body;

    if (!name || !shopName || !phone) {
        return res.status(400).json({
            success: false,
            message: 'Name, Shop Name and Phone number are required'
        });
    }

    const supplier = await Supplier.create({
        name,
        shopName,
        phone,
        category: category || 'General Accessories',
        address: address || ''
    });

    res.status(201).json({
        success: true,
        message: 'Supplier registered successfully',
        data: supplier
    });
});

// 2. Get All Suppliers
const getSuppliers = catchAsync(async (req, res) => {
    const suppliers = await Supplier.find({}).sort({ createdAt: -1 });

    // Aggregate summary
    let totalPurchasesAll = 0;
    let totalPaidAll = 0;
    let totalBalancePayableAll = 0;

    suppliers.forEach(s => {
        totalPurchasesAll += (s.totalPurchases || 0);
        totalPaidAll += (s.totalPaid || 0);
        totalBalancePayableAll += (s.balancePayable || 0);
    });

    res.status(200).json({
        success: true,
        summary: {
            totalPurchasesAll,
            totalPaidAll,
            totalBalancePayableAll,
            supplierCount: suppliers.length
        },
        data: suppliers
    });
});

// 3. Get Single Supplier & Ledger Statement
const getSupplierLedger = catchAsync(async (req, res) => {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
        return res.status(404).json({
            success: false,
            message: 'Supplier not found'
        });
    }

    const ledger = await SupplierLedger.find({ supplier: id }).sort({ date: -1, createdAt: -1 });

    res.status(200).json({
        success: true,
        supplier,
        ledger
    });
});

// 4. Add Purchase from Supplier (Maal Khareeda)
const addSupplierPurchase = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { itemDetails, amount, paymentStatus, paymentMethod, notes, date } = req.body;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
        return res.status(404).json({
            success: false,
            message: 'Supplier not found'
        });
    }

    const purchaseAmount = Number(amount);
    if (isNaN(purchaseAmount) || purchaseAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Valid purchase amount is required'
        });
    }

    const isPaidNow = paymentStatus === 'Paid';

    // 1. Create Supplier Ledger Entry
    const ledgerEntry = await SupplierLedger.create({
        supplier: id,
        date: date ? new Date(date) : new Date(),
        itemDetails: itemDetails || 'Material items purchase',
        type: 'purchase',
        amount: purchaseAmount,
        paymentStatus: isPaidNow ? 'Paid' : 'Unpaid',
        paymentMethod: paymentMethod || (isPaidNow ? 'Cash' : 'Credit'),
        notes: notes || ''
    });

    // 2. Update Supplier balances
    supplier.totalPurchases += purchaseAmount;
    if (isPaidNow) {
        supplier.totalPaid += purchaseAmount;
    } else {
        supplier.balancePayable += purchaseAmount;
    }
    await supplier.save();

    // 3. Record in Shop Expenses Journal
    await Expense.create({
        title: `${supplier.shopName} - ${itemDetails}`,
        category: 'Material & Supplies',
        amount: purchaseAmount,
        date: date ? new Date(date) : new Date(),
        paidTo: supplier.shopName,
        paymentMethod: isPaidNow ? (paymentMethod || 'Cash') : 'Credit',
        supplierId: supplier._id,
        notes: isPaidNow ? 'Paid immediately' : 'Purchased on Udhar / Credit'
    });

    res.status(201).json({
        success: true,
        message: 'Material purchase recorded successfully',
        data: {
            ledgerEntry,
            supplier
        }
    });
});

// 5. Settle / Pay Supplier (Supplier ko paise diye)
const settleSupplierPayment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { amount, paymentMethod, notes, date } = req.body;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
        return res.status(404).json({
            success: false,
            message: 'Supplier not found'
        });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Valid payment amount is required'
        });
    }

    // 1. Create Payment Ledger Entry
    const paymentEntry = await SupplierLedger.create({
        supplier: id,
        date: date ? new Date(date) : new Date(),
        itemDetails: `Payment settlement to ${supplier.shopName}`,
        type: 'payment',
        amount: payAmount,
        paymentStatus: 'Paid',
        paymentMethod: paymentMethod || 'Cash',
        notes: notes || 'Supplier Khata balance settlement'
    });

    // 2. Update Supplier balances
    supplier.totalPaid += payAmount;
    supplier.balancePayable = Math.max(0, supplier.balancePayable - payAmount);
    await supplier.save();

    res.status(200).json({
        success: true,
        message: `Rs ${payAmount} paid to ${supplier.shopName} successfully`,
        data: {
            paymentEntry,
            supplier
        }
    });
});

// 6. Delete Supplier
const deleteSupplier = catchAsync(async (req, res) => {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
        return res.status(404).json({
            success: false,
            message: 'Supplier not found'
        });
    }

    await SupplierLedger.deleteMany({ supplier: id });
    await Supplier.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: 'Supplier and related ledger removed successfully'
    });
});

// 7. Create Direct Shop Expense (Rent, Electricity, Tea, Maintenance)
const createDirectExpense = catchAsync(async (req, res) => {
    const { title, category, amount, date, paidTo, paymentMethod, notes } = req.body;

    const expAmount = Number(amount);
    if (!title || isNaN(expAmount) || expAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Valid title and amount are required'
        });
    }

    const expense = await Expense.create({
        title,
        category: category || 'Misc & General',
        amount: expAmount,
        date: date ? new Date(date) : new Date(),
        paidTo: paidTo || '',
        paymentMethod: paymentMethod || 'Cash',
        notes: notes || ''
    });

    res.status(201).json({
        success: true,
        message: 'Shop expense logged successfully',
        data: expense
    });
});

// 8. Get All Shop Expenses
const getExpenses = catchAsync(async (req, res) => {
    const { category, startDate, endDate } = req.query;

    let query = {};
    if (category && category !== 'All') {
        query.category = category;
    }

    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 });

    let totalExpenseAmount = 0;
    const categoryTotals = {};

    expenses.forEach(e => {
        totalExpenseAmount += (e.amount || 0);
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0);
    });

    res.status(200).json({
        success: true,
        totalExpenseAmount,
        categoryTotals,
        count: expenses.length,
        data: expenses
    });
});

// 9. Delete Direct Expense
const deleteExpense = catchAsync(async (req, res) => {
    const { id } = req.params;

    const expense = await Expense.findById(id);
    if (!expense) {
        return res.status(404).json({
            success: false,
            message: 'Expense not found'
        });
    }

    await Expense.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: 'Expense entry deleted successfully'
    });
});

module.exports = {
    createSupplier,
    getSuppliers,
    getSupplierLedger,
    addSupplierPurchase,
    settleSupplierPayment,
    deleteSupplier,
    createDirectExpense,
    getExpenses,
    deleteExpense
};
