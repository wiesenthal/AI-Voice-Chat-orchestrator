import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

// Create a connection pool
export const dbQueryPool = mysql.createPool({
  host: process.env.DB_ENDPOINT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0
});


/* EXAMPLE USAGE:
try {
    const [rows] = await dbQueryPool.execute('SHOW DATABASES;');
    console.log(`Successfully made database query. Rows: ${JSON.stringify(rows)}`);
} catch(err) {
    console.log(err);
}
*/