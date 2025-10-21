const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

let connectionPromise;
let memoryServer;
let MongoMemoryServer;

function loadMemoryServer() {
  if (MongoMemoryServer) {
    return MongoMemoryServer;
  }

  try {
    // eslint-disable-next-line global-require
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
    return MongoMemoryServer;
  } catch (error) {
    throw new Error(
      'mongodb-memory-server is not installed. Run "npm install mongodb-memory-server" or set MONGO_URI in your environment.'
    );
  }
}

async function resolveMongoUri() {
  if (env.MONGO_URI) {
    return env.MONGO_URI;
  }

  if (!memoryServer) {
    const MemoryServerCtor = loadMemoryServer();
    memoryServer = await MemoryServerCtor.create();
    logger.warn('MONGO_URI not set. Using in-memory MongoDB instance for development.');
  }

  return memoryServer.getUri();
}

async function connectDB() {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = resolveMongoUri()
    .then((uri) =>
      mongoose.connect(uri, {
        autoIndex: env.NODE_ENV !== 'production'
      })
    )
    .then((connection) => {
      logger.info('Connected to MongoDB');
      return connection;
    })
    .catch(async (error) => {
      logger.error('MongoDB connection error', { error });
      connectionPromise = undefined;

      if (memoryServer) {
        await memoryServer.stop();
        memoryServer = undefined;
      }

      throw error;
    });

  return connectionPromise;
}

async function stopMemoryServer() {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

module.exports = {
  connectDB,
  stopMemoryServer
};
