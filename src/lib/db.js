import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '1q2w3e', // Ensure this is your system-level postgres password
});

export default pool;
