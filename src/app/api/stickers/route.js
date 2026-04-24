import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const client = await pool.connect();
    let result;

    if (userId) {
      result = await client.query('SELECT * FROM stickers WHERE user_id = $1 ORDER BY id ASC', [userId]);
    } else {
      result = await client.query('SELECT * FROM stickers WHERE user_id IS NULL ORDER BY id ASC');
    }
    client.release();

    const mappedStickers = result.rows.map(row => ({
      id: row.id.toString(),
      emoji: row.emoji,
      time: row.time,
      y: row.y
    }));

    return NextResponse.json(mappedStickers);
  } catch (error) {
    console.error('Stickers GET Error:', error);
    return NextResponse.json({ message: 'Error fetching stickers' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { emoji, time, y, userId } = body;

    const client = await pool.connect();
    
    const query = `
      INSERT INTO stickers (emoji, time, y, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const values = [emoji, time, y, userId || null];
    const result = await client.query(query, values);
    
    client.release();

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Stickers POST Error:', error);
    return NextResponse.json({ message: 'Error saving sticker' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    const client = await pool.connect();
    await client.query('DELETE FROM stickers WHERE id = $1', [id]);
    client.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Stickers DELETE Error:', error);
    return NextResponse.json({ message: 'Error deleting sticker' }, { status: 500 });
  }
}
