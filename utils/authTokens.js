const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Session = require('../models/Session');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ROTATION_GRACE_MS = 30 * 1000; // see note in refresh controller
const REFRESH_COOKIE = 'refreshToken';

const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');
const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

const baseCookieOptions = () => {
    const isDev = process.env.NODE_ENV === 'development';
    return {
        httpOnly: true,
        secure: !isDev,
        sameSite: isDev ? 'lax' : 'none'
    };
};

// The refresh cookie is only sent to /api/auth/* (not to every request)
const setRefreshCookie = (res, refreshToken) => {
    res.cookie(REFRESH_COOKIE, refreshToken, {
        ...baseCookieOptions(),
        path: '/api/auth',
        maxAge: REFRESH_TOKEN_MS
    });
};

// Options must match the ones used when the cookie was set, or the browser keeps it.
const clearAuthCookies = (res) => {
    res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: '/api/auth' });
    res.clearCookie('jwt', { ...baseCookieOptions(), path: '/' }); // old cookie from the previous version
};

const signAccessToken = (user, sessionId) =>
    jwt.sign(
        { id: user._id, tv: user.tokenVersion || 0, sid: String(sessionId) },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
    );

// Called at login: creates the session, sets the refresh cookie, returns the access token
const startSession = async (req, res, user, userModel) => {
    const refreshToken = generateRefreshToken();

    const session = await Session.create({
        user: user._id,
        userModel,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: (req.get('user-agent') || '').slice(0, 200),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS)
    });

    setRefreshCookie(res, refreshToken);
    return signAccessToken(user, session._id);
};

// Log a user out everywhere (optionally keeping one session alive)
const revokeSessions = (userId, exceptSessionId = null) => {
    const filter = { user: userId };
    if (exceptSessionId) filter._id = { $ne: exceptSessionId };
    return Session.deleteMany(filter);
};

module.exports = {
    REFRESH_COOKIE,
    REFRESH_TOKEN_MS,
    ROTATION_GRACE_MS,
    hashToken,
    generateRefreshToken,
    setRefreshCookie,
    clearAuthCookies,
    signAccessToken,
    startSession,
    revokeSessions
};