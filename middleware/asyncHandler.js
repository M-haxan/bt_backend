// Yeh function automatically try-catch ka kaam karega aur error aane par aage bhej dega
const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;