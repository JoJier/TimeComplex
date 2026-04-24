import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const client = await pool.connect();
    
    let result;
    if (userId) {
      // Filter by user ID to ensure data isolation
      result = await client.query('SELECT * FROM events WHERE user_id = $1 ORDER BY start_time ASC', [userId]);
    } else {
      // If no user ID provided, return no private events (or could return public ones)
      result = await client.query('SELECT * FROM events WHERE user_id IS NULL ORDER BY start_time ASC');
    }
    
    client.release();
    
    // Map the database fields to the CanvasEvent interface used in the frontend
    const mappedEvents = result.rows.map(row => {
      const getLocalDateString = (dateObj) => {
        if (!dateObj) return '';
        const offset = dateObj.getTimezoneOffset();
        const localDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
      };

      return {
        id: row.id.toString(),
        time: getLocalDateString(row.start_time),
        y: row.y || 400,
        label: row.title,
        color: row.color || "#fbbf24"
      };
    });
    
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
    const values = [label, time, y, color, userId || null];
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

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, time, y, label, color, userId } = body;

    if (!id) {
      return NextResponse.json({ message: 'ID is required for update' }, { status: 400 });
    }

    const client = await pool.connect();
    
    const query = `
      UPDATE events 
      SET title = $1,
          start_time = $2,
          y = $3,
          color = $4,
          user_id = COALESCE($5, user_id)
      WHERE id = $6
    `;
    const values = [label, time, y, color, userId ?? null, id];
    
    await client.query(query, values);
    client.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API PUT Error:', error);
    return NextResponse.json({ message: 'Error updating event' }, { status: 500 });
  }
}
