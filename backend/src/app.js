const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { createLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const applicationsRoutes = require('./routes/applications');
const contractsRoutes = require('./routes/contracts');
const disputesRoutes = require('./routes/disputes');
const paymentsRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware is scaffolded in src/middleware/rateLimiter.js.
createLimiter;

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/disputes', disputesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

module.exports = app;