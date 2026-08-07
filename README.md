# 🏆 Cổng Trò Chơi Quiz Doanh Nghiệp (Game-HRIS)

Hệ thống Quiz nội bộ nâng cao kiến thức doanh nghiệp, tích hợp bảng xếp hạng (Leaderboard) và trang quản trị dành riêng cho việc tổ chức các đợt thi đua, học hỏi nội bộ.

Ứng dụng được xây dựng trên nền tảng Web tĩnh với giao diện hiện đại, tối ưu trải nghiệm người dùng cùng hệ thống cơ sở dữ liệu Supabase mạnh mẽ.

---

## ✨ Tính năng chính

### 👤 Cho người dùng (Employee):
- **Đăng nhập nhanh**: Đăng nhập tiện lợi bằng Mã nhân viên và mã PIN (không cần tạo tài khoản rườm rà).
- **Trải nghiệm chơi game mượt mà**: Giao diện trả lời câu hỏi trực quan, phản hồi đáp án tức thì, đếm ngược thời gian và hiệu ứng chuyển đổi mượt mà.
- **Theo dõi kết quả & Bảng xếp hạng**: Xem điểm số ngay sau khi hoàn thành và theo dõi vị trí của mình trên bảng xếp hạng (Leaderboard) toàn công ty hoặc theo phòng ban.

### 🛠 Cho quản trị viên (Admin & Owner):
- **Quản lý danh sách nhân sự**: Tạo mới, chỉnh sửa thông tin nhân viên hoặc khóa tài khoản trực tiếp từ dashboard.
- **Import/Export dữ liệu dễ dàng**: Upload danh sách nhân sự qua file CSV (`accounts.csv`).
- **Quản lý Ngân hàng Câu hỏi**:
  - Tạo mới và quản lý các đợt Quiz (theo tuần hoặc chủ đề).
  - Tải câu hỏi và đáp án lên hàng loạt bằng file CSV mẫu (`quiz/quiz_mau.csv`).
- **Cấu hình hệ thống**: Đặt giới hạn số lượt chơi tối đa trong ngày của nhân viên.
- **Giám sát kết quả**: Theo dõi trực tiếp điểm số và lượt chơi của từng nhân viên.

---

## 📁 Cấu trúc thư mục dự án

```text
├── index.html           # Trang chủ (Cổng đăng nhập và chọn lượt chơi)
├── login.html           # Trang đăng nhập tài khoản
├── quiz.html            # Giao diện trả lời câu hỏi Quiz
├── result.html          # Trang hiển thị kết quả sau khi hoàn thành
├── leaderboard.html     # Trang bảng xếp hạng nhân viên toàn công ty
├── admin.html           # Trang quản trị (chỉ Admin/Owner có quyền truy cập)
│
├── app.js               # Logic điều khiển trang chủ
├── auth.js              # Xử lý xác thực người dùng
├── quiz.js              # Logic trò chơi, tính thời gian, tính điểm
├── leaderboard.js       # Tải và hiển thị danh sách xếp hạng
├── admin.js             # Toàn bộ logic nghiệp vụ quản trị
├── supabase.js          # Kết nối và thao tác với Supabase API
│
├── style.css            # Custom CSS styles (chứa design system)
├── package.json         # Quản lý thư viện và scripts chạy dự án (Vite)
├── .env.example         # File mẫu cấu hình biến môi trường
├── quiz/                # Thư mục chứa tài nguyên câu hỏi
│   └── quiz_mau.csv     # File CSV mẫu cho câu hỏi quiz
└── supabase/
    └── migrations/      # Các script SQL khởi tạo cơ sở dữ liệu
```

---

## 🗄️ Cấu trúc Cơ sở dữ liệu (Supabase)

Hệ thống sử dụng các bảng chính sau:

1. **`users`**: Lưu trữ thông tin nhân viên (`employee_code`, `full_name`, `department`, `pin`, `role`, `total_score`, `is_active`).
2. **`quizzes`**: Thông tin các kỳ thi Quiz (`title`, `week_no`, `active`).
3. **`questions`**: Danh sách câu hỏi liên kết với từng Quiz.
4. **`answers`**: Các phương án trả lời cho mỗi câu hỏi, đánh dấu phương án đúng (`is_correct`).
5. **`play_history`**: Nhật ký các lượt chơi của nhân viên (`score`, `played_at`).
6. **`settings`**: Lưu trữ cấu hình hệ thống (Ví dụ: `max_plays_per_day`).

---

## 🚀 Hướng dẫn cài đặt và chạy ứng dụng

### 1. Yêu cầu hệ thống
- Máy tính đã cài đặt **Node.js** (Phiên bản 16 trở lên).

### 2. Cài đặt các thư viện phụ thuộc
Mở terminal tại thư mục gốc của dự án và chạy lệnh sau:
```bash
npm install
```

### 3. Cấu hình biến môi trường
- Sao chép file `.env.example` thành file `.env`:
  ```bash
  cp .env.example .env
  ```
- Mở file `.env` mới tạo và điền thông tin Supabase của bạn:
  ```env
  VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
  VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
  ```

### 4. Khởi tạo Cơ sở dữ liệu
- Truy cập vào **SQL Editor** trong giao diện Supabase Project của bạn.
- Copy nội dung trong các file migrations tại thư mục `supabase/migrations/` (bắt đầu từ `001_initial_schema.sql` rồi đến `002_fix_permissions.sql`) dán vào SQL Editor và chạy (Run) để thiết lập cấu trúc bảng & phân quyền.

### 5. Chạy ứng dụng ở môi trường local
Khởi động development server:
```bash
npm run dev
```
Trình duyệt sẽ tự động mở trang web ở địa chỉ mặc định `http://localhost:5173`.
