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
        pin: '123456',
        role: 'owner',
        is_active: true
      });
    } else {
       // Đảm bảo số điện thoại và PIN được cập nhật cho tài khoản này
       await supabase.from('users').update({ 
         employee_code: 'ADMIN999',
         phone_number: '0337411036', 
         pin: '123456', 
         role: 'owner' 
       }).eq('id', existingAdmin[0].id);
    }

    // Seed cấu hình mặc định
    await supabase.from('settings').upsert({ key: 'max_plays_per_day', value: '3' });
    await supabase.from('settings').upsert({ key: 'randomize_questions', value: 'OFF' });
    await supabase.from('settings').upsert({ key: 'wheel_status', value: 'OFF' });

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

  async quickLogin(fullName) {
    const name = fullName.trim();
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
        department: 'Khách',
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

  async getPlaysToday(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { count, error } = await supabase
      .from('play_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('played_at', todayStart.toISOString())
      .lte('played_at', todayEnd.toISOString());

    if (error) {
      console.error('getPlaysToday error:', error);
      return 0;
    }
    return count || 0;
  },

  async getDailyLimit() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'max_plays_per_day')
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

  async getModule1Status() {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'module1_status').single();
    if (!error && data) return data.value === 'ON';
    return false;
  },

  async updateModule1Status(statusStr) {
    const { error } = await supabase.from('settings').upsert({ key: 'module1_status', value: statusStr });
    return { success: !error, message: error?.message };
  },

  async getModule2Status() {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'module2_status').single();
    if (!error && data) return data.value === 'ON';
    return false;
  },

  async updateModule2Status(statusStr) {
    const { error } = await supabase.from('settings').upsert({ key: 'module2_status', value: statusStr });
    return { success: !error, message: error?.message };
  },

  async getRandomizeQuestionsStatus() {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'randomize_questions').single();
    if (!error && data) return data.value === 'ON';
    return false;
  },

  async updateRandomizeQuestionsStatus(statusStr) {
    const { error } = await supabase.from('settings').upsert({ key: 'randomize_questions', value: statusStr });
    return { success: !error, message: error?.message };
  },

  async getWheelStatus() {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'wheel_status').single();
    if (!error && data) return data.value === 'ON';
    return false;
  },

  async updateWheelStatus(statusStr) {
    const { error } = await supabase.from('settings').upsert({ key: 'wheel_status', value: statusStr });
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
  async getActiveQuiz() {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('active', true)
      .limit(1);
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
      const result = await db.executeSteal(userId, stealTargetId, correctCount, timeSpent);
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

    // Chế độ 1: Tích lũy
    // Tìm điểm cao nhất TRONG NGÀY của user TRƯỚC KHI lưu lượt này
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const { data: maxRecord } = await supabase
      .from('play_history')
      .select('score')
      .eq('user_id', userId)
      .gte('played_at', todayStart.toISOString())
      .lte('played_at', todayEnd.toISOString())
      .order('score', { ascending: false })
      .limit(1);
    
    const currentDailyMax = (maxRecord && maxRecord.length > 0) ? parseInt(maxRecord[0].score) : 0;
    const newScore = parseInt(score) || 0;
    const scoreDiff = newScore > currentDailyMax ? (newScore - currentDailyMax) : 0;

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

    const { error } = await supabase.from('play_history').insert(record);
    if (error) {
      console.error('savePlayRecord error:', error);
      return { success: false };
    }

    // Chỉ cập nhật total_score nếu có phá kỷ lục trong ngày
    if (scoreDiff > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('total_score')
        .eq('id', userId)
        .single();
      const currentTotal = parseInt(userData?.total_score) || 0;
      const newTotal = currentTotal + scoreDiff;
      await supabase.from('users').update({ total_score: newTotal }).eq('id', userId);
    }

    return { success: true };
  },

  async getBestPlayToday(userId) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabase
      .from('play_history')
      .select('score, correct_count, time_spent')
      .eq('user_id', userId)
      .gte('played_at', todayStart.toISOString())
      .lte('played_at', todayEnd.toISOString())
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

  async executeSteal(attackerId, defenderId, attackerCorrectCount, attackerTimeSpent) {
    // 1. Kiểm tra giới hạn 1 lần/ngày/người
    const hasStolen = await db.hasStolenFromUserToday(attackerId, defenderId);
    if (hasStolen) return { success: false, message: 'Bạn đã thách đấu người này hôm nay rồi.' };

    // 2. Kiểm tra giới hạn tổng số lần thách đấu trong ngày
    const maxSteals = await db.getMaxStealsPerDay();
    const stealsToday = await db.getStealsToday(attackerId);
    if (stealsToday >= maxSteals) return { success: false, message: 'Bạn đã hết lượt thách đấu hôm nay.' };

    // 3. Lấy thành tích tốt nhất của người bị thách đấu
    const defenderBest = await db.getBestPlayToday(defenderId);
    
    const defCorrect = defenderBest ? parseInt(defenderBest.correct_count) || 0 : 0;
    const defTime = defenderBest ? parseInt(defenderBest.time_spent) || 999999 : 999999;
    
    const atkCorrect = parseInt(attackerCorrectCount) || 0;
    const atkTime = parseInt(attackerTimeSpent) || 0;

    let isSuccess = false;
    if (atkCorrect > defCorrect) {
      isSuccess = true;
    } else if (atkCorrect === defCorrect) {
      if (atkTime <= defTime) isSuccess = true;
    }

    // 4. Lưu lịch sử
    const { error } = await supabase.from('steal_history').insert({
      id: genId('st'),
      attacker_id: attackerId,
      defender_id: defenderId,
      is_success: isSuccess,
      attacker_correct_count: attackerCorrectCount,
      attacker_time_spent: attackerTimeSpent,
      defender_correct_count: defCorrect,
      defender_time_spent: defTime
    });

    if (error) return { success: false, message: error.message };

    // 5. Lấy multiplier & base points từ settings
    const multipliers = await db.getStealMultipliers();
    const basePoints = await db.getStealBasePoints();

    // 6. Cộng/Trừ điểm
    const { data: usersData } = await supabase.from('users').select('id, total_score, has_shield').in('id', [attackerId, defenderId]);
    const attackerData = usersData.find(u => u.id === attackerId);
    const defenderData = usersData.find(u => u.id === defenderId);

    const attackerTotal = parseInt(attackerData?.total_score) || 0;
    const defenderTotal = parseInt(defenderData?.total_score) || 0;

    const winPoints = Math.round(basePoints.win * multipliers.win);
    const losePoints = Math.round(basePoints.lose * multipliers.lose);

    let shieldUsed = false;
    if (isSuccess) {
      // Attacker wins: Attacker gets +winPoints, Defender gets -winPoints (allow negative)
      await supabase.from('users').update({ total_score: attackerTotal + winPoints }).eq('id', attackerId);
      
      if (defenderData?.has_shield) {
        shieldUsed = true;
        // Shield saves the day, defender loses 0 points, but shield breaks
        await supabase.from('users').update({ has_shield: false }).eq('id', defenderId);
      } else {
        await supabase.from('users').update({ total_score: defenderTotal - winPoints }).eq('id', defenderId);
      }
    } else {
      // Attacker loses: Attacker gets -losePoints (allow negative), Defender gets +losePoints
      await supabase.from('users').update({ total_score: attackerTotal - losePoints }).eq('id', attackerId);
      await supabase.from('users').update({ total_score: defenderTotal + losePoints }).eq('id', defenderId);
    }

    return { success: true, isWin: isSuccess, defCorrect, defTime, atkCorrect, atkTime, winPoints, losePoints, shieldUsed };
  },

  // ── 5. LEADERBOARD ──────────────────────────────────────────────────────
  async getLeaderboard() {
    const { data, error } = await supabase
      .from('users')
      .select('id, employee_code, full_name, department, total_score, role, mega_code')
      .eq('is_active', true)
      .neq('role', 'owner')
      .order('total_score', { ascending: false });

    if (error) {
      console.error('getLeaderboard error:', error);
      return [];
    }
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
    const { data } = await supabase
      .from('users')
      .select('id, total_score')
      .eq('is_active', true)
      .neq('role', 'owner')
      .gt('total_score', 0)  // Chỉ xếp hạng người có điểm > 0
      .order('total_score', { ascending: false });

    if (!data) return null;

    // Kiểm tra user có trong danh sách rank không (phải có điểm > 0)
    const rank = data.findIndex(u => u.id === userId);
    if (rank < 0) return null; // Không có hạng (chưa có điểm)

    // Xử lý đồng hạng: người đồng điểm có cùng hạng
    const myScore = data[rank].total_score;
    const firstWithSameScore = data.findIndex(u => u.total_score === myScore);
    return firstWithSameScore + 1;
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

    const { error } = await supabase.from('users').update(cleanUpdates).eq('id', id);
    if (error) return { success: false, message: error.message };
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
      week_no: updates.week_no
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

  // ── 9. ADMIN: IMPORT QUIZ TỪ EXCEL/CSV ──────────────────────────────────
  /**
   * Import toàn bộ câu hỏi từ rows (mảng objects) vào quiz mới.
   * Format mỗi row: { 'Câu hỏi', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Đáp án đúng' }
   */
  async adminImportQuizFromRows(rows, quizTitle, monthNo, weekNo, activateNow = false) {
    // Bước 1: Tạo Quiz mới
    const quizResult = await db.adminCreateQuiz({ title: quizTitle, month_no: monthNo, week_no: weekNo, active: false });
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

      const questionId = genId('qn');
      const { error: qErr } = await supabase.from('questions').insert({
        id: questionId,
        quiz_id: quizId,
        question_text: questionText,
        point: isNaN(point) ? 10 : point,
        time_limit: isNaN(timeLimit) ? 15 : timeLimit
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

  async adminCreateQuestion(quizId, questionText, answers, correctIndex, point = 10, timeLimit = 15) {
    const questionId = genId('qn');
    const { error: qErr } = await supabase.from('questions').insert({
      id: questionId,
      quiz_id: quizId,
      question_text: questionText,
      point: point,
      time_limit: timeLimit
    });
    if (qErr) return { success: false, message: qErr.message };

    const answerRows = answers.map((text, i) => ({
      id: genId('a'),
      question_id: questionId,
      answer_text: text,
      is_correct: i === parseInt(correctIndex)
    }));

    const { error: aErr } = await supabase.from('answers').insert(answerRows);
    if (aErr) return { success: false, message: aErr.message };
    return { success: true };
  },

  async adminDeleteQuestion(questionId) {
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async adminUpdateQuestion(questionId, questionText, answers, correctIndex, point = 10, timeLimit = 15) {
    // 1. Cập nhật nội dung câu hỏi
    const { error: qErr } = await supabase
      .from('questions')
      .update({
        question_text: questionText,
        point: point,
        time_limit: timeLimit
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
    const answerRows = answers
      .filter(t => t.trim())
      .map((text, i) => ({
        id: genId('a'),
        question_id: questionId,
        answer_text: text.trim(),
        is_correct: i === parseInt(correctIndex)
      }));

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
    const aggregated = await db.adminGetAggregatedScores();
    if (!window.XLSX) {
      alert('SheetJS chưa được tải. Vui lòng tải lại trang.');
      return;
    }

    const scoreField = period === 'week' ? 'week_score'
      : period === 'month' ? 'month_score'
        : period === 'quarter' ? 'quarter_score'
          : 'total_score';

    const rows = aggregated
      .filter(u => u.role !== 'owner')
      .sort((a, b) => (b[scoreField] || 0) - (a[scoreField] || 0))
      .map((u, i) => ({
        'STT': i + 1,
        'Tài khoản': u.employee_code,
        'Họ Tên': u.full_name,
        'Phòng Ban': u.department,
        'Điểm Tuần': u.week_score || 0,
        'Điểm Tháng': u.month_score || 0,
        'Điểm Quý': u.quarter_score || 0,
        'Tổng Điểm': u.total_score || 0,
        'Trạng Thái': u.is_active ? 'Hoạt động' : 'Tạm khóa'
      }));

    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo Điểm');

    const periodLabel = period === 'week' ? 'Tuan' : period === 'month' ? 'Thang' : period === 'quarter' ? 'Quy' : 'ToanPhan';
    window.XLSX.writeFile(wb, `BaoCaoDiem_${periodLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  // ── 10. ADMIN: LỊCH SỬ THI ĐẤU VÀ THỐNG KÊ ──────────────────────────────
  async adminGetPlayHistory() {
    const { data, error } = await supabase
      .from('play_history')
      .select(`
        *,
        users ( full_name, employee_code, department ),
        quizzes ( title, month_no, week_no )
      `)
      .order('played_at', { ascending: false });
    if (error) {
      console.error('adminGetPlayHistory error:', error);
      return [];
    }
    return data || [];
  },

  async adminGetQuizParticipantCount() {
    // Gom nhóm user_id duy nhất cho mỗi bộ đề
    const { data, error } = await supabase
      .from('play_history')
      .select('quiz_id, user_id');

    if (error) return {};

    const counts = {};
    const seen = {};

    (data || []).forEach(row => {
      if (!seen[row.quiz_id]) seen[row.quiz_id] = new Set();
      seen[row.quiz_id].add(row.user_id);
    });

    for (const quizId in seen) {
      counts[quizId] = seen[quizId].size;
    }

    return counts;
  }
};
