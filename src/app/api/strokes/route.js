import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const client = await pool.connect();
    let result;

    if (userId) {
      result = await client.query('SELECT * FROM strokes WHERE user_id = $1 ORDER BY id ASC', [userId]);
    } else {
      result = await client.query('SELECT * FROM strokes WHERE user_id IS NULL ORDER BY id ASC');
    }
    client.release();

    const mappedStrokes = result.rows.map(row => ({
      id: row.id.toString(),
      color: row.color,
      width: row.width,
      points: row.points // Already stored as JSONB
    }));

    return NextResponse.json(mappedStrokes);
  } catch (error) {
    console.error('Strokes GET Error:', error);
    return NextResponse.json({ message: 'Error fetching strokes' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { color, width, points, userId } = body;

    const client = await pool.connect();
    
    const query = `
      INSERT INTO strokes (color, width, points, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    // points is an array of objects, passed directly into JSONB
    const values = [color, width, JSON.stringify(points), userId || null];
    const result = await client.query(query, values);
    
    client.release();

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Strokes POST Error:', error);
    return NextResponse.json({ message: 'Error saving stroke' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const client = await pool.connect();
    await client.query('DELETE FROM strokes WHERE id = $1', [id]);
    client.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Strokes DELETE Error:', error);
    return NextResponse.json({ message: 'Error deleting stroke' }, { status: 500 });
  }
}
