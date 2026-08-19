const jwt = require('jsonwebtoken');
const catchAsync = require('./asyncHandler');
const User = require('../models/User');

const protect = catchAsync(async (req, res, next) => {
    let token;

    // Check karna ke kya request ke cookies mein 'jwt' mojood hai, ya phir headers mein 'Authorization' mojood hai?
    if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            // Token ko apne secret key se verify (check) karna
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Token ke andar user ki ID chhupi hoti hai. Us ID se database se user nikal kar 'req.user' mein daal do (password ke baghair)
            let user = await User.findById(decoded.id).select('-password');

            // Agar user (Admin) nahi mila, to Worker check karein
            if (!user) {
                const Worker = require('../models/Worker');
                user = await Worker.findById(decoded.id).select('-password');
            }

            if (!user) {
                res.status(401);
                throw new Error('User not found, authentication failed!');
            }

            req.user = user;
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