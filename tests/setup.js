// setup.js
import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

let connection;

beforeAll(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGODB_URI or MONGO_URI not found in .env");
  }

  jest.setTimeout(120000);

  connection = await mongoose.connect(uri, {
    dbName: 'test', 
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  if (connection) {
    await mongoose.connection.dropDatabase(); 
    await mongoose.disconnect();
  }
});
