import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Login Attempt for user:', body.username);
    const { username, password } = body;

    const client = await pool.connect();
    console.log('DB Connected successfully');

    const result = await client.query(
      'SELECT id, username FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    client.release();
    console.log('Query result length:', result.rows.length);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      return NextResponse.json({ 
        success: true, 
        user: { id: user.id, username: user.username } 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: '用户名或密码错误' 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}
