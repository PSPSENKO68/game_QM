-- Fix: Cấp quyền cho anon role truy cập các bảng
-- Chạy trong Supabase SQL Editor: https://supabase.com/dashboard/project/ljrapbgnfwuxedceofuz/sql/new

-- Cấp toàn quyền đọc/ghi cho anon trên tất cả bảng
GRANT ALL ON public.users TO anon;
GRANT ALL ON public.quizzes TO anon;
GRANT ALL ON public.questions TO anon;
GRANT ALL ON public.answers TO anon;
GRANT ALL ON public.play_history TO anon;
GRANT ALL ON public.settings TO anon;

-- Cấp tương tự cho authenticated role (phòng sau này nâng cấp)
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.quizzes TO authenticated;
GRANT ALL ON public.questions TO authenticated;
GRANT ALL ON public.answers TO authenticated;
GRANT ALL ON public.play_history TO authenticated;
GRANT ALL ON public.settings TO authenticated;
