const User = require('../models/User');
const Worker = require('../models/Worker');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const catchAsync = require('../middleware/asyncHandler');

// Password Complexity Validation Helper
// Minimum 8 characters, at least 1 special character
const validatePassword = (password) => {
    if (!password || typeof password !== 'string') {
        return 'Password is required';
    }
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]`~]/;
    if (!specialCharRegex.test(password)) {
        return 'Password must contain at least one special character (e.g. !@#$%^&*).';
    }
    return null;
};

// Token Generate aur Cookie set karne ka function
const generateToken = (res, id) => {
    // Token 30 din tak valid rahega
    const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    // Set JWT as HTTP-Only Cookie
    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
        sameSite: 'none', // Prevent CSRF attacks
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    return token;
};

// 1. REGISTER ADMIN (Accessible via hidden registration route)
const registerAdmin = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Name, email, and password are required');
    }

    // Password validation (8+ characters, at least 1 special character)
    const passwordError = validatePassword(password);
    if (passwordError) {
        res.status(400);
        throw new Error(passwordError);
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
        res.status(400);
        throw new Error('An account with this email address already exists');
    }

    const user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        password
    });

    if (user) {
        const token = generateToken(res, user._id);

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: token
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// 2. LOGIN ADMIN
const loginAdmin = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // Email se user dhoondo
    const user = await User.findOne({ email });

    // Agar user mil jaye aur password match kar jaye
    if (user && (await user.matchPassword(password))) {
        const token = generateToken(res, user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: token
        });
    } else {
        res.status(401); // Unauthorized
        throw new Error('Incorrect Password or Email');
    }
});

// 3. LOGOUT ADMIN
const logoutAdmin = catchAsync(async (req, res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0)
    });

    res.status(200).json({ message: 'Logged out successfully' });
});

// 4. LOGIN WORKER
const loginWorker = catchAsync(async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        res.status(400);
        throw new Error('Phone number and password are required');
    }

    const cleanPhone = String(phone).trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    const withZero = digitsOnly.startsWith('0') ? digitsOnly : '0' + digitsOnly;
    const withoutZero = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly;
    const numVal = Number(withoutZero);

    // Flexible phone lookup for legacy and new accounts
    const worker = await Worker.findOne({
        $or: [
            { phone: cleanPhone },
            { phone: withZero },
            { phone: withoutZero },
            ...(isNaN(numVal) ? [] : [{ phone: numVal }])
        ]
    });

    if (worker && (await worker.matchPassword(password))) {
        // Active check karein
        if (!worker.isActive) {
            res.status(403);
            throw new Error('Worker account is inactive. Please contact admin.');
        }

        const token = generateToken(res, worker._id);

        res.json({
            _id: worker._id,
            name: worker.name,
            phone: worker.phone,
            role: worker.role,
            canCreateOrder: Boolean(worker.canCreateOrder),
            canDeliverOrder: Boolean(worker.canDeliverOrder),
            token: token
        });
    } else {
        res.status(401);
        throw new Error('Incorrect Password or Phone Number');
    }
});

// 5. GET ADMIN PROFILE (Protected)
const getAdminProfile = catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.status(200).json(user);
});

// 6. UPDATE ADMIN PROFILE (Protected)
const updateAdminProfile = catchAsync(async (req, res) => {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (name) user.name = name.trim();

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
        const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists && emailExists._id.toString() !== user._id.toString()) {
            res.status(400);
            throw new Error('This email is already in use by another account');
        }
        user.email = email.toLowerCase().trim();
    }

    // Password change verification
    if (newPassword) {
        if (!currentPassword) {
            res.status(400);
            throw new Error('Current password is required to set a new password');
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            res.status(400);
            throw new Error('Current password is incorrect');
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            res.status(400);
            throw new Error(passwordError);
        }

        user.password = newPassword;
    }

    const updatedUser = await user.save();

    res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
    });
});

// 7. FORGOT PASSWORD (Send Reset Link to Email)
const forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error('Please enter your registered email address');
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
        res.status(404);
        throw new Error('This email is not registered with any admin account. Please enter your registered email address.');
    }

    // Generate crypto token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 Hour
    await user.save({ validateBeforeSave: false });

    // Client Reset URL
    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${origin}/reset-password/${resetToken}`;

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; color: #1e293b;">
        <div style="background-color: #0F172A; padding: 24px; text-align: center;">
          <h1 style="color: #DFAC43; margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">BALOUCH TAILORS</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; letter-spacing: 1px;">Admin Security & Password Reset</p>
        </div>
        <div style="padding: 30px 24px;">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Hello ${user.name || 'Admin'},</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We received a request to reset the password for your Balouch Tailors administrative account (<strong>${user.email}</strong>).
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #DFAC43; color: #000000; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px; display: inline-block; font-size: 14px; letter-spacing: 0.5px;">
              Reset My Password
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Or copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${resetUrl}</a>
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #DFAC43; padding: 12px; margin-top: 24px;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              ⏱️ <strong>Note:</strong> This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
            </p>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          © ${new Date().getFullYear()} Balouch Tailors. All rights reserved.
        </div>
      </div>
    `;

    try {
        await sendEmail({
            to: user.email,
            subject: 'Balouch Tailors - Password Reset Link',
            text: `You requested a password reset for your Balouch Tailors account. Please click the following link: ${resetUrl}`,
            html: htmlMessage
        });

        res.status(200).json({
            message: 'Password reset link has been sent to your email address.',
            resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
        });
    } catch (err) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save({ validateBeforeSave: false });
        res.status(500);
        throw new Error(`Email could not be sent: ${err.message}`);
    }
});

// 8. RESET PASSWORD (Verify Token & Update Password)
const resetPassword = catchAsync(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const passwordError = validatePassword(password);
    if (passwordError) {
        res.status(400);
        throw new Error(passwordError);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Password reset token is invalid or has expired. Please request a new one.');
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
        message: 'Password has been reset successfully! You can now login with your new password.'
    });
});

module.exports = { 
    registerAdmin, 
    loginAdmin, 
    logoutAdmin, 
    loginWorker,
    getAdminProfile,
    updateAdminProfile,
    forgotPassword,
    resetPassword,
    validatePassword
};