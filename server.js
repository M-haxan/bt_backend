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
// const defaultAllowedOrigins = [
//     'http://localhost:5173',
//     'http://localhost:3000',
//     'https://balouch-tailors.vercel.app'
// ];
// const envAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
//     .split(',')
//     .map((origin) => origin.trim())
//     .filter(Boolean);
// const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

// const normalizeOrigin = (origin) => origin?.replace(/\/$/, '');

// const isAllowedOrigin = (origin) => {
//     if (!origin) return true;

//     const normalizedOrigin = normalizeOrigin(origin);
//     return allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin) ||
//         /^(https?:\/\/.*\.(vercel\.app|vercel\.dev))$/i.test(normalizedOrigin);
// };

const corsOptions = {
    origin:'https://balouch-tailors.vercel.app/',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
   optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
// Middlewares

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/catalogue', require('./routes/catalogueRoutes'));
app.use('/api/pricing', require('./routes/pricingRoutes'));
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
// Error handler (after routes)
app.use(errorHandler);

// Start server after DB connection
const PORT = process.env.PORT || 7860;

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
  