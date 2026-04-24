import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const username = (body.username || '').trim();
    const password = body.password || '';

    if (!username || !password) {
      return NextResponse.json({ success: false, message: '用户名或密码不能为空' }, { status: 400 });
    }

    console.log('Login Attempt for user:', username);

    const client = await pool.connect();
    
    // Fetch the user by case-insensitive username to get their hashed password
    const result = await client.query(
      'SELECT id, username, password FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    client.release();

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // Compare the provided plaintext password with the hashed password from the DB
      // Fallback check for legacy plaintext passwords (if any exist) to ensure older accounts still work
      let isMatch = false;
      if (user.password && user.password.startsWith('$2')) {
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        // Legacy plaintext comparison (Not recommended for production, but prevents locking out existing dev accounts)
        isMatch = password === user.password;
      }

      if (isMatch) {
        return NextResponse.json({ 
          success: true, 
          user: { id: user.id, username: user.username } 
        });
      }
    }
    
    // If no user found or password doesn't match
    return NextResponse.json({ 
      success: false, 
      message: '用户名或密码错误' 
    }, { status: 401 });
    
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}
