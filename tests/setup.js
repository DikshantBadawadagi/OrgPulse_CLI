// setup.js
import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

let connection;

beforeAll(async () => {
  // Allow tests to use either MONGODB_URI or the existing MONGO_URI from project .env
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("❌ MONGODB_URI or MONGO_URI not found in .env");
  }

  // Increase Jest timeout for slow Atlas connection
  jest.setTimeout(120000);

  connection = await mongoose.connect(uri, {
    dbName: 'test', // separate db for testing
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  if (connection) {
    await mongoose.connection.dropDatabase(); // clean test db
    await mongoose.disconnect();
  }
});
