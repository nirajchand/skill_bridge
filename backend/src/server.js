require('dotenv').config();

// Validate required secrets BEFORE anything else loads. If JWT_SECRET or
// JWT_REFRESH_SECRET are missing/weak/identical, this throws and the process
// exits instead of booting with insecure defaults.
require('./config/secrets');

const app = require('./app');

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`SkillBridge backend listening on port ${port}`);
});
