const rateLimit = require('express-rate-limit');

const createLimiter = (options) =>
    rateLimit({
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        ...options
    });

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Whole API: generous. Only stops scraping / flooding.
const apiLimiter = createLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 1500,
    message: { message: 'Too many requests. Please try again in a few minutes.' }
});

// Login, limit 1 (per visitor IP): only FAILED attempts are counted.
// 20 so that a whole shop sharing one WiFi (= one IP) is not locked out by a few typos.
const loginLimiter = createLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 20,
    skipSuccessfulRequests: true,
    message: { message: 'Too many failed login attempts. Please try again in 15 minutes.' }
});

// Login, limit 2 (per ACCOUNT): stops someone guessing one worker's PIN from many places.
// The key is the email / phone being attacked, not the IP.
const accountLoginLimiter = createLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 8,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const body = req.body || {};
        const identifier = body.email || body.phone || 'unknown';
        return `login:${String(identifier).toLowerCase().trim().slice(0, 100)}`;
    },
    message: { message: 'Too many failed attempts for this account. Please try again in 15 minutes.' }
});

// Password reset emails: strict, every request counts
const forgotPasswordLimiter = createLimiter({
    windowMs: ONE_HOUR,
    limit: 5,
    message: { message: 'Too many password reset requests. Please try again in an hour.' }
});

// Reset-with-token and registration attempts
const sensitiveLimiter = createLimiter({
    windowMs: ONE_HOUR,
    limit: 10,
    message: { message: 'Too many attempts. Please try again later.' }
});

// Silent token refresh (every user needs it about once per 15 minutes)
const refreshLimiter = createLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 100,
    message: { message: 'Too many session refresh requests. Please try again shortly.' }
});

// Public order tracking (stops people scanning BT-1, BT-2, BT-3 ... or guessing phone digits)
const trackLimiter = createLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 40,
    message: { message: 'Too many tracking attempts. Please try again in a few minutes.' }
});

module.exports = {
    apiLimiter,
    loginLimiter,
    accountLoginLimiter,
    forgotPasswordLimiter,
    sensitiveLimiter,
    refreshLimiter,
    trackLimiter
};