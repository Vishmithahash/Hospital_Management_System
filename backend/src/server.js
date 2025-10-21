const http = require('http');
const mongoose = require('mongoose');

const app = require('./app');
const env = require('./config/env');
const { connectDB, stopMemoryServer } = require('./config/db');
const logger = require('./utils/logger');
const { seedUsers } = require('./config/seed');

let server;

async function start() {
  try {
    await connectDB();
    await seedUsers();

    server = http.createServer(app);

    server.listen(env.PORT, () => {
      logger.info(`Server listening on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exitCode = 1;
  }
}

function gracefulShutdown(error) {
  if (error) {
    logger.error('Shutting down due to fatal error', { error });
  } else {
    logger.info('Received shutdown signal, terminating gracefully');
  }

  const closeDatabase = () =>
    mongoose.connection
      .close()
      .then(() => logger.info('Database connection closed'))
      .catch((dbError) => {
        logger.error('Error closing database connection', { error: dbError });
        throw dbError;
      });

  const exitProcess = (status) => {
    process.exit(status);
  };

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      closeDatabase()
        .then(() => stopMemoryServer())
        .then(() => exitProcess(error ? 1 : 0))
        .catch(() => exitProcess(1));
    });
  } else {
    closeDatabase()
      .then(() => stopMemoryServer())
      .then(() => exitProcess(error ? 1 : 0))
      .catch(() => exitProcess(1));
  }
}

process.on('unhandledRejection', (reason) => {
  gracefulShutdown(reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  gracefulShutdown(error);
});

process.on('SIGINT', () => gracefulShutdown());
process.on('SIGTERM', () => gracefulShutdown());

start();
