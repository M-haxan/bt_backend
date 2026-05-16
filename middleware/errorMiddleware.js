const errorHandler = (err, req, res, next) => {
    // Agar status code pehle se set nahi hai (yani 200 hai), toh usko 500 (Server Error) kar do
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        message: err.message,
        // Stack trace sirf development mode mein dikhega, production mein nahi (security ke liye)
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { errorHandler };