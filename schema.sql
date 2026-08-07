-- 1. Bảng users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    pin TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    total_score INTEGER DEFAULT 0,
    max_plays INTEGER,
    is_active BOOLEAN DEFAULT true,
    mega_code TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Bảng settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Cấu hình mặc định cho Game Lâm Tặc
INSERT INTO settings (key, value) VALUES 
('max_plays_per_day', '3'),
('max_steals_per_day', '6'),
('module1_status', 'ON'),
('module2_status', 'OFF'),
('steal_win_multiplier', '1'),
('steal_lose_multiplier', '1');

-- 3. Bảng quizzes
CREATE TABLE quizzes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    month_no INTEGER DEFAULT 1,
    week_no INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Bảng questions
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    point INTEGER DEFAULT 10,
    time_limit INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Bảng answers
CREATE TABLE answers (
    id TEXT PRIMARY KEY,
    question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false
);

-- 6. Bảng play_history (Dành cho Chế độ 1)
CREATE TABLE play_history (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    quiz_id TEXT REFERENCES quizzes(id) ON DELETE SET NULL,
    score INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    wrong_answers JSONB,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Bảng steal_history (Dành cho Chế độ 2 - Cướp điểm)
CREATE TABLE steal_history (
    id TEXT PRIMARY KEY,
    attacker_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    defender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    is_success BOOLEAN NOT NULL,
    score_change INTEGER DEFAULT 0,
    attacker_correct_count INTEGER DEFAULT 0,
    attacker_time_spent INTEGER DEFAULT 0,
    defender_correct_count INTEGER DEFAULT 0,
    defender_time_spent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
