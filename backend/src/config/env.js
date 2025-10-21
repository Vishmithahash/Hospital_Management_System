const dotenv = require('dotenv');

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const PSP_WEBHOOK_SECRET = process.env.PSP_WEBHOOK_SECRET || 'dev-psp-secret';

if (NODE_ENV === 'production') {
  if (!MONGO_URI) {
    throw new Error('Missing MONGO_URI in production environment');
  }

  if (!JWT_SECRET) {
    throw new Error('Missing JWT_SECRET in production environment');
  }
}

const env = Object.freeze({
  NODE_ENV,
  PORT,
  MONGO_URI,
  JWT_SECRET,
  PSP_WEBHOOK_SECRET
});

module.exports = env;
