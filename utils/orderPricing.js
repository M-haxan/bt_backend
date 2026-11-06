const mongoose = require('mongoose');
const httpError = require('./httpError');

// ---------------------------------------------------------------
// SHOP POLICY SWITCH
// false = only the admin may type a custom suit price or give a discount.
//         Workers always get the price-list price.
// true  = workers may also set custom prices / discounts (like before).
// ---------------------------------------------------------------
const WORKERS_CAN_SET_CUSTOM_PRICES = false;

const MAX_SUITS_PER_ORDER = 50;
const MAX_ALTERATIONS_PER_ORDER = 50;
const MAX_AMOUNT = 10000000; // 1 crore: anything above is certainly a mistake

const round2 = (n) => Math.round(n * 100) / 100;

// "500", 500, "" -> number. Rejects negative, NaN, Infinity, absurdly large values.
const toMoney = (value, label = 'Amount') => {
    if (value === undefined || value === null || value === '') return 0;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) {
        throw httpError(400, `${label} must be a valid amount (0 or more)`);
    }
    return round2(n);
};

const toPercent = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw httpError(400, 'Discount must be between 0 and 100 percent');
    }
    return n;
};

const toText = (value, max = 200) =>
    value === undefined || value === null ? '' : String(value).trim().slice(0, max);

// FormData sends arrays/objects as JSON strings; JSON requests send real arrays.
const parseJsonField = (value, fallback = []) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        throw httpError(400, 'Invalid data format in request');
    }
};

// Price list from the TailoringService collection
const buildCatalogue = (services) => {
    const base = new Map();   // garment name -> base price
    const addons = new Map(); // add-on name  -> price
    services.forEach((s) => {
        if (s.itemType === 'customization') {
            addons.set(s.serviceName, Number(s.price) || 0);
        } else {
            base.set(s.serviceName, Number(s.price) || 0);
        }
    });
    return { base, addons };
};

// Takes ONE suit from the request and returns ONLY the fields we allow.
// Anything else the client sent (wages, worker assignment, QC status, suitNumber ...) is thrown away.
const cleanSuit = (raw, { customerId, catalogue, canCustomize, existing = null }) => {
    if (!raw || typeof raw !== 'object') {
        throw httpError(400, 'Invalid suit data');
    }

    const serviceType = toText(raw.serviceType, 100) || 'Shalwar Qameez';

    const rawCustoms = Array.isArray(raw.customizations) ? raw.customizations.slice(0, 30) : [];
    let customizations = rawCustoms
        .map((c) => ({
            name: toText(c && c.name, 100),
            urduName: toText(c && c.urduName, 100),
            price: toMoney(c && c.price, 'Add-on price')
        }))
        .filter((c) => c.name);

    let basePrice;
    let price;

    // An existing suit whose service and price were NOT changed keeps its stored prices.
    // (Old orders keep their old prices even if the price list changed later.)
    const clientPrice = raw.price === undefined || raw.price === '' ? null : toMoney(raw.price, 'Suit price');
    const unchanged =
        existing &&
        existing.serviceType === serviceType &&
        clientPrice !== null &&
        Math.abs(clientPrice - Number(existing.price)) < 0.01;

    if (unchanged) {
        basePrice = Number(existing.basePrice) || 0;
        price = Number(existing.price) || 0;
        customizations = (existing.customizations || []).map((c) => ({
            name: c.name,
            urduName: c.urduName,
            price: c.price
        }));
    } else {
        const catalogBase = catalogue.base.get(serviceType);
        const knownBase = catalogBase !== undefined;
        const allAddonsKnown = customizations.every((c) => catalogue.addons.has(c.name));

        if (!canCustomize && (!knownBase || !allAddonsKnown)) {
            throw httpError(400, `"${serviceType}" or one of its add-ons is not in the price list. Please refresh the page and try again.`);
        }

        // Always prefer the real price-list values over what the browser sent
        basePrice = knownBase ? catalogBase : toMoney(raw.basePrice, 'Base price');
        customizations = customizations.map((c) => ({
            ...c,
            price: catalogue.addons.has(c.name) ? catalogue.addons.get(c.name) : c.price
        }));

        const calculated = round2(basePrice + customizations.reduce((sum, c) => sum + c.price, 0));

        if (canCustomize) {
            price = clientPrice !== null ? clientPrice : calculated; // admin may type a custom price
        } else {
            if (clientPrice !== null && Math.abs(clientPrice - calculated) > 0.01) {
                throw httpError(400, 'Suit price does not match the price list. Only admin can set custom prices. Please refresh the page and try again.');
            }
            price = calculated;
        }
    }

    return {
        serviceType,
        basePrice,
        customizations,
        price,
        fabricDetails: toText(raw.fabricDetails) || serviceType,
        volumeNo: toText(raw.volumeNo, 50) || 'Standard',
        staticTags: Array.isArray(raw.staticTags)
            ? raw.staticTags.slice(0, 30).map((t) => toText(t, 60)).filter(Boolean)
            : [],
        customDesign: toText(raw.customDesign, 1000),
        wearer: mongoose.isValidObjectId(raw.wearer) ? String(raw.wearer) : String(customerId)
    };
};

const cleanAlterations = (rawAlterations, customerId) => {
    if (!Array.isArray(rawAlterations)) return [];
    if (rawAlterations.length > MAX_ALTERATIONS_PER_ORDER) {
        throw httpError(400, 'Too many alterations in one order');
    }
    return rawAlterations.map((a) => ({
        description: toText(a && a.description, 500),
        price: toMoney(a && a.price, 'Alteration price'),
        wearer: String(customerId)
    }));
};

// Same formula the frontend uses, but now the SERVER is the one that decides.
const calculateSubtotals = ({ suits, alterations, discountPercent }) => {
    const suitsTotal = suits.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const altsTotal = alterations.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    const subtotal = round2(suitsTotal + altsTotal);

    const discountAmount = discountPercent > 0 ? Math.round((subtotal * discountPercent) / 100) : 0;
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    return { subtotal, discountAmount, discountedSubtotal };
};

// Customer's khata balance: positive = customer owes us, negative = customer has advance with us.
// The amount is taken from the DATABASE, never from the browser.
const resolveNewAdjustment = (requestedType, khataBalance, discountedSubtotal) => {
    const balance = Number(khataBalance) || 0;
    if (requestedType === 'added_due' && balance > 0) {
        return { type: 'added_due', amount: round2(balance) };
    }
    if (requestedType === 'deducted_advance' && balance < 0) {
        return { type: 'deducted_advance', amount: round2(Math.min(discountedSubtotal, Math.abs(balance))) };
    }
    return { type: 'none', amount: 0 };
};

const applyAdjustment = (discountedSubtotal, adjustment) => {
    if (adjustment.type === 'added_due') {
        return round2(discountedSubtotal + adjustment.amount);
    }
    if (adjustment.type === 'deducted_advance') {
        return round2(Math.max(0, discountedSubtotal - adjustment.amount));
    }
    return round2(discountedSubtotal);
};

// Has any production work started on this suit? (then it must not be deleted / reset)
const hasProductionStarted = (suit) =>
    (suit.stitchingStatus && suit.stitchingStatus !== 'Pending') ||
    Boolean(suit.assignedWorker) ||
    ['cutting', 'stitching', 'finishing'].some((stage) => {
        const s = suit[stage];
        return s && ((s.status && s.status !== 'Pending') || s.assignedWorker);
    });

module.exports = {
    WORKERS_CAN_SET_CUSTOM_PRICES,
    MAX_SUITS_PER_ORDER,
    round2,
    toMoney,
    toPercent,
    toText,
    parseJsonField,
    buildCatalogue,
    cleanSuit,
    cleanAlterations,
    calculateSubtotals,
    resolveNewAdjustment,
    applyAdjustment,
    hasProductionStarted
};