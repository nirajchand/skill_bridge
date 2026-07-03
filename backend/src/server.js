require('dotenv').config();

const app = require('./app');

const port = process.env.PORT || 3001;

app.listen(port, () => {
  // Server entry point for the SkillBridge backend scaffold.
  console.log(`SkillBridge backend listening on port ${port}`);
});