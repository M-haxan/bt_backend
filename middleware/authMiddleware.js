const jwt = require('jsonwebtoken');
const catchAsync = require('./asyncHandler');
const User = require('../models/User');

const protect = catchAsync(async (req, res, next) => {
    let token;

    // Check karna ke kya request ke headers mein 'Authorization' aur 'Bearer' mojood hai?
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // "Bearer token_xyz" string ko tod kar sirf "token_xyz" nikalna
            token = req.headers.authorization.split(' ')[1];

            // Token ko apne secret key se verify (check) karna
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Token ke andar user ki ID chhupi hoti hai. Us ID se database se user nikal kar 'req.user' mein daal do (password ke baghair)
            req.user = await User.findById(decoded.id).select('-password');

            next(); // Token theek hai, aage jane do!
        } catch (error) {
            res.status(401);
            throw new Error('Aap authorized nahi hain, Token fail ho gaya!');
        }
    }

    // Agar token bheja hi na gaya ho
    if (!token) {
        res.status(401);
        throw new Error('Aap authorized nahi hain, Token mojood nahi hai!');
    }
});

module.exports = { protect };