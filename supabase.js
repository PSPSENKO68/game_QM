/**
 * Game HRIS — Supabase Database Module
 * Tất cả thao tác CRUD đều kết nối thẳng đến Supabase.
 * localStorage chỉ dùng để cache session hiện tại.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Thiếu biến môi trường VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Bootstrap: Tạo tài khoản Super Admin nếu chưa tồn tại ─────────────────
// Chạy 1 lần duy nhất khi app khởi động. Admin không cần làm gì thêm.
export async function bootstrapDatabase() {
  try {
    // Kiểm tra xem bảng users có tồn tại chưa (nếu SQL chưa chạy sẽ báo lỗi)
    const { error: tableErr } = await supabase.from('users').select('id').limit(1);
    if (tableErr) {
      console.error('❌ Bảng users chưa tồn tại. Vui lòng chạy SQL schema trong Supabase Dashboard.', tableErr.message);
      return { success: false, reason: 'table_missing' };
    }

    // Tạo Super Admin bằng số điện thoại người dùng yêu cầu
    const { data: existingAdmin } = await supabase.from('users').select('id').or('phone_number.eq.0337411036,employee_code.eq.ADMIN999').limit(1);
    if (!existingAdmin || existingAdmin.length === 0) {
      await supabase.from('users').insert({
        id: genId('u'),
        employee_code: 'ADMIN999',
        full_name: 'Trạm Trưởng',
        phone_number: '0337411036',
        department: 'Ban Giám Đốc',
        pin: '99999',
        role: 'owner',
        is_active: true
      });
    } else {
       // Đảm bảo số điện thoại, PIN và role được cập nhật cho tài khoản này
       await supabase.from('users').update({ 
         employee_code: 'ADMIN999',
         phone_number: '0337411036', 
         pin: '99999',
         role: 'owner' 
       }).eq('id', existingAdmin[0].id);
    }

    // Seed cấu hình mặc định
    await supabase.from('settings').upsert({ key: 'max_plays_per_day', value: '3' }, { onConflict: 'key' });
    await supabase.from('settings').upsert({ key: 'randomize_questions', value: 'OFF' }, { onConflict: 'key' });
    await supabase.from('settings').upsert({ key: 'wheel_status', value: 'OFF' }, { onConflict: 'key' });
    await supabase.from('settings').upsert({ key: 'max_streak_days', value: '5' }, { onConflict: 'key' });

    console.log('✅ Đã khởi tạo Super Admin thành công!');
    return { success: true, reason: 'created' };
  } catch (err) {
    console.error('Bootstrap error:', err);
    return { success: false, reason: err.message };
  }
}


function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Helper: Parse CSV text → Array of objects ───────────────────────────────
export function parseCSV(text) {
  // Tự động nhận diện delimiter: tab, phẩy, chấm phẩy
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] !== undefined ? values[idx] : '';
    });
    result.push(obj);
  }
  return result;
}

// ─── Helper: Parse XLSX ArrayBuffer → Array of objects ───────────────────────
function parseXLSX(arrayBuffer) {
  if (!window.XLSX) throw new Error('SheetJS (XLSX) chưa được tải.');
  const workbook = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return window.XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}

// ─── Helper: Format time spent (ms or s) to decimal string (e.g. 14.285s) ───
export function formatTimeSpent(val) {
  if (val === null || val === undefined || isNaN(val)) return "0s000'";
  const num = Number(val);
  if (num <= 0) return "0s000'";
  let seconds = num;
  if (num >= 999999000) return 'Chưa có';
  if (Number.isInteger(num) && num < 500) {
    seconds = num;
  } else if (num >= 500) {
    seconds = num / 1000;
  }
  
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    // Tính mili-giây, làm tròn để tránh sai số dấu phẩy động
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
    return `${m}p${s}s${ms.toString().padStart(3, '0')}'`;
  }

  const str = seconds.toFixed(3);
  const parts = str.split('.');
  return `${parts[0]}s${parts[1]}'`;
}

// ─── Export accounts.csv ─────────────────────────────────────────────────────
export async function exportAccountsAsCSV() {
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Export accounts error:', error);
    return;
  }

  const rows = ['employee_code,full_name,department,pin,role,is_active,max_plays'];
  (users || []).forEach(u => {
    const maxPlays = u.max_plays !== null && u.max_plays !== undefined ? u.max_plays : '';
    rows.push(`"${u.employee_code}","${u.full_name}","${u.department}","${u.pin}","${u.role}","${u.is_active}",${maxPlays}`);
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', 'accounts.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─── Main Database API ────────────────────────────────────────────────────────
export const db = {
  formatTimeSpent,


  // ── 1. AUTH ──────────────────────────────────────────────────────────────
  async login(phoneOrCode, pin) {
    const code = (phoneOrCode || '').trim();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`phone_number.eq.${code},employee_code.eq.${code}`)
      .single();

    if (error || !data) {
      return { success: false, message: 'Tài khoản không tồn tại trong hệ thống.' };
    }
    if (data.pin !== pin.trim()) {
      return { success: false, message: 'Mật khẩu / Mã PIN không đúng.' };
    }
    if (!data.is_active) {
      return { success: false, message: 'Tài khoản đã bị khóa hoặc chưa kích hoạt.' };
    }
    return { success: true, user: data };
  },

  async quickLogin(fullName, department = 'Khách') {
    const name = fullName.trim();
    const dept = department.trim();
    // Try to find if this name already exists (case-insensitive)
    const { data: existingUsers, error: searchError } = await supabase
      .from('users')
      .select('*')
      .ilike('full_name', name)
      .limit(1);
    
    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0];
      if (!user.is_active) {
        return { success: false, message: 'Tài khoản đã bị khóa.' };
      }
      
      // Update department if it changed
      if (user.department !== dept) {
        await supabase.from('users').update({ department: dept }).eq('id', user.id);
        user.department = dept;
      }
      
      return { success: true, user };
    }

    // Doesn't exist, create it!
    const pseudoId = Date.now().toString().slice(-6) + Math.floor(Math.random()*1000);
    const guestPhone = `GUEST_${pseudoId}`;
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: genId('usr'),
        phone_number: guestPhone,
        employee_code: guestPhone,
        full_name: name,
        department: dept,
        pin: '0000',
        role: 'user',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: 'Lỗi tạo tài khoản nhanh: ' + error.message };
    }
    return { success: true, user: data };
  },

  async register({ fullName, phone, dept, pin }) {
    const p = (phone || '').trim();
    // Check if phone exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', p)
      .single();

    if (existingUser) {
      return { success: false, message: 'Số điện thoại này đã được đăng ký.' };
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: genId('usr'),
        phone_number: p,
        employee_code: p,
        full_name: fullName.trim(),
        department: dept.trim(),
        pin: pin.trim(),
        role: 'user',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: 'Lỗi tạo tài khoản: ' + error.message };
    }
    return { success: true, user: data };
  },

  async getUserById(id) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return data || null;
  },

  async generateMegaCode(userId) {
    const { data: user } = await supabase.from('users').select('mega_code').eq('id', userId).single();
    if (user && user.mega_code) return user.mega_code;

    const { data: users } = await supabase.from('users').select('mega_code').not('mega_code', 'is', null);
    const usedCodes = new Set((users || []).map(u => u.mega_code));

    let code = null;
    for (let i = 0; i < 1000; i++) {
      const num = Math.floor(Math.random() * 200) + 1;
      const strNum = String(num).padStart(3, '0');
      if (!usedCodes.has(strNum)) {
        code = strNum;
        break;
      }
    }

    if (code) {
      await supabase.from('users').update({ mega_code: code }).eq('id', userId);
      return code;
    }
    return null;
  },

  // ── 2. KIỂM TRA NGÀY / LƯỢT CHƠI ────────────────────────────────────────
  isSunday() {
    return new Date().getDay() === 0;
  },

  async getCurrentCycleBounds() {
    const cycleStartStr = await this.getSettingValue('mode1_cycle_start') || new Date().toISOString();
    const cycleStart = new Date(cycleStartStr);
    
    let cycleDays = parseInt(await this.getSettingValue('mode1_cycle_days'));
    if (isNaN(cycleDays) || cycleDays < 1) cycleDays = 1;
    
    const now = new Date();
    const msDiff = now.getTime() - cycleStart.getTime();
    const cycleMs = cycleDays * 24 * 60 * 60 * 1000;
    
    let cycleIndex = 0;
    if (msDiff > 0) {
      cycleIndex = Math.floor(msDiff / cycleMs);
    }
    
    const currentCycleStart = new Date(cycleStart.getTime() + (cycleIndex * cycleMs));
    const currentCycleEnd = new Date(currentCycleStart.getTime() + cycleMs - 1);
    
    return { start: currentCycleStart.toISOString(), end: currentCycleEnd.toISOString() };
  },

  async getPlaysInCurrentCycle(userId) {
    const bounds = await this.getCurrentCycleBounds();

    const { count, error } = await supabase
      .from('play_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('played_at', bounds.start)
      .lte('played_at', bounds.end);

    if (error) {
      console.error('getPlaysInCurrentCycle error:', error);
      return 0;
    }
    return count || 0;
  },

  async getCycleLimit() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'mode1_max_plays')
      .single();
    if (!error && data) return parseInt(data.value) || 3;
    return 3;
  },

  async updateDailyLimit(newLimit) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'max_plays_per_day', value: String(parseInt(newLimit) || 3) });
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async getSettingValue(key) {
    const { data, error } = await supabase.from('settings').select('value').eq('key', key).limit(1);
    if (!error && data && data.length > 0) return data[0].value;
    return null;
  },

  async getSettingStatus(key) {
    const val = await this.getSettingValue(key);
    return val === 'ON';
  },

  async updateSettingStatus(key, statusStr) {
    const { error } = await supabase.from('settings').upsert({ key, value: statusStr }, { onConflict: 'key' });
    if (error) {
      console.error('Lỗi khi lưu cài đặt:', error);
      return { success: false, message: error.message };
    }
    return { success: true };
  },

  async getTutorialVideoUrl() {
    return await this.getSettingValue('tutorial_video_url');
  },
  
  async updateTutorialVideoUrl(url) {
    return await this.updateSettingStatus('tutorial_video_url', url);
  },

  async getModule1Status() { return this.getSettingStatus('module1_status'); },
  async updateModule1Status(statusStr) { return this.updateSettingStatus('module1_status', statusStr); },

  async getModule2Status() { return this.getSettingStatus('module2_status'); },
  async updateModule2Status(statusStr) { return this.updateSettingStatus('module2_status', statusStr); },

  async getRandomizeQuestionsStatus() { return this.getSettingStatus('randomize_questions'); },
  async updateRandomizeQuestionsStatus(statusStr) { return this.updateSettingStatus('randomize_questions', statusStr); },

  async getWheelStatus() { return this.getSettingStatus('wheel_status'); },
  async updateWheelStatus(statusStr) { return this.updateSettingStatus('wheel_status', statusStr); },

  async getActiveStreakQuiz() {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('active', true)
      .not('streak_day', 'is', null)
      .order('streak_day', { ascending: true })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0];
  },

  async getStreakGameMode() {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'streak_game_mode').single();
    if (!error && data) return data.value === 'ON';
    return false;
  },

  async updateStreakGameMode(statusStr) {
    const { error } = await supabase.from('settings').upsert({ key: 'streak_game_mode', value: statusStr });
    return { success: !error, message: error?.message };
  },

  async getStealMultipliers() {
    const { data, error } = await supabase.from('settings').select('*').in('key', ['steal_win_multiplier', 'steal_lose_multiplier']);
    let win = 1.0, lose = 1.0;
    if (!error && data) {
      data.forEach(d => {
        if (d.key === 'steal_win_multiplier') win = parseFloat(d.value) || 1.0;
        if (d.key === 'steal_lose_multiplier') lose = parseFloat(d.value) || 1.0;
      });
    }
    return { win, lose };
  },

  async updateStealMultipliers(winVal, loseVal) {
    await supabase.from('settings').upsert({ key: 'steal_win_multiplier', value: winVal.toString() });
    await supabase.from('settings').upsert({ key: 'steal_lose_multiplier', value: loseVal.toString() });
    return { success: true };
  },

  async getStealBasePoints() {
    const { data: winData } = await supabase.from('settings').select('value').eq('key', 'steal_win_base').single();
    const { data: loseData } = await supabase.from('settings').select('value').eq('key', 'steal_lose_base').single();
    
    return {
      win: winData ? parseFloat(winData.value) : 20,
      lose: loseData ? parseFloat(loseData.value) : 10
    };
  },

  async updateStealBasePoints(winVal, loseVal) {
    await supabase.from('settings').upsert({ key: 'steal_win_base', value: winVal.toString() });
    await supabase.from('settings').upsert({ key: 'steal_lose_base', value: loseVal.toString() });
    return { success: true };
  },

  async getMaxStealsPerDay() {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'max_steals_per_day').single();
    if (!error && data) return parseInt(data.value) || 3;
    return 3;
  },

  async updateMaxStealsPerDay(limit) {
    const { error } = await supabase.from('settings').upsert({ key: 'max_steals_per_day', value: String(parseInt(limit) || 3) });
    return { success: !error, message: error?.message };
  },

  async getMaxStreakDays() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'max_streak_days');
    console.log('[getMaxStreakDays] data:', data, 'error:', error);
    if (!error && data && data.length > 0) return parseInt(data[0].value) || 5;
    return 5;
  },

  async updateMaxStreakDays(limit) {
    const val = String(parseInt(limit) || 5);
    console.log('[updateMaxStreakDays] saving:', val);
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'max_streak_days', value: val });
    console.log('[updateMaxStreakDays] result error:', error);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async getStealsToday(userId) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const { count, error } = await supabase
      .from('steal_history')
      .select('*', { count: 'exact', head: true })
      .eq('attacker_id', userId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());
    if (error) { console.error('getStealsToday error:', error); return 0; }
    return count || 0;
  },

  async hasStolenFromUserToday(attackerId, defenderId) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const { count, error } = await supabase
      .from('steal_history')
      .select('*', { count: 'exact', head: true })
      .eq('attacker_id', attackerId)
      .eq('defender_id', defenderId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());
    return (count || 0) > 0;
  },

  async getDefenseHistory(userId) {
    const { data, error } = await supabase
      .from('steal_history')
      .select(`
        id, created_at, is_success, attacker_correct_count, attacker_time_spent, defender_correct_count, defender_time_spent,
        attacker:users!steal_history_attacker_id_fkey ( full_name, department, mega_code )
      `)
      .eq('defender_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getDefenseHistory error:', error);
      return [];
    }
    return data || [];
  },

  // ── 3. QUIZ & CÂU HỎI ───────────────────────────────────────────────────
  async getActiveQuiz(isStreak = false) {
    let query = supabase.from('quizzes').select('*').eq('active', true);
    if (isStreak) {
      query = query.not('streak_day', 'is', null);
    } else {
      query = query.is('streak_day', null);
    }
    const { data, error } = await query.limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0];
  },

  async getQuizQuestions(quizId) {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId);

    if (error || !questions || questions.length === 0) return [];

    const enriched = [];
    for (const q of questions) {
      const { data: answers } = await supabase
        .from('answers')
        .select('*')
        .eq('question_id', q.id);
      enriched.push({ ...q, answers: answers || [] });
    }
    return enriched;
  },

  // ── 4. LƯU KẾT QUẢ CHƠI ────────────────────────────────────────────────
  async savePlayRecord(userId, quizId, score, correctCount = 0, wrongCount = 0, timeSpent = 0, wrongAnswers = [], mode = 1, stealTargetId = null) {
    if (mode === 2 && stealTargetId) {
      // Chế độ thách đấu
      const result = await db.executeSteal(userId, stealTargetId, correctCount, timeSpent, quizId);
      if (result && result.success) {
        return { 
          success: true, 
          isWin: result.isWin, 
          winPoints: result.winPoints, 
          losePoints: result.losePoints,
          defCorrect: result.defCorrect,
          defTime: result.defTime,
          atkCorrect: result.atkCorrect,
          atkTime: result.atkTime
        };
      }
      return { success: false, message: result?.message || 'Lỗi thách đấu' };
    }

    const newScore = parseInt(score) || 0;

    const record = {
      id: genId('h'),
      user_id: userId,
      quiz_id: quizId,
      score: newScore,
      played_at: new Date().toISOString(),
      correct_count: correctCount,
      wrong_count: wrongCount,
      time_spent: timeSpent,
      wrong_answers: wrongAnswers
    };

    // Parallelize independent operations
    const [insertResult, userDataRes, bounds] = await Promise.all([
      supabase.from('play_history').insert(record),
      mode !== 'streak' ? supabase.from('users').select('total_score, recoverable_points').eq('id', userId).single() : Promise.resolve({data: null}),
      mode !== 'streak' ? this.getCurrentCycleBounds() : Promise.resolve(null)
    ]);

    if (insertResult.error) {
      console.error('savePlayRecord error:', insertResult.error);
      return { success: false };
    }

    if (mode !== 'streak') {
      const userData = userDataRes.data;
      let currentTotal = parseInt(userData?.total_score) || 0;
      
      // Lấy danh sách điểm các lượt chơi của BỘ ĐỀ NÀY trong chu kỳ này, trừ lượt vừa lưu
      const { data: cyclePlays } = await supabase
        .from('play_history')
        .select('score')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .gte('played_at', bounds.start)
        .lte('played_at', bounds.end)
        .neq('id', record.id);
        
      let oldMaxInCycle = 0;
      if (cyclePlays && cyclePlays.length > 0) {
        oldMaxInCycle = Math.max(...cyclePlays.map(p => parseInt(p.score) || 0));
      }
      
      let scoreUpdates = {};
      let totalChanged = false;

      // 1. Nếu điểm <= 0 (bằng 0 hoặc âm), cày cuốc lại sẽ được reset bằng chính điểm đạt được
      if (currentTotal <= 0 && newScore > 0) {
        currentTotal = newScore;
        totalChanged = true;
      } 
      // 2. Nếu điểm đang dương, áp dụng luật chỉ lấy điểm cao nhất trong chu kỳ
      else if (newScore > oldMaxInCycle) {
        const diff = newScore - oldMaxInCycle;
        currentTotal += diff;
        totalChanged = true;
      }

      if (totalChanged) {
        scoreUpdates.total_score = currentTotal;
        await supabase.from('users').update(scoreUpdates).eq('id', userId);
      }
    }

    return { success: true };
  },

  async getBestPlayToday(userId, quizId = null) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    
    let query = supabase
      .from('play_history')
      .select('score, correct_count, time_spent')
      .eq('user_id', userId)
      .gte('played_at', todayStart.toISOString())
      .lte('played_at', todayEnd.toISOString());

    if (quizId) {
      query = query.eq('quiz_id', quizId);
    }

    const { data, error } = await query
      .order('correct_count', { ascending: false })
      .order('time_spent', { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0];
  },

  async getBestPlayOverall(userId) {
    const { data, error } = await supabase
      .from('play_history')
      .select('score, correct_count, wrong_count, time_spent')
      .eq('user_id', userId)
      .order('score', { ascending: false })
      .order('correct_count', { ascending: false })
      .order('time_spent', { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0];
  },

  async executeSteal(attackerId, defenderId, attackerCorrectCount, attackerTimeSpent, quizId = null) {
    // Parallelize all checks and data fetching
    const [
      hasStolen, 
      maxSteals, 
      stealsToday, 
      defenderBest,
      multipliers,
      basePoints,
      usersRes
    ] = await Promise.all([
      db.hasStolenFromUserToday(attackerId, defenderId),
      db.getMaxStealsPerDay(),
      db.getStealsToday(attackerId),
      db.getBestPlayToday(defenderId, quizId),
      db.getStealMultipliers(),
      db.getStealBasePoints(),
      supabase.from('users').select('id, total_score, has_shield, recoverable_points').in('id', [attackerId, defenderId])
    ]);

    if (hasStolen) return { success: false, message: 'Bạn đã thách đấu người này hôm nay rồi.' };
    if (stealsToday >= maxSteals) return { success: false, message: 'Bạn đã hết lượt thách đấu hôm nay.' };

    const defCorrect = defenderBest ? parseInt(defenderBest.correct_count) || 0 : 0;
    const rawDefTime = defenderBest ? parseFloat(defenderBest.time_spent) || 999999999 : 999999999;
    
    const atkCorrect = parseInt(attackerCorrectCount) || 0;
    const rawAtkTime = parseFloat(attackerTimeSpent) || 0;

    // Chuẩn hóa về mili-giây nếu dữ liệu cũ lưu bằng giây (< 500)
    const defTime = (rawDefTime < 500) ? rawDefTime * 1000 : rawDefTime;
    const atkTime = (rawAtkTime < 500) ? rawAtkTime * 1000 : rawAtkTime;

    let isSuccess = false;
    if (atkCorrect > 0) { // Phải đúng ít nhất 1 câu mới được tính là thắng
      if (atkCorrect > defCorrect) {
        isSuccess = true;
      } else if (atkCorrect === defCorrect) {
        if (atkTime <= defTime) isSuccess = true;
      }
    }

    const usersData = usersRes.data || [];
    const attackerData = usersData.find(u => u.id === attackerId);
    const defenderData = usersData.find(u => u.id === defenderId);

    const attackerTotal = parseInt(attackerData?.total_score) || 0;
    const defenderTotal = parseInt(defenderData?.total_score) || 0;
    
    const attackerRecov = parseInt(attackerData?.recoverable_points) || 0;
    const defenderRecov = parseInt(defenderData?.recoverable_points) || 0;

    const winPoints = Math.round(basePoints.win * multipliers.win);
    const losePoints = Math.round(basePoints.lose * multipliers.lose);

    let shieldUsed = false;
    const updatePromises = [];

    // Lưu lịch sử thách đấu
    updatePromises.push(supabase.from('steal_history').insert({
      id: genId('st'),
      attacker_id: attackerId,
      defender_id: defenderId,
      is_success: isSuccess,
      attacker_correct_count: attackerCorrectCount,
      attacker_time_spent: atkTime,
      defender_correct_count: defCorrect,
      defender_time_spent: defTime
    }));

    if (isSuccess) {
      // Attacker wins
      updatePromises.push(supabase.from('users').update({ total_score: attackerTotal + winPoints }).eq('id', attackerId));
      
      if (defenderData?.has_shield) {
        shieldUsed = true;
        updatePromises.push(supabase.from('users').update({ has_shield: false }).eq('id', defenderId));
      } else {
        updatePromises.push(supabase.from('users').update({ 
          total_score: defenderTotal - winPoints,
          recoverable_points: defenderRecov + winPoints
        }).eq('id', defenderId));
      }
    } else {
      // Attacker loses
      updatePromises.push(supabase.from('users').update({ 
        total_score: attackerTotal - losePoints,
        recoverable_points: attackerRecov + losePoints
      }).eq('id', attackerId));
      updatePromises.push(supabase.from('users').update({ total_score: defenderTotal + losePoints }).eq('id', defenderId));
    }

    const updateResults = await Promise.all(updatePromises);
    const err = updateResults.find(r => r.error);
    if (err) return { success: false, message: err.error.message };

    return { success: true, isWin: isSuccess, defCorrect, defTime, atkCorrect, atkTime, winPoints, losePoints, shieldUsed };
  },

  // ── 5. LEADERBOARD ──────────────────────────────────────────────────────
  async getLeaderboard() {
    const { data, error } = await supabase
      .from('users')
      .select('id, employee_code, full_name, department, total_score, role, mega_code, created_at')
      .eq('is_active', true)
      .neq('role', 'owner')
      .order('total_score', { ascending: false });

    if (error) {
      console.error('getLeaderboard error:', error);
      return [];
    }

    if (data && data.length > 0) {
      // Lấy thêm best_time của từng user trong chu kỳ hiện tại
      const bounds = await this.getCurrentCycleBounds();
      
      const { data: playsData } = await supabase
        .from('play_history')
        .select('user_id, correct_count, time_spent, played_at')
        .gte('played_at', bounds.start)
        .lte('played_at', bounds.end);

      const { data: stealsData } = await supabase
        .from('steal_history')
        .select('attacker_id, created_at')
        .gte('created_at', bounds.start)
        .lte('created_at', bounds.end);

      // Calculate earliest participation time for Tie-breaker 3 first
      const userEarliestTime = {};
      if (playsData) {
        playsData.forEach(p => {
          const t = new Date(p.played_at).getTime();
          if (!userEarliestTime[p.user_id] || t < userEarliestTime[p.user_id]) userEarliestTime[p.user_id] = t;
        });
      }
      if (stealsData) {
        stealsData.forEach(s => {
          const t = new Date(s.created_at).getTime();
          if (!userEarliestTime[s.attacker_id] || t < userEarliestTime[s.attacker_id]) userEarliestTime[s.attacker_id] = t;
        });
      }

      if (playsData && playsData.length > 0) {
        const userBestPlays = {};
        let maxValidTime = 0;
        playsData.forEach(play => {
          const uid = play.user_id;
          const playTime = parseFloat(play.time_spent) || 0;
          
          if (!userBestPlays[uid]) {
            userBestPlays[uid] = play;
          } else {
            const currTime = parseFloat(userBestPlays[uid].time_spent) || 0;
            
            if (currTime === 0 || currTime >= 999999000) {
              userBestPlays[uid] = play;
            } else if (playTime > 0 && playTime < currTime) {
              userBestPlays[uid] = play;
            }
          }
        });
        
        // Find the absolute worst time
        Object.values(userBestPlays).forEach(play => {
          if (play.time_spent > maxValidTime) {
            maxValidTime = play.time_spent;
          }
        });
        
        data.forEach(u => {
          const best = userBestPlays[u.id];
          if (best) {
            u.best_time = best.time_spent;
            u.best_correct = best.correct_count;
            u.has_participated = true;
          } else {
            const hasParticipated = !!userEarliestTime[u.id];
            u.has_participated = hasParticipated;
            if (hasParticipated) {
              u.best_time = maxValidTime > 0 ? maxValidTime : 999999999;
            } else {
              u.best_time = 999999999;
            }
            u.best_correct = 0;
          }
        });
      } else {
        data.forEach(u => {
          const hasParticipated = !!userEarliestTime[u.id];
          u.has_participated = hasParticipated;
          // Even if no playsData, maxValidTime is 0, so time is 999999999 anyway
          u.best_time = 999999999;
          u.best_correct = 0;
        });
      }
      
      // Sort here before closing the outer if block
      data.sort((a, b) => {
        const scoreA = parseFloat(a.total_score) || 0;
        const scoreB = parseFloat(b.total_score) || 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        const timeA = parseFloat(a.best_time) || 999999999;
        const timeB = parseFloat(b.best_time) || 999999999;
        
        if (timeA < timeB) return -1;
        if (timeA > timeB) return 1;
        
        // Tie-breaker 3: Ai bắt đầu chơi (cày cuốc/thách đấu) sớm hơn thì xếp trên
        // Fallback về created_at của tài khoản nếu họ chưa chơi gì cả
        const dateA = userEarliestTime[a.id] || new Date(a.created_at || 0).getTime();
        const dateB = userEarliestTime[b.id] || new Date(b.created_at || 0).getTime();
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        
        // Tie-breaker 4: Alphabetical by name
        const nameA = (a.full_name || '').trim().toLowerCase();
        const nameB = (b.full_name || '').trim().toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        return 0;
      });
    } // End of if (data && data.length > 0)

    return data || [];
  },

  async updateUserWheelResult(userId, prizeType, bonusPoints = 0) {
    const { data: user } = await supabase.from('users').select('total_score, has_spun_wheel').eq('id', userId).single();
    if (!user) return { success: false, message: 'User not found' };
    if (user.has_spun_wheel) return { success: false, message: 'Bạn đã quay vòng quay rồi!' };

    const updates = { has_spun_wheel: true };
    if (prizeType === 'SHIELD') {
      updates.has_shield = true;
    } else if (prizeType === 'POINTS') {
      updates.total_score = (parseInt(user.total_score) || 0) + bonusPoints;
    }

    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) return { success: false, message: error.message };
    return { success: true, newScore: updates.total_score };
  },

  async getUserRank(userId) {
    const leaderboard = await this.getLeaderboard();
    if (!leaderboard || leaderboard.length === 0) return null;
    
    // Tìm vị trí của user trong danh sách đã sắp xếp (bao gồm cả điểm và thời gian)
    const rank = leaderboard.findIndex(u => u.id === userId);
    if (rank < 0) return null; // Không có hạng

    // Không dùng firstWithSameScore nữa vì giờ đã tính cả thời gian
    // Hạng chính là index + 1
    return rank + 1;
  },

  // ── 6. ADMIN: DASHBOARD ─────────────────────────────────────────────────
  async adminGetUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('adminGetUsers error:', error);
      return [];
    }
    return data || [];
  },

  async adminGetAggregatedScores() {
    const users = await db.adminGetUsers();
    const quizzes = await db.adminGetQuizzes();

    const { data: playHistory } = await supabase.from('play_history').select('*');
    const history = playHistory || [];

    const activeQuiz = await db.getActiveQuiz();
    const currentWeekNo = activeQuiz ? activeQuiz.week_no : null;
    const currentWeekQuizIds = quizzes.filter(q => q.week_no === currentWeekNo).map(q => q.id);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3);

    return users.map(user => {
      const userHistory = history.filter(h => h.user_id === user.id);
      let weekScore = 0, monthScore = 0, quarterScore = 0;

      userHistory.forEach(h => {
        const val = parseInt(h.score) || 0;
        const d = new Date(h.played_at);
        if (currentWeekQuizIds.includes(h.quiz_id)) weekScore += val;
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) monthScore += val;
        if (Math.floor(d.getMonth() / 3) === currentQuarter && d.getFullYear() === currentYear) quarterScore += val;
      });

      return { ...user, week_score: weekScore, month_score: monthScore, quarter_score: quarterScore };
    });
  },

  // ── 7. ADMIN: QUẢN LÝ USER ──────────────────────────────────────────────
  async adminCreateUser(userData) {
    // Kiểm tra trùng employee_code
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('employee_code', userData.employee_code.trim())
      .single();

    if (existing) {
      return { success: false, message: `Tài khoản "${userData.employee_code}" đã tồn tại trong hệ thống.` };
    }

    const newUser = {
      id: genId('u'),
      employee_code: userData.employee_code.trim(),
      full_name: (userData.full_name || '').trim(),
      department: (userData.department || '').trim(),
      pin: (userData.pin || '').trim(),
      total_score: parseInt(userData.total_score) || 0,
      is_active: userData.is_active !== undefined ? userData.is_active : true,
      role: userData.role || 'user',
      max_plays: (userData.max_plays !== undefined && userData.max_plays !== '' && userData.max_plays !== null)
        ? parseInt(userData.max_plays)
        : null,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('users').insert(newUser);
    if (error) return { success: false, message: error.message };
    return { success: true, id: newUser.id };
  },

  async adminCreateDummyPlay(userId, score, time) {
    const bounds = await this.getCurrentCycleBounds();
    const playedAt = new Date().toISOString();
    
    // Tìm bộ đề đang active trong chu kỳ hiện tại để gắn play_history (hoặc dùng quiz_id = null cũng được vì Mode 2 Thách Đấu gộp chung)
    const { data: activeQuizzes } = await supabase
      .from('quizzes')
      .select('id')
      .eq('active', true)
      .eq('month_no', bounds.month)
      .eq('week_no', bounds.week)
      .limit(1);
      
    let targetQuizId = activeQuizzes && activeQuizzes.length > 0 ? activeQuizzes[0].id : null;
    if (!targetQuizId) {
      const { data: anyQuiz } = await supabase.from('quizzes').select('id').limit(1);
      if (anyQuiz && anyQuiz.length > 0) {
        targetQuizId = anyQuiz[0].id;
      } else {
        // Force create a dummy quiz if database has zero quizzes
        const dummyQuizId = genId('q');
        await supabase.from('quizzes').insert({
          id: dummyQuizId,
          title: 'Dummy Quiz for Bot',
          active: true,
          created_at: new Date().toISOString()
        });
        targetQuizId = dummyQuizId;
      }
    }

    const dummyRecord = {
      id: genId('p'),
      user_id: userId,
      quiz_id: targetQuizId,
      score: score,
      correct_count: Math.floor(score / 10) || 1, // Ước tính số câu đúng
      wrong_count: 0,
      time_spent: time,
      played_at: playedAt,
      wrong_answers: []
    };

    const { error } = await supabase.from('play_history').insert(dummyRecord);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async adminOverrideUserTime(userId, score, timeMs) {
    const bounds = await this.getCurrentCycleBounds();

    // 1. Lấy quiz_id mặc định
    const { data: activeQuizzes } = await supabase
      .from('quizzes')
      .select('id')
      .eq('active', true)
      .limit(1);
      
    let targetQuizId = activeQuizzes && activeQuizzes.length > 0 ? activeQuizzes[0].id : null;
    if (!targetQuizId) {
      const { data: anyQuiz } = await supabase.from('quizzes').select('id').limit(1);
      if (anyQuiz && anyQuiz.length > 0) {
        targetQuizId = anyQuiz[0].id;
      } else {
        const dummyQuizId = genId('q');
        await supabase.from('quizzes').insert({
          id: dummyQuizId,
          title: 'Dummy Quiz for Override',
          active: true,
          created_at: new Date().toISOString()
        });
        targetQuizId = dummyQuizId;
      }
    }

    // 2. Cập nhật tất cả lượt chơi trong chặng thành thời gian mới
    const { data: existingPlays } = await supabase
      .from('play_history')
      .select('id')
      .eq('user_id', userId)
      .gte('played_at', bounds.start)
      .lte('played_at', bounds.end);

    if (existingPlays && existingPlays.length > 0) {
      const { error: updateError } = await supabase
        .from('play_history')
        .update({ time_spent: timeMs, score: score })
        .eq('user_id', userId)
        .gte('played_at', bounds.start)
        .lte('played_at', bounds.end);
        
      if (updateError) return { success: false, message: updateError.message };
    } else {
      // Nếu chưa có, tạo mới
      const overrideRecord = {
        id: genId('p'),
        user_id: userId,
        quiz_id: targetQuizId,
        score: score,
        correct_count: Math.floor(score / 10) || 1,
        wrong_count: 0,
        time_spent: timeMs,
        played_at: new Date().toISOString(),
        wrong_answers: []
      };
      const { error: insertError } = await supabase.from('play_history').insert(overrideRecord);
      if (insertError) return { success: false, message: insertError.message };
    }

    return { success: true };
  },

  async adminUpdateUser(id, updates) {
    // Dọn null/undefined trong updates
    const cleanUpdates = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }
    // max_plays đặc biệt: cho phép null
    if ('max_plays' in updates) {
      cleanUpdates.max_plays = (updates.max_plays !== '' && updates.max_plays !== undefined && updates.max_plays !== null)
        ? parseInt(updates.max_plays)
        : null;
    }

    const { data, error } = await supabase.from('users').update(cleanUpdates).eq('id', id).select();
    if (error) return { success: false, message: error.message };
    if (!data || data.length === 0) {
      return { success: false, message: 'Lỗi: Không thể lưu vào Database (có thể do Supabase RLS chặn quyền UPDATE).' };
    }
    return { success: true };
  },

  async adminResetAllPoints() {
    const { error } = await supabase.from('users').update({ total_score: 0 }).neq('role', 'owner');
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async adminDeleteAllUsers() {
    // Delete all users except owner. Note: ON DELETE CASCADE will handle related play_history and steal_history.
    const { error } = await supabase.from('users').delete().neq('role', 'owner');
    if (error) {
      console.error('Delete all users error:', error);
      return { success: false, message: error.message };
    }
    return { success: true };
  },

  async adminDeleteUser(id) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  // ── 8. ADMIN: QUẢN LÝ QUIZ ──────────────────────────────────────────────
  async adminGetQuestions(quizId) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  },

  async adminGetQuizzes() {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .order('week_no', { ascending: false });
    if (error) return [];
    return data || [];
  },

  async adminCreateQuiz(quizData) {
    const newQuiz = {
      id: genId('q'),
      title: (quizData.title || '').trim(),
      month_no: parseInt(quizData.month_no) || 1,
      week_no: parseInt(quizData.week_no) || 1,
      active: quizData.active || false,
      is_compensation: quizData.is_compensation || false,
      streak_day: quizData.streak_day || null,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('quizzes').insert(newQuiz);
    if (error) return { success: false, message: error.message };
    return { success: true, quiz: newQuiz };
  },

  async adminUpdateQuiz(quizId, updates) {
    const { error } = await supabase.from('quizzes').update({
      title: updates.title,
      month_no: updates.month_no,
      week_no: updates.week_no,
      is_compensation: updates.is_compensation !== undefined ? updates.is_compensation : false,
      streak_day: updates.streak_day !== undefined ? updates.streak_day : null
    }).eq('id', quizId);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },


  async adminToggleQuizActive(quizId, isActive) {
    // Nếu kích hoạt, tắt các quiz khác trước
    if (isActive) {
      await supabase.from('quizzes').update({ active: false }).neq('id', quizId);
    }
    const { error } = await supabase.from('quizzes').update({ active: isActive }).eq('id', quizId);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async adminDeleteQuiz(quizId) {
    // Cascade delete sẽ xóa questions và answers liên quan
    const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async adminResetQuizHistory(quizId) {
    const { error } = await supabase.from('play_history').delete().eq('quiz_id', quizId);
    if (error) {
      console.error('Reset quiz history error:', error);
      return { success: false, message: error.message };
    }
    return { success: true };
  },

  // ── 9. ADMIN: IMPORT QUIZ TỪ EXCEL/CSV ──────────────────────────────────
  /**
   * Import toàn bộ câu hỏi từ rows (mảng objects) vào quiz mới.
   * Format mỗi row: { 'Câu hỏi', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Đáp án đúng' }
   */
  async adminImportQuizFromRows(rows, quizTitle, monthNo, weekNo, activateNow = false, isCompensation = false, streakDay = null) {
    // Bước 1: Tạo Quiz mới
    const quizResult = await db.adminCreateQuiz({ title: quizTitle, month_no: monthNo, week_no: weekNo, active: false, is_compensation: isCompensation, streak_day: streakDay });
    if (!quizResult.success) return quizResult;

    const quizId = quizResult.quiz.id;
    let importedCount = 0;

    // Bước 2: Tạo từng câu hỏi + đáp án
    for (const row of rows) {
      const questionText = (row['Câu hỏi'] || row['question'] || row['Question'] || '').trim();
      if (!questionText) continue;

      const answers = [
        row['Answer 1'] || row['answer_1'] || row['option1'] || '',
        row['Answer 2'] || row['answer_2'] || row['option2'] || '',
        row['Answer 3'] || row['answer_3'] || row['option3'] || '',
        row['Answer 4'] || row['answer_4'] || row['option4'] || '',
      ];

      const correctIdx = parseInt(row['Đáp án đúng'] || row['correct'] || row['correct_option_index_1_to_4'] || '1') - 1;

      const point = parseInt(row['Point'] || row['point'] || row['Điểm'] || '10');
      const timeLimit = parseInt(row['Time'] || row['time'] || row['Thời gian'] || '15');
      const imageUrl = row['Hình ảnh'] || row['image_url'] || row['Image'] || row['image'] || null;

      const questionId = genId('qn');
      const { error: qErr } = await supabase.from('questions').insert({
        id: questionId,
        quiz_id: quizId,
        question_text: questionText,
        point: isNaN(point) ? 10 : point,
        time_limit: isNaN(timeLimit) ? 15 : timeLimit,
        image_url: imageUrl
      });

      if (qErr) {
        console.error('Error inserting question:', qErr);
        continue;
      }

      const answerRows = answers
        .filter(a => a.trim())
        .map((answerText, i) => ({
          id: genId('a'),
          question_id: questionId,
          answer_text: answerText.trim(),
          is_correct: i === correctIdx
        }));

      if (answerRows.length > 0) {
        await supabase.from('answers').insert(answerRows);
      }
      importedCount++;
    }

    // Bước 3: Kích hoạt nếu cần
    if (activateNow && importedCount > 0) {
      await db.adminToggleQuizActive(quizId, true);
    }

    return { success: true, importedCount, quizId };
  },

  // ── 10. ADMIN: QUẢN LÝ CÂU HỎI ─────────────────────────────────────────
  async adminGetQuestions(quizId) {
    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('id');

    if (!questions || questions.length === 0) return [];

    const enriched = [];
    for (const q of questions) {
      const { data: answers } = await supabase
        .from('answers')
        .select('*')
        .eq('question_id', q.id);
      enriched.push({ ...q, answers: answers || [] });
    }
    return enriched;
  },

  async adminCreateQuestion(quizId, questionText, answers, correctIndex, point = 10, timeLimit = 15, imageUrl = null) {
    const questionId = genId('qn');
    const { error: qErr } = await supabase.from('questions').insert({
      id: questionId,
      quiz_id: quizId,
      question_text: questionText,
      point: parseInt(point) || 10,
      time_limit: parseInt(timeLimit) || 15,
      image_url: imageUrl
    });
    if (qErr) return { success: false, message: qErr.message };

    const answerRows = answers.map((text, i) => {
      if (!text || text.trim() === '') return null;
      return {
        id: genId('a'),
        question_id: questionId,
        answer_text: text,
        is_correct: i === parseInt(correctIndex)
      };
    }).filter(Boolean);

    const { error: aErr } = await supabase.from('answers').insert(answerRows);
    if (aErr) return { success: false, message: aErr.message };
    return { success: true };
  },

  async adminDeleteQuestion(questionId) {
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async adminUpdateQuestion(questionId, questionText, answers, correctIndex, point = 10, timeLimit = 15, imageUrl = null) {
    // 1. Cập nhật nội dung câu hỏi
    const { error: qErr } = await supabase
      .from('questions')
      .update({
        question_text: questionText,
        point: parseInt(point) || 10,
        time_limit: parseInt(timeLimit) || 15,
        image_url: imageUrl
      })
      .eq('id', questionId);
    if (qErr) return { success: false, message: qErr.message };

    // 2. Xóa toàn bộ đáp án cũ
    const { error: delErr } = await supabase
      .from('answers')
      .delete()
      .eq('question_id', questionId);
    if (delErr) return { success: false, message: delErr.message };

    // 3. Insert lại đáp án mới
    const answerRows = answers.map((text, i) => {
      if (!text || text.trim() === '') return null;
      return {
        id: genId('a'),
        question_id: questionId,
        answer_text: text.trim(),
        is_correct: i === parseInt(correctIndex)
      };
    }).filter(Boolean);

    if (answerRows.length > 0) {
      const { error: aErr } = await supabase.from('answers').insert(answerRows);
      if (aErr) return { success: false, message: aErr.message };
    }

    return { success: true };
  },

  // ── 11. ADMIN: IMPORT USERS TỪ CSV/XLSX ─────────────────────────
  // phase: 'check' | 'create' | 'update'
  async adminImportUsersFromRows(rows, phase = 'check') {
    let created = 0, updated = 0;
    const duplicates = []; // danh sách tài khoản bị trùng
    const newRows = []; // dòng chưa tồn tại

    for (const row of rows) {
      const employeeCode = (row.employee_code || '').toString().trim();
      if (!employeeCode) continue;

      const userData = {
        employee_code: employeeCode,
        full_name: (row.full_name || 'Nhân viên mới').trim(),
        department: (row.department || '').trim(),
        pin: (row.pin || '1234').trim(),
        role: (row.role || 'user').trim(),
        is_active: row.is_active !== undefined ? row.is_active.toString() === 'true' : true,
        max_plays: (row.max_plays !== undefined && row.max_plays !== '') ? parseInt(row.max_plays) : null,
      };

      const { data: existing } = await supabase
        .from('users')
        .select('id, full_name, employee_code')
        .eq('employee_code', employeeCode)
        .single();

      if (existing) {
        duplicates.push({ ...userData, existingId: existing.id });
      } else {
        newRows.push(userData);
      }
    }

    // Phase 'check': chỉ trả về danh sách trùng — chưa đụng DB
    if (phase === 'check') {
      return { success: true, duplicates, newCount: newRows.length };
    }

    // Phase 'create': chỉ tạo những tài khoản mới (không trùng)
    if (phase === 'create') {
      for (const userData of newRows) {
        const newUser = {
          id: genId('u'),
          ...userData,
          total_score: 0,
          created_at: new Date().toISOString()
        };
        const { error } = await supabase.from('users').insert(newUser);
        if (!error) created++;
        else console.error('Import user error:', error);
      }
      return { success: true, created, updated: 0 };
    }

    // Phase 'update': tạo mới và cập nhật cả trùng
    if (phase === 'update') {
      // Tạo mới
      for (const userData of newRows) {
        const newUser = {
          id: genId('u'),
          ...userData,
          total_score: 0,
          created_at: new Date().toISOString()
        };
        const { error } = await supabase.from('users').insert(newUser);
        if (!error) created++;
        else console.error('Import user error:', error);
      }
      // Cập nhật trùng
      for (const userData of duplicates) {
        await supabase.from('users').update({
          full_name: userData.full_name,
          department: userData.department,
          pin: userData.pin,
          role: userData.role,
          is_active: userData.is_active,
          max_plays: userData.max_plays
        }).eq('id', userData.existingId);
        updated++;
      }
      return { success: true, created, updated };
    }

    return { success: false, message: 'Phase không hợp lệ' };
  },

  // ── 13. EXPORT BÁO CÁO ĐIỂM SỐ (XLSX) ──────────────────────────────────
  async adminExportScoresXLSX(period = 'total') {
    if (!window.XLSX) {
      alert('SheetJS chưa được tải. Vui lòng tải lại trang.');
      return;
    }

    const users = await db.adminGetUsers();
    
    // Get cycle boundaries configuration
    const allQuizzes = await db.adminGetQuizzes();
    const quizzes = allQuizzes.filter(q => q.streak_day == null);
    // Sort quizzes by created_at ascending to determine Chặng 1, Chặng 2...
    quizzes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Fetch all history to avoid PostgREST syntax errors, filter in JS
    const { data: allHistory, error: historyErr } = await supabase.from('play_history').select('*');
    if (historyErr) console.error('Error fetching history:', historyErr);
    
    // Don't filter by mode because all play_history records are quiz plays
    const history = allHistory || [];

    const userStats = users.filter(u => u.role !== 'owner').map(user => {
      const userHistory = history.filter(h => h.user_id === user.id && !isNaN(new Date(h.played_at).getTime()));
      
      const quizPlays = {}; 
      userHistory.forEach(play => {
        const quizId = play.quiz_id;
        if (!quizPlays[quizId]) quizPlays[quizId] = [];
        quizPlays[quizId].push(play);
      });

      let totalCorrect = 0;
      let totalTime = 0;
      let totalScore = 0;
      const cycleScores = {}; // Key will be the index of the quiz in the sorted quizzes array
      const cycleTimes = {}; // Stores the time spent for each quiz

      quizzes.forEach((quiz, idx) => {
        const plays = quizPlays[quiz.id] || [];
        if (plays.length > 0) {
          plays.sort((a, b) => {
            const scoreA = parseInt(a.score) || 0;
            const scoreB = parseInt(b.score) || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return (parseInt(a.time_spent) || 0) - (parseInt(b.time_spent) || 0);
          });
          
          const bestPlay = plays[0];
          cycleScores[idx] = parseInt(bestPlay.score) || 0;
          cycleTimes[idx] = parseInt(bestPlay.time_spent) || 0;
          totalCorrect += parseInt(bestPlay.correct_count) || 0;
          totalTime += parseInt(bestPlay.time_spent) || 0;
          totalScore += parseInt(bestPlay.score) || 0;
        } else {
          cycleScores[idx] = 0;
          cycleTimes[idx] = 0;
        }
      });

      return {
        id: user.id,
        employee_code: user.employee_code,
        full_name: user.full_name,
        department: user.department,
        is_active: user.is_active,
        totalCorrect,
        totalTime,
        totalScore,
        actualTotalScore: parseInt(user.total_score) || 0,
        stealPoints: (parseInt(user.total_score) || 0) - totalScore,
        cycleScores,
        cycleTimes
      };
    });

    userStats.sort((a, b) => {
      if (b.actualTotalScore !== a.actualTotalScore) return b.actualTotalScore - a.actualTotalScore;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.totalTime - b.totalTime;
    });

    const rows = userStats.map((u, i) => {
      const row = {
        'STT': i + 1,
        'Tài khoản': u.employee_code,
        'Họ Tên': u.full_name,
        'Phòng Ban': u.department,
        'Tổng Số Câu Đúng': u.totalCorrect,
        'Tổng Thời Gian': db.formatTimeSpent(u.totalTime)
      };

      quizzes.forEach((quiz, idx) => {
        row[`Chặng: ${quiz.title}`] = u.cycleScores[idx] || 0;
        row[`Thời gian chặng: ${quiz.title}`] = db.formatTimeSpent(u.cycleTimes[idx] || 0);
      });

      row['Tổng Điểm Cày Cuốc'] = u.totalScore;
      row['Điểm Thách Đấu'] = u.stealPoints;
      row['Tổng Điểm (Bảng Xếp Hạng)'] = u.actualTotalScore;
      row['Trạng Thái'] = u.is_active ? 'Hoạt động' : 'Tạm khóa';
      
      return row;
    });

    if (userStats.length > 0) {
      const avgRow = {
        'STT': '',
        'Tài khoản': '',
        'Họ Tên': 'ĐIỂM TRUNG BÌNH',
        'Phòng Ban': '',
        'Tổng Số Câu Đúng': Math.round(userStats.reduce((sum, u) => sum + u.totalCorrect, 0) / userStats.length),
        'Tổng Thời Gian': db.formatTimeSpent(Math.floor(userStats.reduce((sum, u) => sum + u.totalTime, 0) / userStats.length))
      };

      quizzes.forEach((quiz, idx) => {
        const sumScore = userStats.reduce((sum, u) => sum + (u.cycleScores[idx] || 0), 0);
        avgRow[`Chặng: ${quiz.title}`] = Math.round(sumScore / userStats.length);
        const sumTime = userStats.reduce((sum, u) => sum + (u.cycleTimes[idx] || 0), 0);
        avgRow[`Thời gian chặng: ${quiz.title}`] = db.formatTimeSpent(Math.floor(sumTime / userStats.length));
      });

      avgRow['Tổng Điểm Cày Cuốc'] = Math.round(userStats.reduce((sum, u) => sum + u.totalScore, 0) / userStats.length);
      avgRow['Điểm Thách Đấu'] = Math.round(userStats.reduce((sum, u) => sum + u.stealPoints, 0) / userStats.length);
      avgRow['Tổng Điểm (Bảng Xếp Hạng)'] = Math.round(userStats.reduce((sum, u) => sum + u.actualTotalScore, 0) / userStats.length);
      avgRow['Trạng Thái'] = '';
      
      rows.push(avgRow);
    }

    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo Chặng');
    window.XLSX.writeFile(wb, `BaoCaoDiemChang_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  // ── 10. ADMIN: LỊCH SỬ THI ĐẤU VÀ THỐNG KÊ ──────────────────────────────
  async adminGetPlayHistory() {
    const { data, error } = await supabase
      .from('play_history')
      .select(`
        *,
        users ( full_name, employee_code, department, role ),
        quizzes ( title, month_no, week_no, streak_day )
      `)
      .order('played_at', { ascending: false });
    if (error) {
      console.error('adminGetPlayHistory error:', error);
      return [];
    }
    
    // Ẩn admin khỏi lịch sử
    return (data || []).filter(row => {
      if (!row.users) return false;
      const role = row.users.role;
      const empCode = row.users.employee_code;
      return role !== 'owner' && role !== 'admin' && empCode !== 'ADMIN999';
    });
  },

  async adminGetStealHistory() {
    const { data, error } = await supabase
      .from('steal_history')
      .select(`
        *,
        attacker:users!steal_history_attacker_id_fkey ( full_name, employee_code, department, role ),
        defender:users!steal_history_defender_id_fkey ( full_name, employee_code, department, role )
      `)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('adminGetStealHistory error:', error);
      return [];
    }
    
    // Ẩn admin khỏi lịch sử thách đấu
    return (data || []).filter(row => {
      const isAttackerAdmin = row.attacker && (row.attacker.role === 'owner' || row.attacker.role === 'admin' || row.attacker.employee_code === 'ADMIN999');
      const isDefenderAdmin = row.defender && (row.defender.role === 'owner' || row.defender.role === 'admin' || row.defender.employee_code === 'ADMIN999');
      return !isAttackerAdmin && !isDefenderAdmin;
    });
  },

  async adminGetQuizParticipantCount() {
    // Gom nhóm user_id duy nhất cho mỗi bộ đề và tính toán số lượt chơi, điểm trung bình
    const { data, error } = await supabase
      .from('play_history')
      .select('quiz_id, user_id, score');

    if (error) return {};

    const stats = {};
    const seen = {};

    (data || []).forEach(row => {
      if (!stats[row.quiz_id]) {
        stats[row.quiz_id] = { totalPlays: 0, totalScore: 0 };
        seen[row.quiz_id] = new Set();
      }
      seen[row.quiz_id].add(row.user_id);
      stats[row.quiz_id].totalPlays++;
      stats[row.quiz_id].totalScore += (row.score || 0);
    });

    const result = {};
    for (const quizId in stats) {
      result[quizId] = {
        participants: seen[quizId].size,
        plays: stats[quizId].totalPlays,
        avgScore: stats[quizId].totalPlays > 0 ? Math.round(stats[quizId].totalScore / stats[quizId].totalPlays) : 0
      };
    }

    return result;
  },

  async adminGetDashboardStats() {
    const bounds = await this.getCurrentCycleBounds();

    // Lấy danh sách admin để loại trừ
    const { data: adminData } = await supabase.from('users').select('id').eq('role', 'owner');
    const adminIds = adminData ? adminData.map(a => a.id) : [];

    // 1. Tìm bộ đề có số câu sai nhiều nhất & Tìm người Cày Cuốc giỏi nhất (Chế độ 1)
    const { data: playsData } = await supabase
      .from('play_history')
      .select('quiz_id, wrong_count, user_id, correct_count, time_spent')
      .gte('played_at', bounds.start)
      .lte('played_at', bounds.end);

    let mostWrongQuizId = null;
    let maxWrongCount = 0;
    
    let topGrinderId = null;
    let topGrinderStats = { correct: -1, time: Infinity };

    if (playsData && playsData.length > 0) {
      const wrongCountByQuiz = {};
      const grinderStatsByUser = {};

      playsData.forEach(p => {
        // Gom dữ liệu bộ đề sai (bỏ qua admin)
        if (p.quiz_id && !adminIds.includes(p.user_id)) {
          wrongCountByQuiz[p.quiz_id] = (wrongCountByQuiz[p.quiz_id] || 0) + (parseInt(p.wrong_count) || 0);
        }
        
        // Gom dữ liệu cày cuốc (bỏ qua admin)
        if (p.user_id && !adminIds.includes(p.user_id)) {
          if (!grinderStatsByUser[p.user_id]) grinderStatsByUser[p.user_id] = { correct: 0, time: 0 };
          grinderStatsByUser[p.user_id].correct += (parseInt(p.correct_count) || 0);
          grinderStatsByUser[p.user_id].time += (parseFloat(p.time_spent) || 0);
        }
      });

      // Tìm bộ đề sai nhiều nhất
      for (const [qId, count] of Object.entries(wrongCountByQuiz)) {
        if (count > maxWrongCount) {
          maxWrongCount = count;
          mostWrongQuizId = qId;
        }
      }

      // Tìm Vua Cày Cuốc
      for (const [uId, stats] of Object.entries(grinderStatsByUser)) {
        if (stats.correct > topGrinderStats.correct) {
          topGrinderStats = stats;
          topGrinderId = uId;
        } else if (stats.correct === topGrinderStats.correct) {
          if (stats.time < topGrinderStats.time) {
            topGrinderStats = stats;
            topGrinderId = uId;
          }
        }
      }
    }

    let mostWrongQuizTitle = "Chưa có dữ liệu";
    if (mostWrongQuizId) {
      const { data: qData } = await supabase.from('quizzes').select('title').eq('id', mostWrongQuizId).single();
      if (qData) mostWrongQuizTitle = qData.title;
    }

    let topGrinderName = "Chưa có dữ liệu";
    if (topGrinderId) {
      const { data: uData } = await supabase.from('users').select('full_name').eq('id', topGrinderId).single();
      if (uData) {
        topGrinderName = `${uData.full_name} - ${topGrinderStats.correct} câu (${this.formatTimeSpent(topGrinderStats.time)})`;
      }
    }

    // 2. Tìm người bị thách đấu nhiều nhất
    const { data: stealsData } = await supabase
      .from('steal_history')
      .select('defender_id')
      .gte('created_at', bounds.start)
      .lte('created_at', bounds.end);

    let mostAttackedPlayerId = null;
    let maxAttackCount = 0;

    if (stealsData && stealsData.length > 0) {
      const attackCountByUser = {};
      stealsData.forEach(s => {
        if (!s.defender_id || adminIds.includes(s.defender_id)) return;
        attackCountByUser[s.defender_id] = (attackCountByUser[s.defender_id] || 0) + 1;
      });

      for (const [uId, count] of Object.entries(attackCountByUser)) {
        if (count > maxAttackCount) {
          maxAttackCount = count;
          mostAttackedPlayerId = uId;
        }
      }
    }

    let mostAttackedPlayerName = "Chưa có dữ liệu";
    if (mostAttackedPlayerId) {
      const { data: uData } = await supabase.from('users').select('full_name, employee_code').eq('id', mostAttackedPlayerId).single();
      if (uData) mostAttackedPlayerName = `${uData.full_name} (${uData.employee_code}) - ${maxAttackCount} lần`;
    }

    return {
      mostWrongQuizTitle,
      mostAttackedPlayerName,
      topGrinderName
    };
  },

  async adminGetGrinderHistory() {
    // Lấy danh sách admin để loại trừ
    const { data: adminData } = await supabase.from('users').select('id').eq('role', 'owner');
    const adminIds = adminData ? adminData.map(a => a.id) : [];

    const { data: plays, error } = await supabase
      .from('play_history')
      .select(`
        user_id,
        correct_count,
        time_spent,
        quizzes ( month_no, week_no, title )
      `);

    if (error || !plays) return [];

    // Group by cycle: "Quiz Title" -> user_id -> { correct, time }
    const cyclesData = {};
    
    plays.forEach(p => {
      if (!p.quizzes || !p.user_id || adminIds.includes(p.user_id)) return; // Bỏ qua admin
      const m = p.quizzes.month_no || 1;
      const w = p.quizzes.week_no || 1;
      const cycleKey = p.quizzes.title || `Tháng ${m} - Tuần ${w}`;
      
      if (!cyclesData[cycleKey]) {
        cyclesData[cycleKey] = { users: {}, sortKey: m * 100 + w };
      }
      
      if (!cyclesData[cycleKey].users[p.user_id]) {
        cyclesData[cycleKey].users[p.user_id] = { correct: 0, time: 0 };
      }
      
      cyclesData[cycleKey].users[p.user_id].correct += (parseInt(p.correct_count) || 0);
      cyclesData[cycleKey].users[p.user_id].time += (parseFloat(p.time_spent) || 0);
    });

    const historyList = [];
    
    // Tìm top grinder cho mỗi chu kỳ
    for (const [cycleName, data] of Object.entries(cyclesData)) {
      let topId = null;
      let topStats = { correct: -1, time: Infinity };
      
      for (const [uId, stats] of Object.entries(data.users)) {
        if (stats.correct > topStats.correct) {
          topStats = stats;
          topId = uId;
        } else if (stats.correct === topStats.correct) {
          if (stats.time < topStats.time) {
            topStats = stats;
            topId = uId;
          }
        }
      }
      
      historyList.push({
        cycleName,
        sortKey: data.sortKey,
        topGrinderId: topId,
        correct: topStats.correct,
        time: topStats.time
      });
    }

    // Sort history by sortKey DESC (mới nhất lên đầu)
    historyList.sort((a, b) => b.sortKey - a.sortKey);

    // Fetch user names
    for (const item of historyList) {
      if (item.topGrinderId) {
        const { data: uData } = await supabase.from('users').select('full_name, employee_code, department').eq('id', item.topGrinderId).single();
        if (uData) {
          item.grinderName = `${uData.full_name} (${uData.employee_code}) - ${uData.department || 'Chưa rõ'}`;
        } else {
          item.grinderName = "Người dùng ẩn";
        }
      }
    }

    return historyList;
  },

  // ── 11. GAME GIỮ CHUỖI (STREAK MODE) ──────────────────────────────
  async getUserStreakStatus(userId) {
    const { data: history, error } = await supabase
      .from('play_history')
      .select(`
        score,
        played_at,
        quizzes ( streak_day, is_compensation )
      `)
      .eq('user_id', userId)
      .order('played_at', { ascending: false });

    if (error || !history || history.length === 0) {
      return { streakDays: 0, lastPlayedStreakDay: 0, isBroken: false };
    }

    const streakHistory = history.filter(h => h.quizzes && h.quizzes.streak_day !== null);
    
    let maxStreakDay = 0;
    streakHistory.forEach(record => {
      const q = record.quizzes;
      if (q && q.streak_day && q.streak_day > maxStreakDay) {
         maxStreakDay = q.streak_day;
      }
    });

    return { streakDays: maxStreakDay, lastPlayedStreakDay: maxStreakDay, isBroken: false };
  },

  async getStreakLeaderboard() {
    const { data, error } = await supabase
      .from('play_history')
      .select(`
        score,
        time_spent,
        correct_count,
        user_id,
        users ( full_name, department, employee_code ),
        quizzes!inner ( streak_day, is_compensation )
      `)
      .not('quizzes.streak_day', 'is', null)
      .order('score', { ascending: false });

    if (error) return [];
    
    const userStats = {};
    (data || []).forEach(row => {
      if (!userStats[row.user_id]) {
        userStats[row.user_id] = {
          user: row.users,
          totalScore: 0,
          totalTime: 0,
          totalCorrect: 0,
          maxStreakDay: 0
        };
      }
      userStats[row.user_id].totalScore += (row.score || 0);
      userStats[row.user_id].totalTime += (row.time_spent || 0);
      userStats[row.user_id].totalCorrect += (row.correct_count || 0);
      const q = row.quizzes;
      if (q && q.streak_day && q.streak_day > userStats[row.user_id].maxStreakDay) {
        userStats[row.user_id].maxStreakDay = q.streak_day;
      }
    });

    return Object.values(userStats).sort((a, b) => {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return a.totalTime - b.totalTime;
    });
  }
};
