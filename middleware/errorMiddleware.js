const errorHandler = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';

    // 1) Errors created with httpError(...) carry their own status code.
    // 2) Otherwise use the status the controller set (res.status(...)), or 500 if it forgot.
    const unexpected = !err.statusCode && res.statusCode === 200;
    let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
    let message = err.message;

    // Common database errors: these are the CLIENT's fault, not a server crash
    if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID or value format';
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.code === 11000) {
        statusCode = 409;
        message = 'A record with this value already exists';
    }

    if (statusCode >= 500) {
        console.error(err); // full details stay in the server log only
        // Do not leak internal details (database/library messages) to visitors
        if (unexpected && !isDev) {
            message = 'Something went wrong on the server. Please try again.';
        }
    }

    res.status(statusCode).json({
        message,
        stack: isDev ? err.stack : undefined
    });
};

module.exports = { errorHandler };