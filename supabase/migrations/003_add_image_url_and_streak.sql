-- Thêm cột is_compensation và streak_day vào bảng quizzes
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_compensation BOOLEAN DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS streak_day INTEGER DEFAULT NULL;

-- Sửa lại các quiz cũ: nếu streak_day = 1 mà không phải quiz giữ chuỗi thì set về NULL
-- (Quiz giữ chuỗi sẽ được tạo với streak_day cụ thể qua admin)

-- Thêm cột image_url vào bảng questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Thêm cấu hình streak_game_mode vào bảng settings
INSERT INTO settings (key, value) VALUES ('streak_game_mode', 'OFF') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('max_streak_days', '5') ON CONFLICT (key) DO NOTHING;
