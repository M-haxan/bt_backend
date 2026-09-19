const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Load .env early
dotenv.config();

const cookieParser = require('cookie-parser');

const app = express();

const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
    : [];

// Default allowed origins (Ensures custom domain works even if Heroku config var is pending)
const defaultAllowedOrigins = [
    'https://www.balouchtailors.app',
    'https://balouchtailors.app',
    'https://balouch-tailors.vercel.app',
    'https://www.balouch-tailors.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000'
];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        const cleanOrigin = origin.trim().replace(/\/$/, '');
        if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
            return callback(null, true); // Permissive fallback to prevent preflight blocks
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Explicitly handle all preflight OPTIONS requests
// Middlewares

app.use(express.json());
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
  