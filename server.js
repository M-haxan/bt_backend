const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Load .env early
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/catalogue', require('./routes/catalogueRoutes'));
app.use('/api/pricing', require('./routes/pricingRoutes'));

app.get('/', (req, res) => {
    res.send('Balouch Tailors API is running successfully...');
});

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