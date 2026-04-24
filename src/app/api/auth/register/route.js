import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const username = (body.username || '').trim();
    const email = (body.email || '').trim();
    const password = body.password || '';

    // Server-side validation to prevent bypassing frontend checks
    if (!username) {
      return NextResponse.json({ success: false, message: '用户名不能为空' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ success: false, message: '密码不能为空' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, message: '无效的邮箱地址' }, { status: 400 });
    }

    const client = await pool.connect();
    
    // Case-insensitive check to prevent duplicate users like "admin" and "Admin"
    const checkUser = await client.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [username, email]
    );

    if (checkUser.rows.length > 0) {
      client.release();
      return NextResponse.json({ 
        success: false, 
        message: '用户名或邮箱已存在' 
      }, { status: 400 });
    }

    // Hash the password before saving to the database
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await client.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, hashedPassword]
    );
    
    client.release();

    return NextResponse.json({ 
      success: true, 
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Register API Error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}
