// Removes MongoDB operator keys (like $ne, $gt, $where) from the request body.
// Stops NoSQL injection such as:  { "email": { "$ne": null }, "password": "..." }
const clean = (value) => {
    if (Array.isArray(value)) {
        return value.map(clean);
    }
    if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            if (key.startsWith('$') || key === '__proto__') {
                delete value[key];
            } else {
                value[key] = clean(value[key]);
            }
        }
    }
    return value;
};

const sanitizeInput = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        clean(req.body);
    }
    next();
};

module.exports = sanitizeInput;