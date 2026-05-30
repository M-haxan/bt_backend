const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Load .env early
dotenv.config();

const cookieParser = require('cookie-parser');

const app = express();
const allowedOrigins = [
    'http://localhost:5173', 
    // 'https://aapki-live-website.vercel.app' // Jab frontend live ho toh yahan uska link daal dijiyega
];
const corsOptions = {
    origin: function (origin, callback) {
        // Agar request allowed list mein hai, ya Postman (!origin) se aa rahi hai
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy violation: Access Denied'));
        }
    },
    credentials: true, // Cookies allow karne ke liye lazmi
};
app.use(cors(corsOptions)); // CORS ab sab se upar hai
// Middlewares

app.use(express.json());
app.use(cookieParser());

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
const PORT = process.env.PORT || 5000;

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
  