// import dependencies
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// create express app
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// connect to database
mongoose.connect(process.env.MONGODB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to database');
});

// routes
const jobsRouter = require('./routes/api/v1/jobs');
const usersRouter = require('./routes/api/v1/user');
const crewRouter = require('./routes/api/v1/crew');
const businessRouter = require('./routes/api/v1/business');
const mailController = require('./routes/api/v1/mail');

// route handlers
app.use('/api/v1/jobs', jobsRouter);
app.use('/api/v1/user', usersRouter);
app.use('/api/v1/crew', crewRouter);
app.use('/api/v1/business', businessRouter);
app.use('/api/v1/mail', mailController);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;