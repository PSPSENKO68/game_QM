-- Game HRIS - Supabase Database Schema
-- Run this once in Supabase SQL Editor to create all tables

-- 1. Bảng Users (Nhân viên)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT 'u_' || extract(epoch from now())::text,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT DEFAULT '',
    pin TEXT NOT NULL,
    total_score INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    role TEXT DEFAULT 'user', -- 'owner', 'admin', 'user'
    max_plays INT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Bảng Quizzes (Đề kiểm tra)
CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY DEFAULT 'q_' || extract(epoch from now())::text,
    title TEXT NOT NULL,
    week_no INT NOT NULL,
    active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. Bảng Questions (Câu hỏi)
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY DEFAULT 'qn_' || extract(epoch from now())::text,
    quiz_id TEXT REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL
);

-- 4. Bảng Answers (Đáp án)
CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY DEFAULT 'a_' || extract(epoch from now())::text,
    question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false
);

-- 5. Bảng Lịch sử chơi game (Play History)
CREATE TABLE IF NOT EXISTS play_history (
    id TEXT PRIMARY KEY DEFAULT 'h_' || extract(epoch from now())::text,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    quiz_id TEXT REFERENCES quizzes(id) ON DELETE CASCADE,
    score INT NOT NULL DEFAULT 0,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 6. Bảng Cấu hình hệ thống (Settings)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Cài đặt mặc định: Giới hạn 3 lượt chơi/ngày
INSERT INTO settings (key, value) VALUES ('max_plays_per_day', '3')
ON CONFLICT (key) DO NOTHING;

-- Tạo tài khoản Admin tối cao mặc định
INSERT INTO users (id, employee_code, full_name, department, pin, role, is_active)
VALUES ('u_superadmin', 'nduy6374@gmail.com', 'Super Admin', 'Ban Giám Đốc', 'thisistheSuperAdmin', 'owner', true)
ON CONFLICT (employee_code) DO NOTHING;

-- Enable Row Level Security (cho phép đọc ghi từ client)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: Cho phép anonymous key đọc/ghi (vì app dùng anon key)
CREATE POLICY "Allow all for anon" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON quizzes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON questions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON answers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON play_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON settings FOR ALL TO anon USING (true) WITH CHECK (true);
