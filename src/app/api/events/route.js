import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    // Query events from the database
    const result = await client.query('SELECT * FROM events ORDER BY start_time ASC');
    client.release();
    
    // Map the database fields to the CanvasEvent interface used in the frontend
    const mappedEvents = result.rows.map(row => ({
      id: row.id.toString(),
      time: row.start_time ? row.start_time.toISOString().split('T')[0] : '',
      y: row.y || 400,
      label: row.title,
      color: row.color || "#fbbf24"
    }));
    
    return NextResponse.json(mappedEvents);
  } catch (error) {
    console.error('API GET Error:', error);
    return NextResponse.json({ message: 'Error fetching events' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, time, y, label, color, userId } = body;

    const client = await pool.connect();
    
    // Insert new event
    const query = `
      INSERT INTO events (title, start_time, y, color, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [label, time, y, color, userId || 1];
    const result = await client.query(query, values);
    
    client.release();

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id 
    });
  } catch (error) {
    console.error('API POST Error:', error);
    return NextResponse.json({ message: 'Error saving event' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    await client.query('DELETE FROM events WHERE id = $1', [id]);
    client.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API DELETE Error:', error);
    return NextResponse.json({ message: 'Error deleting event' }, { status: 500 });
  }
}
