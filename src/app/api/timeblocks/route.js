import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const client = await pool.connect();
    let result;

    if (userId) {
      result = await client.query('SELECT * FROM timeblocks WHERE user_id = $1 ORDER BY start_time ASC', [userId]);
    } else {
      result = await client.query('SELECT * FROM timeblocks WHERE user_id IS NULL ORDER BY start_time ASC');
    }
    client.release();

    const mappedBlocks = result.rows.map(row => {
      // Fix timezone offset issues when converting Date to string
      const getLocalDateString = (dateObj) => {
        if (!dateObj) return '';
        const offset = dateObj.getTimezoneOffset();
        const localDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
      };

      return {
        id: row.id.toString(),
        startTime: getLocalDateString(row.start_time),
        endTime: getLocalDateString(row.end_time),
        y: row.y || 400,
        label: row.title,
        color: row.color || "#fbbf24",
        category: row.category || "其他"
      };
    });

    return NextResponse.json(mappedBlocks);
  } catch (error) {
    console.error('TimeBlocks GET Error:', error);
    return NextResponse.json({ message: 'Error fetching timeblocks', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { startTime, endTime, y, label, color, category, userId } = body;

    const client = await pool.connect();
    
    // Convert YYYY-MM-DD string to valid Date object/timestamp for PostgreSQL
    // Sometimes string dates might cause parsing issues if they are not formatted properly, 
    // but PostgreSQL usually handles 'YYYY-MM-DD' well. Let's ensure it's robust.
    const query = `
      INSERT INTO timeblocks (title, start_time, end_time, y, color, category, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const values = [label, startTime, endTime, y, color, category, userId || null];
    const result = await client.query(query, values);
    
    client.release();

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('TimeBlocks POST Error:', error);
    return NextResponse.json({ message: 'Error saving timeblock', error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  let client;
  try {
    const body = await request.json();
    const { id, startTime, endTime, label, color, category } = body;

    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    if (!/^\d+$/.test(String(id))) {
      return NextResponse.json({ message: 'Invalid timeblock ID' }, { status: 400 });
    }

    client = await pool.connect();
    const query = `
      UPDATE timeblocks
      SET title = $1, start_time = $2, end_time = $3, color = $4, category = $5
      WHERE id = $6
    `;
    const values = [label, startTime, endTime, color, category, id];
    await client.query(query, values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('TimeBlocks PUT Error:', error);
    return NextResponse.json({ message: 'Error updating timeblock', error: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const client = await pool.connect();
    await client.query('DELETE FROM timeblocks WHERE id = $1', [id]);
    client.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('TimeBlocks DELETE Error:', error);
    return NextResponse.json({ message: 'Error deleting timeblock' }, { status: 500 });
  }
}
