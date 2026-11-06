const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const helmet = require('helmet');
const sanitizeInput = require('./middleware/sanitizeInput');
const { apiLimiter } = require('./middleware/rateLimiters');

// Load .env early
dotenv.config();

const cookieParser = require('cookie-parser');

const app = express();

// We run behind ONE proxy (Render / Heroku / Hugging Face). Without this every visitor looks like
// the same IP (the proxy's), and rate limits would punish everyone together.
app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];

const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200 // For legacy browser support
};

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // safe security headers
app.use(cors(corsOptions));
app.use('/api', apiLimiter);                 // global rate limit
app.use(express.json({ limit: '1mb' }));     // was unlimited-ish before
app.use(sanitizeInput);                      // strips $operators from request bodies
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/catalogue', require('./routes/catalogueRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/pricing', require('./routes/pricingRoutes'));
app.use('/api/tailoring-services', require('./routes/tailoringServiceRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
// Order routes
app.use('/api/orders', require('./routes/orderRoutes'));
app.get('/', (req, res) => {
    res.send('Balouch Tailors API is running successfully...');
});
// customer routes
app.use('/api/customer', require('./routes/customerRoutes'));
// template routes
app.use('/api/template', require('./routes/templateRoutes'));
// worker routes
app.use('/api/workers', require('./routes/workerRoutes'));
// expense & supplier routes
app.use('/api/expenses', require('./routes/expenseRoutes'));
// shop settings routes
app.use('/api/settings', require('./routes/shopSettingRoutes'));
// Error handler (after routes)
app.use(errorHandler);

// Start server after DB connection
const PORT = process.env.PORT || 3000;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
