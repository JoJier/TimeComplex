import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    
    // Create TimeBlocks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS timeblocks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        title VARCHAR(255) NOT NULL,
        color VARCHAR(50),
        category VARCHAR(100),
        y INTEGER DEFAULT 400,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Strokes (Drawings) table
    // We store the points as a JSONB array for flexibility and performance
    await client.query(`
      CREATE TABLE IF NOT EXISTS strokes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        color VARCHAR(50) NOT NULL,
        width INTEGER NOT NULL,
        points JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Stickers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        emoji VARCHAR(50) NOT NULL,
        time VARCHAR(50) NOT NULL,
        y INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();

    return NextResponse.json({ success: true, message: 'Tables created successfully' });
  } catch (error) {
    console.error('API Init DB Error:', error);
    return NextResponse.json({ success: false, message: 'Error creating tables', error: error.message }, { status: 500 });
  }
}
