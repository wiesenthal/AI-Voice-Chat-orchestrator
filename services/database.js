import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

// Create a connection pool
export const dbQueryPool = mysql.createPool({
  host: process.env.DB_ENDPOINT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, // replace with your database name
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0
});
