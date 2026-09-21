/**
 * Admin Module — Game HRIS
 * Quản lý người dùng, quiz, import/export — kết nối trực tiếp Supabase.
 */

import { db, parseCSV, exportAccountsAsCSV } from './supabase.js?v=14';

document.addEventListener('DOMContentLoaded', async () => {
  try {
  // ── Kiểm tra phiên đăng nhập ────────────────────────────────────────────────
  const sessionUser = sessionStorage.getItem('current_user');
  if (!sessionUser) { window.location.replace('/login.html'); return; }

  const user = JSON.parse(sessionUser);
  if (user.role !== 'admin' && user.role !== 'owner') {
    alert('Từ chối truy cập: Bạn không có quyền quản trị viên!');
    window.location.replace('/index.html');
    return;
  }

  // ── DOM Elements ────────────────────────────────────────────────────────────
  const tabUsersBtn = document.getElementById('tab_users_btn');
  const tabQuizzesBtn = document.getElementById('tab_quizzes_btn');
  const tabHistoryBtn = document.getElementById('tab_history_btn');
  const tabImportBtn = document.getElementById('tab_import_btn');
  const tabLuckyBtn = document.getElementById('tab_lucky_btn');
  const adminDbMode = document.getElementById('admin_db_mode');
  const sectionUsers = document.getElementById('section_users');
  const sectionQuizzes = document.getElementById('section_quizzes');
  const sectionHistory = document.getElementById('section_history');
  const sectionImport = document.getElementById('section_import');
  const sectionLuckyDraw = document.getElementById('section_lucky_draw');
  // User Modal
  const modalUser = document.getElementById('modal_user');
  const formUser = document.getElementById('form_user');
  const formUserId = document.getElementById('form_user_id');
  const formUserCode = document.getElementById('form_user_code');
  const formUserFullName = document.getElementById('form_user_fullname');
  const formUserDept = document.getElementById('form_user_dept');
  const formUserPin = document.getElementById('form_user_pin');
  const formUserMaxPlays = document.getElementById('form_user_max_plays');
  const formUserScore = document.getElementById('form_user_score');
  const formUserActive = document.getElementById('form_user_active');
  const btnOpenUserModal = document.getElementById('btn_open_user_modal');
  const btnCloseUserModal = document.getElementById('btn_close_user_modal');
  const usersTableBody = document.getElementById('users_table_body');

  // Quiz Modal
  const quizzesContainer = document.getElementById('quizzes_container');
  const modalQuiz = document.getElementById('modal_quiz');
  const formQuiz = document.getElementById('form_quiz');
  const formQuizTitle = document.getElementById('form_quiz_title');
  const formQuizWeek = document.getElementById('form_quiz_week');
  const formQuizActive = document.getElementById('form_quiz_active');
  const btnOpenQuizModal = document.getElementById('btn_open_quiz_modal');
  const btnCloseQuizModal = document.getElementById('btn_close_quiz_modal');

  // Filter Bar Elements
  const filterQuizMonth = document.getElementById('filter_quiz_month');
  const filterQuizWeek = document.getElementById('filter_quiz_week');
  const btnClearFilter = document.getElementById('btn_clear_filter');

  if (filterQuizMonth) filterQuizMonth.addEventListener('input', fetchAndRenderQuizzes);
  if (filterQuizWeek) filterQuizWeek.addEventListener('input', fetchAndRenderQuizzes);
  if (btnClearFilter) {
    btnClearFilter.addEventListener('click', () => {
      if (filterQuizMonth) filterQuizMonth.value = '';
      if (filterQuizWeek) filterQuizWeek.value = '';
      fetchAndRenderQuizzes();
    });
  }

  // Quiz Questions View
  const quizQuestionsBox = document.getElementById('quiz_questions_box');
  const selectedQuizSubtitle = document.getElementById('selected_quiz_subtitle');
  const selectedQuizTitle = document.getElementById('selected_quiz_title');
  const questionsListWrapper = document.getElementById('questions_list_wrapper');
  const btnAddQuestionForm = document.getElementById('btn_add_question_form');

  // Add Question Modal
  const modalQuestion = document.getElementById('modal_question');
  const formQuestion = document.getElementById('form_question');
  const formQuestionQuizId = document.getElementById('form_question_quiz_id');
  const formQuestionText = document.getElementById('form_question_text');

  // Import Elements
  const importTypeSelect = document.getElementById('import_type_select');
  const guideUsersCsv = document.getElementById('guide_users_csv');
  const guideQuizzesCsv = document.getElementById('guide_quizzes_csv');
  const quizImportDetails = document.getElementById('quiz_import_details');
  const csvFileInput = document.getElementById('csv_file_input');
  const fileNameDisplay = document.getElementById('file_name_display');
  const csvTextareaInput = document.getElementById('csv_textarea_input');
  const btnProcessImport = document.getElementById('btn_process_import');

  // Import Sub-tabs
  const wrapperImportQuiz = document.getElementById('wrapper_import_quiz');
  const subtabImportQuizNormal = document.getElementById('subtab_import_quiz_normal');
  const subtabImportQuizStreak = document.getElementById('subtab_import_quiz_streak');
  const importQuizStreakFields = document.getElementById('import_quiz_streak_fields');
  let currentImportQuizMode = 'normal';

  if (subtabImportQuizNormal && subtabImportQuizStreak) {
    subtabImportQuizNormal.addEventListener('click', () => {
      currentImportQuizMode = 'normal';
      subtabImportQuizNormal.classList.replace('text-[#8B5A2B]', 'bg-[#DE3A3B]');
      subtabImportQuizNormal.classList.replace('hover:bg-[rgba(139,90,43,0.1)]', 'text-white');
      subtabImportQuizStreak.classList.replace('bg-[#DE3A3B]', 'text-[#8B5A2B]');
      subtabImportQuizStreak.classList.replace('text-white', 'hover:bg-[rgba(139,90,43,0.1)]');
      if (importQuizStreakFields) importQuizStreakFields.classList.add('hidden');
    });

    subtabImportQuizStreak.addEventListener('click', () => {
      currentImportQuizMode = 'streak';
      subtabImportQuizStreak.classList.replace('text-[#8B5A2B]', 'bg-[#DE3A3B]');
      subtabImportQuizStreak.classList.replace('hover:bg-[rgba(139,90,43,0.1)]', 'text-white');
      subtabImportQuizNormal.classList.replace('bg-[#DE3A3B]', 'text-[#8B5A2B]');
      subtabImportQuizNormal.classList.replace('text-white', 'hover:bg-[rgba(139,90,43,0.1)]');
      if (importQuizStreakFields) importQuizStreakFields.classList.remove('hidden');
    });
  }


  // Alert Modal
  const inputStreakGameMode = document.getElementById('input_streak_game_mode');
  const inputMaxStreakDays = document.getElementById('input_max_streak_days');
  const btnSaveStreakGameMode = document.getElementById('btn_save_streak_game_mode');
  if (inputStreakGameMode && btnSaveStreakGameMode) {
    db.getStreakGameMode().then(isOn => {
      inputStreakGameMode.value = isOn ? 'ON' : 'OFF';
    });
    if (inputMaxStreakDays) {
      db.getMaxStreakDays().then(maxDays => {
        inputMaxStreakDays.value = maxDays || 5;
      });
    }
    btnSaveStreakGameMode.addEventListener('click', async () => {
      const maxDays = inputMaxStreakDays ? inputMaxStreakDays.value : 5;
      await db.updateMaxStreakDays(maxDays);
      const res = await db.updateStreakGameMode(inputStreakGameMode.value);
      if (res.success) alert('Cập nhật cấu hình Giữ Chuỗi thành công!');
      else alert('Lỗi: ' + res.message);
    });
  }

  const adminAlertModal = document.getElementById('admin_alert_modal');
  const adminAlertTitle = document.getElementById('admin_alert_title');
  const adminAlertContent = document.getElementById('admin_alert_content');
  const btnCloseAdminAlert = document.getElementById('btn_close_admin_alert');

  let currentQuizMode = 'normal';
  let currentHistoryMode = 'normal';
  let currentExpandedQuizId = null;
  let currentExpandedQuizMonth = null;
  let currentExpandedQuizWeek = null;
  let currentExpandedQuizTitle = null;
  let currentExpandedQuizStreakDay = null;

  // ── Connection badge ─────────────────────────────────────────────────────────
  if (adminDbMode) {
    adminDbMode.innerHTML = '<span class="text-emerald-600 font-bold">⚡ Supabase Cloud</span>';
  }

  // ── Alert helper ─────────────────────────────────────────────────────────────
  function showAdminAlert(title, content) {
    if (adminAlertModal) {
      adminAlertTitle.textContent = title;
      adminAlertContent.textContent = content;
      adminAlertModal.classList.remove('hidden');
    }
  }
  if (btnCloseAdminAlert) {
    btnCloseAdminAlert.addEventListener('click', () => adminAlertModal.classList.add('hidden'));
  }

  // ── TAB ROUTING ──────────────────────────────────────────────────────────────
  const tabConfigs = [
    { btn: tabUsersBtn, section: sectionUsers },
    { btn: tabQuizzesBtn, section: sectionQuizzes },
    { btn: tabHistoryBtn, section: sectionHistory },
    { btn: tabImportBtn, section: sectionImport },
    { btn: tabLuckyBtn, section: sectionLuckyDraw }
  ];

  tabConfigs.forEach(tab => {
    if (!tab.btn) return;
    tab.btn.addEventListener('click', () => {
      tabConfigs.forEach(t => {
        if (t.btn) t.btn.removeAttribute('style');
        t.btn.className = 'tab-btn w-full text-left px-4 py-3 rounded-2xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition flex items-center gap-3 cursor-pointer';
        if (t.section) t.section.classList.add('hidden');
      });
      tab.btn.className = 'tab-btn w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition flex items-center gap-3 cursor-pointer';
      tab.btn.style.background = '#FEF0E8';
      tab.btn.style.color = '#E07242';
      if (tab.section) tab.section.classList.remove('hidden');
      if (tab.btn === tabUsersBtn) fetchAndRenderUsers();
      if (tab.btn === tabQuizzesBtn) { fetchAndRenderQuizzes(); }
      if (tab.btn === tabHistoryBtn) { fetchAndRenderHistory(); }
    });
  });
  // ── SUB-TAB ROUTING ──────────────────────────────────────────────────────────
  const subtabQuizNormal = document.getElementById('subtab_quiz_normal');
  const subtabQuizStreak = document.getElementById('subtab_quiz_streak');
  const wrapperQuizNormal = document.getElementById('wrapper_quizzes_normal');
  const wrapperQuizStreak = document.getElementById('wrapper_quizzes_streak');

  if (subtabQuizNormal && subtabQuizStreak) {
    subtabQuizNormal.addEventListener('click', () => {
      subtabQuizNormal.className = 'px-4 py-2 text-xs font-bold rounded-lg transition bg-[#DE3A3B] text-white shadow-sm cursor-pointer';
      subtabQuizStreak.className = 'px-4 py-2 text-xs font-bold rounded-lg transition text-[#8B5A2B] hover:bg-[rgba(139,90,43,0.1)] cursor-pointer';
      currentQuizMode = 'normal';
      fetchAndRenderQuizzes();
    });
    subtabQuizStreak.addEventListener('click', () => {
      subtabQuizStreak.className = 'px-4 py-2 text-xs font-bold rounded-lg transition bg-[#DE3A3B] text-white shadow-sm cursor-pointer';
      subtabQuizNormal.className = 'px-4 py-2 text-xs font-bold rounded-lg transition text-[#8B5A2B] hover:bg-[rgba(139,90,43,0.1)] cursor-pointer';
      currentQuizMode = 'streak';
      fetchAndRenderQuizzes();
    });
  }

  const subtabHistoryNormal = document.getElementById('subtab_history_normal');
  const subtabHistoryStreak = document.getElementById('subtab_history_streak');
  const subtabHistorySteal = document.getElementById('subtab_history_steal');
  const wrapperHistoryNormal = document.getElementById('wrapper_history_normal');
  const wrapperHistorySteal = document.getElementById('wrapper_history_steal');

  function updateHistoryTabsUI() {
    if (subtabHistoryNormal) {
      subtabHistoryNormal.className = currentHistoryMode === 'normal' 
        ? 'px-4 py-2 text-xs font-bold rounded-lg transition bg-[#DE3A3B] text-white shadow-sm cursor-pointer' 
        : 'px-4 py-2 text-xs font-bold rounded-lg transition text-[#8B5A2B] hover:bg-[rgba(139,90,43,0.1)] cursor-pointer';
    }
    if (subtabHistoryStreak) {
      subtabHistoryStreak.className = currentHistoryMode === 'streak'
        ? 'px-4 py-2 text-xs font-bold rounded-lg transition bg-[#DE3A3B] text-white shadow-sm cursor-pointer'
        : 'px-4 py-2 text-xs font-bold rounded-lg transition text-[#8B5A2B] hover:bg-[rgba(139,90,43,0.1)] cursor-pointer';
    }
    if (subtabHistorySteal) {
      subtabHistorySteal.className = currentHistoryMode === 'steal'
        ? 'px-4 py-2 text-xs font-bold rounded-lg transition bg-[#DE3A3B] text-white shadow-sm cursor-pointer'
        : 'px-4 py-2 text-xs font-bold rounded-lg transition text-[#8B5A2B] hover:bg-[rgba(139,90,43,0.1)] cursor-pointer';
    }

    if (currentHistoryMode === 'steal') {
      if (wrapperHistoryNormal) wrapperHistoryNormal.classList.add('hidden');
      if (wrapperHistorySteal) wrapperHistorySteal.classList.remove('hidden');
      fetchAndRenderStealHistory();
    } else {
      if (wrapperHistorySteal) wrapperHistorySteal.classList.add('hidden');
      if (wrapperHistoryNormal) wrapperHistoryNormal.classList.remove('hidden');
      fetchAndRenderHistory();
    }
  }

  if (subtabHistoryNormal && subtabHistoryStreak) {
    subtabHistoryNormal.addEventListener('click', () => {
      currentHistoryMode = 'normal';
      updateHistoryTabsUI();
    });
    subtabHistoryStreak.addEventListener('click', () => {
      currentHistoryMode = 'streak';
      updateHistoryTabsUI();
    });
    if (subtabHistorySteal) {
      subtabHistorySteal.addEventListener('click', () => {
        currentHistoryMode = 'steal';
        updateHistoryTabsUI();
      });
    }
  }


  // ── 1. USERS MANAGEMENT ──────────────────────────────────────────────────────
  const btnDeleteAllUsers = document.getElementById('btn_delete_all_users');
  if (btnDeleteAllUsers) {
    btnDeleteAllUsers.addEventListener('click', async () => {
      const pinCode = prompt('CẢNH BÁO NGUY HIỂM: Hành động này sẽ XÓA SẠCH toàn bộ tài khoản người chơi và điểm số (trừ tài khoản Admin).\nNhập mã PIN của bạn để xác nhận (ví dụ: 1234):');
      if (pinCode === null) return; // Cancel
      
      const currentUser = JSON.parse(sessionStorage.getItem('current_user'));
      if (pinCode !== currentUser.pin) {
        alert('Mã PIN không chính xác! Hủy thao tác xóa.');
        return;
      }
      
      if (confirm('BẠN CÓ CHẮC CHẮN 100% MUỐN RESET GAME? Mọi dữ liệu không thể khôi phục!')) {
        const originalText = btnDeleteAllUsers.innerHTML;
        btnDeleteAllUsers.innerHTML = '⏳ Đang xóa toàn bộ...';
        btnDeleteAllUsers.disabled = true;
        
        const res = await db.adminDeleteAllUsers();
        if (res && res.success) {
          alert('Đã xóa sạch toàn bộ người chơi thành công! Game đã được Reset.');
        } else {
          alert('Lỗi khi xóa: ' + (res?.message || 'Không rõ nguyên nhân'));
        }
        
        btnDeleteAllUsers.innerHTML = originalText;
        btnDeleteAllUsers.disabled = false;
        fetchAndRenderUsers();
      }
    });
  }
  async function fetchAndRenderUsers() {
    if (!usersTableBody) return;
    usersTableBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#8B5A2B]">Đang nạp danh sách...</td></tr>`;

    const usersList = await db.adminGetUsers();
    usersTableBody.innerHTML = '';

    if (!usersList || usersList.length === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#8B5A2B] italic">Chưa có nhân viên nào. Hãy thêm mới hoặc import từ file.</td></tr>`;
      return;
    }

    usersList.forEach(u => {
      const roleBadge = u.role === 'owner'
        ? '<span class="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">👑 Owner</span>'
        : u.role === 'admin'
          ? '<span class="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">⚡ Admin</span>'
          : '<span class="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">👤 Nhân viên</span>';

      const limitDisplay = (u.max_plays !== null && u.max_plays !== undefined)
        ? `<span class="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 font-bold text-[11px]">${u.max_plays} lượt</span>`
        : '<span class="text-slate-400 italic text-[11px]">Mặc định</span>';

      const row = document.createElement('tr');
      row.className = 'hover:bg-[rgba(139,90,43,0.1)] transition';
      row.innerHTML = `
        <td class="p-3 font-mono text-[#593113] text-xs">${u.employee_code}</td>
        <td class="p-3 font-bold text-[#4A240A]">${u.full_name}</td>
        <td class="p-3">${roleBadge}</td>
        <td class="p-3 text-[#8B5A2B] text-xs">${u.department || '—'}</td>
        <td class="p-3 font-bold text-rose-600 text-[11px]">${u.mega_code || '—'}</td>
        <td class="p-3 font-mono text-[#8B5A2B] text-xs">••••</td>
        <td class="p-3 text-center">${limitDisplay}</td>
        <td class="p-3 text-center font-extrabold text-[#DE3A3B] font-['Space_Grotesk']">${u.total_score || 0}đ</td>
        <td class="p-3 text-center">
          <button class="toggle-active-btn inline-flex px-2.5 py-1 text-[10px] font-bold rounded-lg cursor-pointer ${u.is_active
          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
          : 'bg-rose-50 text-rose-500 border border-rose-200'
        }" data-id="${u.id}" data-active="${u.is_active}">
            ${u.is_active ? 'Hoạt động' : 'Tạm Khóa'}
          </button>
        </td>
        <td class="p-3 text-center space-x-1">
          <button class="edit-user-btn p-1.5 bg-[#F9F5F0] border-2 border-[#8B5A2B] text-[#8B5A2B] rounded-lg hover:bg-[#E9C691] hover:text-[#4A240A] transition inline-flex items-center cursor-pointer" data-id="${u.id}" title="Sửa">✏️</button>
          <button class="delete-user-btn p-1.5 bg-rose-50 border-2 border-rose-200 text-rose-600 rounded-lg hover:bg-rose-100 transition inline-flex items-center cursor-pointer" data-id="${u.id}" title="Xóa">🗑️</button>
        </td>
      `;
      usersTableBody.appendChild(row);
    });

    // Bind toggle active
    document.querySelectorAll('.toggle-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uId = btn.getAttribute('data-id');
        const isAct = btn.getAttribute('data-active') === 'true';
        await db.adminUpdateUser(uId, { is_active: !isAct });
        fetchAndRenderUsers();
      });
    });

    // Bind edit
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uId = btn.getAttribute('data-id');
        const targetU = await db.getUserById(uId);
        if (targetU) {
          formUserId.value = targetU.id;
          formUserCode.value = targetU.employee_code;
          formUserFullName.value = targetU.full_name;
          formUserDept.value = targetU.department || '';
          formUserPin.value = targetU.pin;
          formUserMaxPlays.value = (targetU.max_plays !== null && targetU.max_plays !== undefined) ? targetU.max_plays : '';
          if (formUserScore) formUserScore.value = targetU.total_score || 0;
          formUserActive.checked = targetU.is_active;

          const formUserTime = document.getElementById('form_user_time');
          const formUserTimeMs = document.getElementById('form_user_time_ms');
          if (formUserTime) formUserTime.value = '';
          if (formUserTimeMs) formUserTimeMs.value = '';

          // Phân quyền: set dropdown role
          const roleSelect = document.getElementById('form_user_role');
          if (roleSelect) {
            if (targetU.role === 'owner') {
              // Owner: hiển thị là owner, không cho đổi
              roleSelect.value = 'owner';
              roleSelect.disabled = true;
              roleSelect.querySelector('option[value="owner"]').removeAttribute('disabled');
            } else {
              roleSelect.value = targetU.role || 'user';
              roleSelect.disabled = false;
              roleSelect.querySelector('option[value="owner"]').setAttribute('disabled', '');
            }
          }

          document.getElementById('modal_user_title').textContent = 'Chỉnh sửa nhân sự';
          modalUser.classList.remove('hidden');
        }
      });
    });

    // Bind delete
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Xác nhận xóa nhân viên này khỏi hệ thống? Hành động không thể hoàn tác.')) {
          const uId = btn.getAttribute('data-id');
          const result = await db.adminDeleteUser(uId);
          if (result.success) {
            fetchAndRenderUsers();
          } else {
            showAdminAlert('Lỗi xóa', result.message || 'Không thể xóa nhân viên.');
          }
        }
      });
    });
  }

  // User Modal: Open (Add)
  if (btnOpenUserModal) {
    btnOpenUserModal.addEventListener('click', () => {
      formUserId.value = '';
      formUser.reset();
      if (formUserMaxPlays) formUserMaxPlays.value = '';
      if (formUserScore) formUserScore.value = '0';
      // Reset role về mặc định 'user' khi thêm mới
      const roleSelect = document.getElementById('form_user_role');
      if (roleSelect) {
        roleSelect.value = 'user';
        roleSelect.disabled = false;
        roleSelect.querySelector('option[value="owner"]').setAttribute('disabled', '');
      }
      document.getElementById('modal_user_title').textContent = 'Thêm Nhân Viên Mới';
      modalUser.classList.remove('hidden');
    });
  }

  if (btnCloseUserModal) {
    btnCloseUserModal.addEventListener('click', () => modalUser.classList.add('hidden'));
  }

  // User Form: Submit
  if (formUser) {
    formUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uId = formUserId.value;
      const roleSelect = document.getElementById('form_user_role');
      const selectedRole = (roleSelect && !roleSelect.disabled) ? roleSelect.value : undefined;

      let finalCode = formUserCode.value.trim();
      if (!finalCode) {
        finalCode = `AUTO_BOT_${Date.now().toString().slice(-6)}`;
      }

      let finalPin = formUserPin.value.trim();
      if (!finalPin) {
        finalPin = '1234';
      }

      const userData = {
        employee_code: finalCode,
        full_name: formUserFullName.value.trim(),
        department: formUserDept.value.trim(),
        pin: finalPin,
        is_active: formUserActive.checked,
        max_plays: (formUserMaxPlays && formUserMaxPlays.value.trim() !== '') ? parseInt(formUserMaxPlays.value) : null,
        total_score: (formUserScore && formUserScore.value.trim() !== '') ? parseInt(formUserScore.value) : 0,
        ...(selectedRole ? { role: selectedRole } : {})
      };

      const formUserTime = document.getElementById('form_user_time');
      const formUserTimeMs = document.getElementById('form_user_time_ms');
      let virtualTimeStr = formUserTime && formUserTime.value.trim() !== '' ? formUserTime.value.trim() : '';
      let virtualTimeMsStr = formUserTimeMs && formUserTimeMs.value.trim() !== '' ? formUserTimeMs.value.trim() : '';

      // Cảnh báo nếu admin tự hạ quyền chính mình
      if (uId && selectedRole === 'user') {
        const sessionUser = JSON.parse(sessionStorage.getItem('current_user') || '{}');
        if (sessionUser.id === uId) {
          showAdminAlert('⚠️ Cảnh báo', 'Bạn đang tự hạ quyền chính mình xuống "Nhân viên". Hành động này sẽ mất quyền Admin ngay sau khi lưu.');
          return;
        }
      }

      let result;
      let finalUserId = uId;
      if (uId) {
        result = await db.adminUpdateUser(uId, userData);
        if (result.success) showAdminAlert('Cập nhật thành công ✅', `Đã cập nhật tài khoản "${userData.full_name}".`);
        else showAdminAlert('Lỗi', result.message || 'Không thể cập nhật.');
      } else {
        result = await db.adminCreateUser(userData);
        if (result.success) {
          finalUserId = result.id;
          showAdminAlert('Thêm thành công ✅', `Đã tạo tài khoản mới cho "${userData.full_name}".`);
        } else {
          showAdminAlert('Lỗi', result.message || 'Không thể tạo tài khoản.');
        }
      }

      // Tạo lượt chơi ảo nếu có nhập thời gian ảo
      if (result.success && (virtualTimeStr !== '' || virtualTimeMsStr !== '') && finalUserId) {
        let vTimeMs = 0;
        if (virtualTimeStr !== '') vTimeMs += parseInt(virtualTimeStr) * 1000;
        if (virtualTimeMsStr !== '') vTimeMs += parseInt(virtualTimeMsStr);
        
        if (vTimeMs > 0 || virtualTimeStr === '0' || virtualTimeMsStr === '0') {
           const dummyResult = await db.adminOverrideUserTime(finalUserId, userData.total_score, vTimeMs);
           if (!dummyResult.success) {
             alert('Lỗi ghi đè thời gian: ' + dummyResult.message);
           }
        }
      }

      if (result.success) {
        modalUser.classList.add('hidden');
        fetchAndRenderUsers();
      }
    });

    if (formUserFullName) {
      formUserFullName.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    }
  }

  // ── 2. QUIZZES MANAGEMENT ────────────────────────────────────────────────────
  async function fetchAndRenderQuizzes() {
    const targetContainer = document.getElementById('quizzes_container');
    if (!targetContainer) return;
    targetContainer.innerHTML = '<p class="text-slate-400 p-4">Đang tải đề kiểm tra...</p>';

    let qList = await db.adminGetQuizzes();
    const participantCounts = await db.adminGetQuizParticipantCount();

    // Lọc theo Tháng & Tuần
    const filterMonth = document.getElementById('filter_quiz_month')?.value;
    const filterWeek = document.getElementById('filter_quiz_week')?.value;

    if (filterMonth) {
      qList = qList.filter(q => q.month_no == filterMonth);
    }
    if (filterWeek) {
      qList = qList.filter(q => q.week_no == filterWeek);
    }
    
    if (currentQuizMode === 'streak') {
      qList = qList.filter(q => q.streak_day != null);
    } else {
      qList = qList.filter(q => q.streak_day == null);
    }

    targetContainer.innerHTML = '';

    if (!qList || qList.length === 0) {
      targetContainer.innerHTML = '<p class="text-[#8B5A2B] col-span-2 p-4 italic">Chưa có đề thi nào (hoặc không khớp với bộ lọc). Import từ Excel hoặc tạo mới.</p>';
      return;
    }

    qList.forEach(q => {
      const card = document.createElement('div');
      card.className = `p-5 rounded-3xl border-2 shadow-xs transition flex flex-col justify-between ${q.active ? 'bg-[rgba(139,90,43,0.9)] border-[#4A240A] text-white relative overflow-hidden' : 'bg-[rgba(255,255,255,0.7)] border-[#8B5A2B] text-[#4A240A]'
        }`;
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-3.5">
            <span class="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${q.active ? 'bg-[#FFD700] text-[#2B1607] border-2 border-[#4A240A]' : 'bg-[#F9F5F0] text-[#8B5A2B] border-2 border-[#8B5A2B]'
        }">Tháng ${q.month_no || 1} • Tuần ${q.week_no}</span>
            <div class="flex items-center space-x-1.5 text-xs font-bold">
              <input type="checkbox" class="quiz-toggle-active-chk cursor-pointer w-4 h-4 rounded border-2 border-[#4A240A]" data-id="${q.id}" ${q.active ? 'checked' : ''} />
              <span>Kích hoạt</span>
            </div>
          </div>
          <h3 class="font-extrabold text-sm leading-snug font-['Space_Grotesk']">${q.title}</h3>
          <div class="mt-2.5 text-[11px] font-semibold opacity-80 space-y-1">
            <p class="flex items-center gap-1.5"><span class="text-xs">👤</span> ${participantCounts[q.id]?.participants || 0} người tham gia</p>
            <p class="flex items-center gap-1.5"><span class="text-xs">🎯</span> ${participantCounts[q.id]?.plays || 0} lượt chơi</p>
            <p class="flex items-center gap-1.5"><span class="text-xs">⭐</span> Tổng điểm trung bình: ${participantCounts[q.id]?.avgScore || 0}</p>
          </div>
        </div>
        <div class="flex items-center justify-between pt-4 border-t-2 border-dashed ${q.active ? 'border-[rgba(255,255,255,0.3)]' : 'border-[rgba(139,90,43,0.3)]'}">
          <div class="flex gap-2">
            <button class="view-q-questions-btn px-3 py-1.5 border-2 text-[10px] font-bold rounded-xl transition cursor-pointer ${q.active ? 'bg-[rgba(255,255,255,0.15)] text-white border-white hover:bg-[rgba(255,255,255,0.25)]' : 'bg-[#F9F5F0] text-[#4A240A] border-[#8B5A2B] hover:bg-[#E9C691]'
          }" data-id="${q.id}" data-title="${q.title}" data-week="${q.week_no}" data-month="${q.month_no || 1}" data-streak="${q.streak_day || ''}">✏️ Chỉnh sửa</button>
            <button class="reset-quiz-btn px-2 py-1.5 border-2 text-[10px] font-bold rounded-xl transition cursor-pointer ${q.active ? 'bg-[rgba(255,165,0,0.3)] text-white border-orange-400 hover:bg-[rgba(255,165,0,0.5)]' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
          }" data-id="${q.id}">🔄 Lịch sử</button>
          </div>
          <button class="delete-quiz-btn px-2 py-1.5 text-[10px] font-bold rounded-xl transition flex items-center gap-1 cursor-pointer border-2 ${q.active ? 'bg-[rgba(222,58,59,0.3)] text-white border-[#DE3A3B] hover:bg-[rgba(222,58,59,0.5)]' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
        }" data-id="${q.id}">🗑️ Xóa đề</button>
        </div>
      `;
      targetContainer.appendChild(card);
    });

    document.querySelectorAll('.quiz-toggle-active-chk').forEach(chk => {
      chk.addEventListener('change', async () => {
        const qId = chk.getAttribute('data-id');
        await db.adminToggleQuizActive(qId, chk.checked);
        fetchAndRenderQuizzes();
      });
    });

    document.querySelectorAll('.view-q-questions-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        const week = btn.getAttribute('data-week');
        const month = btn.getAttribute('data-month');
        const streakDay = btn.getAttribute('data-streak');
        showQuizQuestions(qId, title, week, month, streakDay);
      });
    });

    document.querySelectorAll('.delete-quiz-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Xóa đề thi này? Tất cả câu hỏi và đáp án liên quan sẽ bị xóa.')) {
          const qId = btn.getAttribute('data-id');
          await db.adminDeleteQuiz(qId);
          if (quizQuestionsBox && !quizQuestionsBox.classList.contains('hidden') && currentExpandedQuizId === qId) {
            quizQuestionsBox.classList.add('hidden');
          }
          fetchAndRenderQuizzes();
        }
      });
    });

    document.querySelectorAll('.reset-quiz-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qId = btn.getAttribute('data-id');
        if (confirm('Bạn có chắc chắn muốn XÓA SẠCH LỊCH SỬ CHƠI của bộ đề này không?\nToàn bộ lượt thi, số người tham gia và điểm trung bình sẽ bị đưa về 0 (nhưng bộ câu hỏi vẫn được giữ nguyên).')) {
          const originalText = btn.innerHTML;
          btn.innerHTML = '⏳ Đang reset...';
          btn.disabled = true;
          const res = await db.adminResetQuizHistory(qId);
          if (res && res.success) {
            alert('Đã reset lịch sử chơi thành công!');
          } else {
            alert('Lỗi: ' + (res?.message || 'Không thể reset'));
          }
          fetchAndRenderQuizzes();
        }
      });
    });
    // Render Dashboard Stats Quiz
    const dashboardStatsQuiz = document.getElementById('dashboard_stats_quiz');
    if (dashboardStatsQuiz) {
      db.adminGetDashboardStats().then(stats => {
        dashboardStatsQuiz.innerHTML = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-red-100 border-2 border-red-200 shadow-sm flex flex-col justify-center">
              <p class="text-[10px] font-black uppercase text-red-600 mb-1 tracking-wider">Bộ đề sai nhiều nhất (Chu kỳ)</p>
              <p class="text-sm md:text-base font-bold text-red-900 font-['Space_Grotesk']">${stats.mostWrongQuizTitle}</p>
            </div>
            <div class="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 border-2 border-indigo-200 shadow-sm flex flex-col justify-center">
              <p class="text-[10px] font-black uppercase text-indigo-600 mb-1 tracking-wider">Người bị thách đấu nhiều nhất</p>
              <p class="text-sm md:text-base font-bold text-indigo-900 font-['Space_Grotesk']">${stats.mostAttackedPlayerName}</p>
            </div>
            <div class="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-200 shadow-sm flex flex-col justify-center">
              <p class="text-[10px] font-black uppercase text-emerald-600 mb-1 tracking-wider">Vua Cày Cuốc (Đúng nhất & Nhanh nhất)</p>
              <p class="text-sm md:text-base font-bold text-emerald-900 font-['Space_Grotesk']">${stats.topGrinderName}</p>
            </div>
          </div>
        `;
        dashboardStatsQuiz.classList.remove('hidden');
      });

      // Render Grinder History Table
      const grinderContainer = document.getElementById('grinder_history_container');
      const grinderTbody = document.getElementById('grinder_history_tbody');
      
      if (grinderContainer && grinderTbody) {
        db.adminGetGrinderHistory().then(history => {
          if (history && history.length > 0) {
            grinderContainer.classList.remove('hidden');
            grinderTbody.innerHTML = history.map((item, index) => {
              const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-emerald-50/50';
              const isCurrent = index === 0 ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">MỚI NHẤT</span>' : '';
              return `
                <tr class="${rowClass} border-b border-emerald-50 hover:bg-emerald-100/50 transition">
                  <td class="p-2 font-semibold text-emerald-900 whitespace-nowrap">${item.cycleName} ${isCurrent}</td>
                  <td class="p-2 text-emerald-800 font-medium">🏆 ${item.grinderName}</td>
                  <td class="p-2 text-right font-mono text-xs text-slate-600">
                    <span class="font-bold text-emerald-700">${item.correct} câu</span> <br/>
                    (${db.formatTimeSpent(item.time)})
                  </td>
                </tr>
              `;
            }).join('');
          } else {
            grinderContainer.classList.add('hidden');
          }
        });
      }
    }
  }

  async function showQuizQuestions(quizId, title, weekLabel, monthLabel, streakDay) {
    currentExpandedQuizId = quizId;
    currentExpandedQuizMonth = monthLabel;
    currentExpandedQuizWeek = weekLabel;
    currentExpandedQuizTitle = title;
    currentExpandedQuizStreakDay = streakDay;
    if (selectedQuizSubtitle) selectedQuizSubtitle.textContent = `Tháng ${monthLabel} • Tuần ${weekLabel}`;
    if (selectedQuizTitle) selectedQuizTitle.textContent = title;
    if (quizQuestionsBox) quizQuestionsBox.classList.remove('hidden');
    if (questionsListWrapper) questionsListWrapper.innerHTML = '<p class="text-[#8B5A2B] text-sm">Đang tải câu hỏi...</p>';

    const questions = await db.adminGetQuestions(quizId);
    if (!questionsListWrapper) return;

    if (questions.length === 0) {
      questionsListWrapper.innerHTML = '<p class="text-[#8B5A2B] italic text-sm">Chưa có câu hỏi nào. Thêm mới hoặc import từ file Excel.</p>';
      return;
    }

    questionsListWrapper.innerHTML = '';
    questions.forEach((q, idx) => {
      const div = document.createElement('div');
      div.className = 'p-4 bg-[rgba(255,255,255,0.7)] rounded-2xl border-2 border-[#8B5A2B] shadow-xs';
      div.innerHTML = `
        <div class="flex items-start justify-between gap-3 mb-3">
          <p class="text-xs font-bold text-[#4A240A] flex-1 whitespace-pre-wrap"><span class="text-[#DE3A3B] mr-1 font-['Space_Grotesk']">${idx + 1}.</span>${q.question_text}</p>
          <div class="flex items-center gap-1.5">
            <button class="edit-question-btn p-1.5 bg-[#F9F5F0] border-2 border-[#8B5A2B] text-[#4A240A] rounded-lg hover:bg-[#E9C691] transition inline-flex items-center cursor-pointer text-[10px] font-bold gap-1" data-id="${q.id}" data-qtext="${encodeURIComponent(q.question_text)}" data-point="${q.point || 10}" data-time="${q.time_limit || 15}" data-image="${q.image_url || ''}" data-answers='${JSON.stringify((q.answers || []).map(a => ({ text: a.answer_text, correct: a.is_correct })))}' title="Sửa câu hỏi">✏️ Sửa</button>
            <button class="del-question-btn p-1.5 bg-rose-50 border-2 border-rose-200 text-rose-600 rounded-lg hover:bg-rose-100 transition inline-flex items-center cursor-pointer" data-id="${q.id}" title="Xóa câu hỏi">🗑️</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${(q.answers || []).map(a => `
            <div class="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl border-2 ${a.is_correct ? 'bg-[rgba(60,130,48,0.15)] border-[#3C8230] text-[#3C8230] font-bold' : 'bg-white/50 border-[#8B5A2B] text-[#8B5A2B]'}">
              ${a.is_correct ? '✅' : '○'} ${a.answer_text}
            </div>`).join('')}
        </div>
      `;
      questionsListWrapper.appendChild(div);
    });

    document.querySelectorAll('.del-question-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Xóa câu hỏi này?')) {
          await db.adminDeleteQuestion(btn.getAttribute('data-id'));
          showQuizQuestions(quizId, title, weekLabel, monthLabel);
        }
      });
    });

    // Bind edit question buttons
    const modalEditQuestion = document.getElementById('modal_edit_question');
    const formEditQuestion = document.getElementById('form_edit_question');
    const editQuestionId = document.getElementById('edit_question_id');
    const editQuestionText = document.getElementById('edit_question_text');

    document.querySelectorAll('.edit-question-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-id');
        const qText = decodeURIComponent(btn.getAttribute('data-qtext') || '');
        const qPoint = btn.getAttribute('data-point') || '10';
        const qTime = btn.getAttribute('data-time') || '15';
        const qImage = btn.getAttribute('data-image') || '';
        let answers = [];
        try { answers = JSON.parse(btn.getAttribute('data-answers') || '[]'); } catch (_) { }

        editQuestionId.value = qId;
        editQuestionText.value = qText;
        document.getElementById('edit_question_point').value = qPoint;
        const parsedTime = parseInt(qTime || '15');
        document.getElementById('edit_question_time_m').value = Math.floor(parsedTime / 60);
        document.getElementById('edit_question_time_s').value = parsedTime % 60;
        const imgField = document.getElementById('edit_q_image');
        if (imgField) imgField.value = qImage;

        // Điền đáp án vào các field
        answers.forEach((ans, i) => {
          const field = document.getElementById(`edit_ans_${i}`);
          if (field) field.value = ans.text || '';
          if (ans.correct) {
            const radio = document.querySelector(`input[name="edit_correct_radio"][value="${i}"]`);
            if (radio) radio.checked = true;
          }
        });

        if (modalEditQuestion) modalEditQuestion.classList.remove('hidden');
      });
    });
  }

  if (btnOpenQuizModal) {
    btnOpenQuizModal.addEventListener('click', () => {
      formQuiz.reset();
      const streakFields = document.getElementById('quiz_streak_fields');
      if (streakFields) streakFields.classList.add('hidden');
      modalQuiz.classList.remove('hidden');
    });
  }

  const btnOpenStreakQuizModal = document.getElementById('btn_open_streak_quiz_modal');
  if (btnOpenStreakQuizModal) {
    btnOpenStreakQuizModal.addEventListener('click', () => {
      formQuiz.reset();
      const streakFields = document.getElementById('quiz_streak_fields');
      if (streakFields) streakFields.classList.remove('hidden');
      modalQuiz.classList.remove('hidden');
    });
  }
  if (btnCloseQuizModal) {
    btnCloseQuizModal.addEventListener('click', () => modalQuiz.classList.add('hidden'));
  }

  // Quiz Modal: Edit
  const btnEditQuizInfo = document.getElementById('btn_edit_quiz_info');
  const modalEditQuiz = document.getElementById('modal_edit_quiz');
  const formEditQuiz = document.getElementById('form_edit_quiz');
  const btnCloseEditQuizModal = document.getElementById('btn_close_edit_quiz_modal');

  if (btnEditQuizInfo) {
    btnEditQuizInfo.addEventListener('click', () => {
      document.getElementById('form_edit_quiz_id').value = currentExpandedQuizId;
      document.getElementById('form_edit_quiz_title').value = currentExpandedQuizTitle;
      document.getElementById('form_edit_quiz_month').value = currentExpandedQuizMonth;
      document.getElementById('form_edit_quiz_week').value = currentExpandedQuizWeek;
      
      const streakField = document.getElementById('edit_quiz_streak_fields');
      const streakInput = document.getElementById('form_edit_quiz_streak_day');
      if (currentQuizMode === 'streak') {
        if (streakField) streakField.classList.remove('hidden');
        if (streakInput) streakInput.value = currentExpandedQuizStreakDay || '';
      } else {
        if (streakField) streakField.classList.add('hidden');
        if (streakInput) streakInput.value = '';
      }
      
      modalEditQuiz.classList.remove('hidden');
    });
  }

  if (btnCloseEditQuizModal) {
    btnCloseEditQuizModal.addEventListener('click', () => modalEditQuiz.classList.add('hidden'));
  }

  if (formEditQuiz) {
    formEditQuiz.addEventListener('submit', async (e) => {
      e.preventDefault();
      const qId = document.getElementById('form_edit_quiz_id').value;
      const title = document.getElementById('form_edit_quiz_title').value.trim();
      const month = parseInt(document.getElementById('form_edit_quiz_month').value) || 1;
      const week = parseInt(document.getElementById('form_edit_quiz_week').value) || 1;
      
      const streakInputVal = document.getElementById('form_edit_quiz_streak_day')?.value;
      const streakDay = (currentQuizMode === 'streak' && streakInputVal) ? parseInt(streakInputVal) : null;

      const result = await db.adminUpdateQuiz(qId, { title, month_no: month, week_no: week, streak_day: streakDay });
      if (result.success) {
        modalEditQuiz.classList.add('hidden');
        fetchAndRenderQuizzes();
        showQuizQuestions(qId, title, week, month, streakDay);
      } else {
        alert('Lỗi cập nhật đề thi: ' + result.message);
      }
    });
  }

  if (formQuiz) {
    formQuiz.addEventListener('submit', async (e) => {
      e.preventDefault();
      const streakDayStr = document.getElementById('form_quiz_streak_day')?.value;
      const streakDay = (currentQuizMode === 'streak' && streakDayStr) ? parseInt(streakDayStr) : null;
      const result = await db.adminCreateQuiz({
        title: formQuizTitle.value.trim(),
        month_no: parseInt(document.getElementById('form_quiz_month')?.value || '1'),
        week_no: parseInt(formQuizWeek.value) || 1,
        active: formQuizActive.checked,
        streak_day: streakDay
      });
      if (result.success) {
        showAdminAlert('Tạo đề thành công ✅', `Đề thi "${formQuizTitle.value.trim()}" đã được tạo.`);
        modalQuiz.classList.add('hidden');
        fetchAndRenderQuizzes();
      } else {
        showAdminAlert('Lỗi', result.message || 'Không thể tạo đề thi.');
      }
    });
  }

  // Add Question Modal
  if (btnAddQuestionForm) {
    btnAddQuestionForm.addEventListener('click', () => {
      if (!currentExpandedQuizId) return;
      formQuestionQuizId.value = currentExpandedQuizId;
      formQuestion.reset();
      modalQuestion.classList.remove('hidden');
    });
  }

  if (formQuestion) {
    formQuestion.addEventListener('submit', async (e) => {
      e.preventDefault();
      const qId = formQuestionQuizId.value;
      const qText = formQuestionText.value.trim();
      const answers = [
        document.getElementById('ans_text_0')?.value.trim() || '',
        document.getElementById('ans_text_1')?.value.trim() || '',
        document.getElementById('ans_text_2')?.value.trim() || '',
        document.getElementById('ans_text_3')?.value.trim() || '',
      ];
      const point = parseInt(document.getElementById('form_question_point').value || '10');
      const timeM = parseInt(document.getElementById('form_question_time_m').value || '0');
      const timeS = parseInt(document.getElementById('form_question_time_s').value || '0');
      const timeLimit = (timeM * 60) + timeS || 15;
      const qImage = document.getElementById('input_q_image')?.value.trim() || null;
      const correctRadio = document.querySelector('input[name="correct_answer_radio"]:checked');
      const correctIdx = correctRadio ? parseInt(correctRadio.value) : 0;

      const result = await db.adminCreateQuestion(qId, qText, answers, correctIdx, point, timeLimit, qImage);
      if (result.success) {
        document.getElementById('modal_question').classList.add('hidden');
        const currentQ = await db.adminGetQuizzes().then(qs => qs.find(q => q.id === currentExpandedQuizId));
        showQuizQuestions(qId, currentQ?.title || '', currentQ?.week_no || '');
      } else {
        showAdminAlert('Lỗi', result.message || 'Không thể thêm câu hỏi.');
      }
    });
  }

  const btnCloseQuestion = document.getElementById('btn_close_question_modal');
  if (btnCloseQuestion) {
    btnCloseQuestion.addEventListener('click', () => document.getElementById('modal_question').classList.add('hidden'));
  }

  // Edit Question Modal: Close + Submit
  const modalEditQuestion = document.getElementById('modal_edit_question');
  const formEditQuestion = document.getElementById('form_edit_question');

  const btnCloseEditQuestion = document.getElementById('btn_close_edit_question');
  if (btnCloseEditQuestion) {
    btnCloseEditQuestion.addEventListener('click', () => {
      if (modalEditQuestion) modalEditQuestion.classList.add('hidden');
    });
  }

  if (formEditQuestion) {
    formEditQuestion.addEventListener('submit', async (e) => {
      e.preventDefault();
      const qId = document.getElementById('edit_question_id')?.value;
      const qText = document.getElementById('edit_question_text')?.value.trim();
      const answers = [
        document.getElementById('edit_ans_0')?.value.trim() || '',
        document.getElementById('edit_ans_1')?.value.trim() || '',
        document.getElementById('edit_ans_2')?.value.trim() || '',
        document.getElementById('edit_ans_3')?.value.trim() || '',
      ];
      const point = parseInt(document.getElementById('edit_question_point')?.value || '10');
      const timeM = parseInt(document.getElementById('edit_question_time_m')?.value || '0');
      const timeS = parseInt(document.getElementById('edit_question_time_s')?.value || '0');
      const timeLimit = (timeM * 60) + timeS || 15;
      const correctRadio = document.querySelector('input[name="edit_correct_radio"]:checked');
      const correctIdx = correctRadio ? parseInt(correctRadio.value) : 0;
      const imageUrl = document.getElementById('edit_q_image')?.value.trim() || null;

      const result = await db.adminUpdateQuestion(qId, qText, answers, correctIdx, point, timeLimit, imageUrl);
      if (result.success) {
        if (modalEditQuestion) modalEditQuestion.classList.add('hidden');
        showAdminAlert('Cập nhật thành công ✅', 'Câu hỏi và đáp án đã được lưu.');
        if (currentExpandedQuizId) {
          const currentQ = await db.adminGetQuizzes().then(qs => qs.find(q => q.id === currentExpandedQuizId));
          showQuizQuestions(currentExpandedQuizId, currentQ?.title || '', currentQ?.week_no || '');
        }
      } else {
        showAdminAlert('Lỗi cập nhật', result.message || 'Không thể lưu thay đổi.');
      }
    });
  }

  // ── 3. IMPORT ────────────────────────────────────────────────────────────────
  if (importTypeSelect) {
    importTypeSelect.addEventListener('change', () => {
      const isQuiz = importTypeSelect.value === 'quizzes';
      if (guideUsersCsv) guideUsersCsv.classList.toggle('hidden', isQuiz);
      if (guideQuizzesCsv) guideQuizzesCsv.classList.toggle('hidden', !isQuiz);
      if (wrapperImportQuiz) wrapperImportQuiz.classList.toggle('hidden', !isQuiz);
    });
    // Trigger initially
    importTypeSelect.dispatchEvent(new Event('change'));
  }

  let importedFileRows = null;

  if (csvFileInput) {
    csvFileInput.addEventListener('change', async () => {
      const file = csvFileInput.files[0];
      if (!file) return;
      fileNameDisplay.textContent = file.name;

      try {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const buf = await file.arrayBuffer();
          if (!window.XLSX) throw new Error('SheetJS chưa tải.');
          const wb = window.XLSX.read(new Uint8Array(buf), { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          importedFileRows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
        } else {
          // Đọc file CSV với xử lý encoding thông minh
          // Thử UTF-8 trước, nếu phát hiện ký tự lỗi thì thử windows-1252 (ANSI — Excel VN hay dùng)
          const buf = await file.arrayBuffer();
          let text = new TextDecoder('utf-8').decode(buf);

          // Kiểm tra nếu có ký tự thay thế (U+FFFD) hoặc ký tự lạ → thử lại với ANSI
          if (text.includes('\uFFFD') || /[\x80-\x9F]/.test(text)) {
            text = new TextDecoder('windows-1252').decode(buf);
          }

          importedFileRows = parseCSV(text);

        }
        csvTextareaInput.value = '';
        showAdminAlert('File đã sẵn sàng 📄', `Đã đọc ${importedFileRows.length} dòng từ "${file.name}". Bấm "XỬ LÝ IMPORT" để tiếp tục.`);
      } catch (err) {
        showAdminAlert('Lỗi đọc file', err.message);
        importedFileRows = null;
      }
    });
  }

  if (btnProcessImport) {
    btnProcessImport.addEventListener('click', async () => {
      const type = importTypeSelect ? importTypeSelect.value : 'users';
      btnProcessImport.disabled = true;
      btnProcessImport.textContent = '⏳ Đang xử lý...';

      let rows = importedFileRows;
      if (!rows || rows.length === 0) {
        const rawText = csvTextareaInput ? csvTextareaInput.value.trim() : '';
        if (!rawText) {
          showAdminAlert('Thiếu dữ liệu', 'Vui lòng chọn file hoặc dán dữ liệu CSV vào ô văn bản.');
          btnProcessImport.disabled = false;
          btnProcessImport.textContent = 'XỬ LÝ IMPORT DỮ LIỆU NGAY';
          return;
        }
        rows = parseCSV(rawText);
      }

      try {
        if (type === 'users') {
          // BƯỚC 1: Kiểm tra trùng lặp trước
          btnProcessImport.textContent = '⏳ Đang kiểm tra...';
          const checkResult = await db.adminImportUsersFromRows(rows, 'check');

          if (checkResult.duplicates && checkResult.duplicates.length > 0) {
            // Có trùng → hiển thị danh sách và hỏi xác nhận
            const dupList = checkResult.duplicates.map(d =>
              `• <strong>${d.employee_code}</strong> — ${d.full_name} (${d.department || '—'})`
            ).join('<br>');

            const confirmed = await showImportConfirmDialog(
              checkResult.duplicates.length,
              checkResult.newCount,
              dupList
            );

            if (confirmed === 'update') {
              // Cập nhật cả trùng + tạo mới
              const updateResult = await db.adminImportUsersFromRows(rows, 'update');
              showAdminAlert('Import hoàn tất ✅',
                `Tạo mới: ${updateResult.created} | Cập nhật: ${updateResult.updated}`);
              fetchAndRenderUsers();
            } else if (confirmed === 'new_only') {
              // Chỉ tạo mới, bỏ qua trùng
              const createResult = await db.adminImportUsersFromRows(rows, 'create');
              showAdminAlert('Import hoàn tất ✅',
                `Tạo mới: ${createResult.created} tài khoản. Đã bỏ qua ${checkResult.duplicates.length} tài khoản trùng.`);
              fetchAndRenderUsers();
            }
            // Nếu cancelled: không làm gì
          } else {
            // Không có trùng → tạo mới luôn
            const createResult = await db.adminImportUsersFromRows(rows, 'create');
            showAdminAlert('Import thành công ✅', `Đã tạo mới ${createResult.created} tài khoản.`);
            fetchAndRenderUsers();
          }
        } else if (type === 'quizzes') {
          const quizTitle = document.getElementById('import_quiz_title')?.value.trim();
          const quizMonth = parseInt(document.getElementById('import_quiz_month')?.value || '1');
          const quizWeek = parseInt(document.getElementById('import_quiz_week')?.value || '1');
          
          let streakDay = null;
          if (currentImportQuizMode === 'streak') {
            const streakDayInput = document.getElementById('import_quiz_streak_day');
            if (streakDayInput && streakDayInput.value) {
              streakDay = parseInt(streakDayInput.value);
            } else {
              streakDay = 1; // Default to Day 1
            }
          }

          if (!quizTitle) {
            showAdminAlert('Thiếu tên đề', 'Vui lòng nhập tên đề thi Quiz trước khi import.');
            btnProcessImport.disabled = false;
            btnProcessImport.textContent = 'XỬ LÝ IMPORT DỮ LIỆU NGAY';
            return;
          }

          const result = await db.adminImportQuizFromRows(rows, quizTitle, quizMonth, quizWeek, false, false, streakDay);
          if (result.success) {
            showAdminAlert('Import Quiz thành công ✅', `Đã tạo đề "${quizTitle}" với ${result.importedCount} câu hỏi.`);
            fetchAndRenderQuizzes();
          } else {
            showAdminAlert('Lỗi Import Quiz', result.message || 'Không thể import.');
          }
        }
      } catch (err) {
        showAdminAlert('Lỗi hệ thống', err.message);
      } finally {
        importedFileRows = null;
        btnProcessImport.disabled = false;
        btnProcessImport.textContent = 'XỬ LÝ IMPORT DỮ LIỆU NGAY';
      }
    });
  }

  // Helper: hiển thị dialog xác nhận khi có trùng lặp
  function showImportConfirmDialog(dupCount, newCount, dupListHtml) {
    return new Promise((resolve) => {
      // Tạo modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';

      overlay.innerHTML = `
        <div style="background:#fff;border-radius:20px;padding:24px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);max-height:80vh;display:flex;flex-direction:column;">
          <h3 style="font-size:16px;font-weight:900;color:#1e293b;margin:0 0 8px">⚠️ Phát hiện Tài Khoản Trùng</h3>
          <p style="font-size:12px;color:#64748b;margin:0 0 12px">
            Tìm thấy <strong style="color:#E07242">${dupCount} tài khoản đã tồn tại</strong> và <strong style="color:#10b981">${newCount} tài khoản mới</strong>. Hãy chọn cách xử lý:
          </p>
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px;font-size:11px;line-height:1.8;max-height:200px;overflow-y:auto;margin-bottom:16px;color:#1e293b">
            <strong style="display:block;margin-bottom:4px">Danh sách trùng:</strong>
            ${dupListHtml}
          </div>
          <div style="display:flex;gap:8px;flex-direction:column">
            <button id="import_confirm_update" style="background:linear-gradient(135deg,#E07242,#E5853F);color:#fff;font-weight:800;padding:12px;border-radius:12px;border:none;cursor:pointer;font-size:12px">
              ✅ Cập nhật TÀI KHOẢN TRÙNG + Tạo mới tài khoản còn lại
            </button>
            <button id="import_confirm_new_only" style="background:#f1f5f9;color:#334155;font-weight:700;padding:10px;border-radius:12px;border:1px solid #e2e8f0;cursor:pointer;font-size:12px">
              ➕ Chỉ tạo ${newCount} tài khoản mới, bỏ qua trùng
            </button>
            <button id="import_confirm_cancel" style="background:transparent;color:#94a3b8;font-weight:600;padding:8px;border-radius:12px;border:none;cursor:pointer;font-size:11px">
              Hủy — Không làm gì
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('#import_confirm_update').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve('update');
      });
      overlay.querySelector('#import_confirm_new_only').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve('new_only');
      });
      overlay.querySelector('#import_confirm_cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve('cancel');
      });
    });
  }

  // ── 4. EXPORT ────────────────────────────────────────────────────────────────
  const btnExportScores = document.getElementById('btn_export_scores');
  if (btnExportScores) {
    btnExportScores.addEventListener('click', async () => {
      btnExportScores.disabled = true;
      btnExportScores.textContent = '⏳ Đang xuất...';
      try {
        await db.adminExportScoresXLSX('total');
        showAdminAlert('Xuất thành công ✅', 'File báo cáo điểm đã được tải về máy.');
      } catch (err) {
        showAdminAlert('Lỗi', 'Không thể xuất file: ' + err.message);
      } finally {
        btnExportScores.disabled = false;
        btnExportScores.textContent = '⬇️ XUẤT BÁO CÁO (.xlsx)';
      }
    });
  }

  const btnExportAccounts = document.getElementById('btn_export_accounts');
  if (btnExportAccounts) {
    btnExportAccounts.addEventListener('click', async () => {
      btnExportAccounts.disabled = true;
      try {
        await exportAccountsAsCSV();
        showAdminAlert('Xuất thành công ✅', 'File accounts.csv đã được tải về máy.');
      } catch (err) {
        showAdminAlert('Lỗi', err.message);
      } finally {
        btnExportAccounts.disabled = false;
      }
    });
  }

  // ── 5. SETTINGS (MODULE STATUS, MULTIPLIER) ────────────────────────
  const inputModule1Status = document.getElementById('input_module1_status');
  const btnSaveModule1Status = document.getElementById('btn_save_module1_status');
  
  const inputModule2Status = document.getElementById('input_module2_status');
  const btnSaveModule2Status = document.getElementById('btn_save_module2_status');

  const inputRandomizeQuestions = document.getElementById('input_randomize_questions');
  const btnSaveRandomizeQuestions = document.getElementById('btn_save_randomize_questions');

  const inputWheelStatus = document.getElementById('input_wheel_status');
  const btnSaveWheelStatus = document.getElementById('btn_save_wheel_status');

  const inputStealWinMultiplier = document.getElementById('input_steal_win_multiplier');
  const inputStealLoseMultiplier = document.getElementById('input_steal_lose_multiplier');
  const inputStealWinBase = document.getElementById('input_steal_win_base');
  const inputStealLoseBase = document.getElementById('input_steal_lose_base');
  const inputMaxSteals = document.getElementById('input_max_steals');
  const checkboxInfiniteSteals = document.getElementById('checkbox_infinite_steals');
  const inputStealMessage = document.getElementById('input_steal_message');
  const inputMinPlaysToUnlock = document.getElementById('input_min_plays_to_unlock');
  const btnSaveMultiplier = document.getElementById('btn_save_multiplier');

  // Load Settings
  if (inputModule1Status) {
    db.getModule1Status().then(isOn => inputModule1Status.value = isOn ? 'ON' : 'OFF');
    const inputMode1MaxPlays = document.getElementById('input_mode1_max_plays');
    const inputMode1CycleDays = document.getElementById('input_mode1_cycle_days');
    const inputMode1BasePoint = document.getElementById('input_mode1_base_point');

    db.getSettingValue('mode1_max_plays').then(val => { if(val && inputMode1MaxPlays) inputMode1MaxPlays.value = val; });
    db.getSettingValue('mode1_cycle_days').then(val => { if(val && inputMode1CycleDays) inputMode1CycleDays.value = val; });
    db.getSettingValue('mode1_base_point').then(val => { if(val && inputMode1BasePoint) inputMode1BasePoint.value = val; });
  }
  if (inputModule2Status) db.getModule2Status().then(isOn => inputModule2Status.value = isOn ? 'ON' : 'OFF');
  if (inputRandomizeQuestions) db.getRandomizeQuestionsStatus().then(isOn => inputRandomizeQuestions.value = isOn ? 'ON' : 'OFF');
  const inputTutorialVideo = document.getElementById('input_tutorial_video');
  const btnSaveTutorialVideo = document.getElementById('btn_save_tutorial_video');
  if (inputTutorialVideo) db.getTutorialVideoUrl().then(url => inputTutorialVideo.value = url || '');
  if (inputStealMessage) db.getSettingValue('steal_message').then(msg => inputStealMessage.value = msg || '');
  if (inputMinPlaysToUnlock) db.getSettingValue('min_plays_to_unlock_steal').then(val => { if (val) inputMinPlaysToUnlock.value = val; });

  if (inputMaxSteals && checkboxInfiniteSteals) {
    db.getMaxStealsPerDay().then(val => {
      if (val >= 999999) {
        checkboxInfiniteSteals.checked = true;
        inputMaxSteals.value = 999999;
        inputMaxSteals.disabled = true;
        inputMaxSteals.classList.add('opacity-50');
      } else {
        checkboxInfiniteSteals.checked = false;
        inputMaxSteals.value = val;
        inputMaxSteals.disabled = false;
        inputMaxSteals.classList.remove('opacity-50');
      }
    });

    checkboxInfiniteSteals.addEventListener('change', (e) => {
      if (e.target.checked) {
        inputMaxSteals.value = 999999;
        inputMaxSteals.disabled = true;
        inputMaxSteals.classList.add('opacity-50');
      } else {
        inputMaxSteals.value = 3;
        inputMaxSteals.disabled = false;
        inputMaxSteals.classList.remove('opacity-50');
      }
    });
  }

  // Add click listener for saving the video URL
  if (btnSaveTutorialVideo && inputTutorialVideo) {
    btnSaveTutorialVideo.addEventListener('click', async () => {
      let url = inputTutorialVideo.value.trim();
      
      // Auto convert normal youtube links to embed links
      if (url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
          url = 'https://www.youtube.com/embed/' + match[2];
          inputTutorialVideo.value = url; // Update input field to show the new URL
        }
      }

      const result = await db.updateTutorialVideoUrl(url);
      if (result.success) showAdminAlert('Đã lưu ✅', `Link video: ${url || '(Trống)'}`);
      else showAdminAlert('Lỗi', result.message || 'Không thể lưu.');
    });
  }
  if (inputWheelStatus) db.getWheelStatus().then(isOn => inputWheelStatus.value = isOn ? 'ON' : 'OFF');
  if (inputStealWinMultiplier && inputStealLoseMultiplier) {
    db.getStealMultipliers().then(m => {
      inputStealWinMultiplier.value = m.win;
      inputStealLoseMultiplier.value = m.lose;
    });
  }
  if (inputStealWinBase && inputStealLoseBase) {
    db.getStealBasePoints().then(b => {
      inputStealWinBase.value = b.win;
      inputStealLoseBase.value = b.lose;
    });
  }
  if (inputMaxSteals) db.getMaxStealsPerDay().then(val => inputMaxSteals.value = val);

  // Save Settings
  if (btnSaveModule1Status && inputModule1Status) {
    btnSaveModule1Status.addEventListener('click', async () => {
      const inputMode1MaxPlays = document.getElementById('input_mode1_max_plays');
      const inputMode1CycleDays = document.getElementById('input_mode1_cycle_days');
      const inputMode1BasePoint = document.getElementById('input_mode1_base_point');
      const maxPlays = inputMode1MaxPlays ? inputMode1MaxPlays.value : "3";
      const cycleDays = inputMode1CycleDays ? inputMode1CycleDays.value : "3";
      const basePoint = inputMode1BasePoint ? inputMode1BasePoint.value : "10";
      
      const r1 = await db.updateModule1Status(inputModule1Status.value);
      const r2 = await db.updateSettingStatus('mode1_max_plays', maxPlays);
      const r3 = await db.updateSettingStatus('mode1_cycle_days', cycleDays);
      const r5 = await db.updateSettingStatus('mode1_base_point', basePoint);
      
      if (r1.success && r2.success && r3.success && r5.success) showAdminAlert('Đã lưu ✅', `Trạng thái Module 1: ${inputModule1Status.value}\nCấu hình: ${maxPlays} lượt / ${cycleDays} ngày.\nĐiểm/câu: ${basePoint} điểm`);
      else showAdminAlert('Lỗi', r1.message || 'Không thể lưu.');
    });
  }

  if (btnSaveModule2Status && inputModule2Status) {
    btnSaveModule2Status.addEventListener('click', async () => {
      const result = await db.updateModule2Status(inputModule2Status.value);
      if (result.success) showAdminAlert('Đã lưu ✅', `Trạng thái Module 2: ${inputModule2Status.value}`);
      else showAdminAlert('Lỗi', result.message || 'Không thể lưu.');
    });
  }

  if (btnSaveRandomizeQuestions && inputRandomizeQuestions) {
    btnSaveRandomizeQuestions.addEventListener('click', async () => {
      const result = await db.updateRandomizeQuestionsStatus(inputRandomizeQuestions.value);
      if (result.success) showAdminAlert('Đã lưu ✅', `Trạng thái Xáo Câu Hỏi: ${inputRandomizeQuestions.value}`);
      else showAdminAlert('Lỗi', result.message || 'Không thể lưu.');
    });
  }

  if (btnSaveWheelStatus && inputWheelStatus) {
    btnSaveWheelStatus.addEventListener('click', async () => {
      const result = await db.updateWheelStatus(inputWheelStatus.value);
      if (result.success) showAdminAlert('Đã lưu ✅', `Trạng thái Vòng Quay: ${inputWheelStatus.value}`);
      else showAdminAlert('Lỗi', result.message || 'Không thể lưu.');
    });
  }

  if (btnSaveMultiplier && inputStealWinMultiplier && inputStealLoseMultiplier && inputMaxSteals && inputStealWinBase && inputStealLoseBase) {
    btnSaveMultiplier.addEventListener('click', async () => {
      const winVal = parseFloat(inputStealWinMultiplier.value);
      const loseVal = parseFloat(inputStealLoseMultiplier.value);
      const winBase = parseInt(inputStealWinBase.value);
      const loseBase = parseInt(inputStealLoseBase.value);
      const maxSteals = parseInt(inputMaxSteals.value);
      const stealMsg = inputStealMessage ? inputStealMessage.value.trim() : '';
      const minPlaysToUnlock = inputMinPlaysToUnlock ? parseInt(inputMinPlaysToUnlock.value) : 1;
      
      if (isNaN(winVal) || winVal <= 0 || isNaN(loseVal) || loseVal <= 0 || 
          isNaN(winBase) || winBase <= 0 || isNaN(loseBase) || loseBase <= 0 || 
          isNaN(maxSteals) || maxSteals < 1 || isNaN(minPlaysToUnlock) || minPlaysToUnlock < 1) { 
        showAdminAlert('Lỗi', 'Thông số không hợp lệ'); return; 
      }
      
      const r1 = await db.updateStealMultipliers(winVal, loseVal);
      const r2 = await db.updateStealBasePoints(winBase, loseBase);
      const r3 = await db.updateMaxStealsPerDay(maxSteals);
      await db.updateSettingStatus('steal_message', stealMsg);
      const r5 = await db.updateSettingStatus('min_plays_to_unlock_steal', minPlaysToUnlock);
      
      if (r1.success && r2.success && r3.success && r5) {
        const stealLimitTxt = maxSteals >= 999999 ? "Vô hạn" : `${maxSteals} lượt/ngày`;
        showAdminAlert('Đã lưu ✅', `Thắng: x${winVal}(${winBase}đ) | Thua: x${loseVal}(${loseBase}đ) | Giới hạn: ${stealLimitTxt}\nMở khóa: ${minPlaysToUnlock} lượt Cày cuốc`);
      } else {
        showAdminAlert('Lỗi', 'Không thể lưu cấu hình.');
      }
    });
  }

  // ── 6. LOGOUT ────────────────────────────────────────────────────────────────
  const btnLogoutAdmin = document.getElementById('btn_logout_admin');
  if (btnLogoutAdmin) {
    btnLogoutAdmin.addEventListener('click', () => {
      sessionStorage.removeItem('current_user');
      sessionStorage.removeItem('current_quiz_id');
      window.location.replace('/login.html');
    });
  }

  // ── 7. HISTORY MANAGEMENT ───────────────────────────────────────────────────
  const historyTableBody = document.getElementById('history_table_body');
  const btnRefreshHistory = document.getElementById('btn_refresh_history');
  const modalWrongAnswers = document.getElementById('modal_wrong_answers');
  const btnCloseWrongAnswers = document.getElementById('btn_close_wrong_answers');
  const wrongAnswersList = document.getElementById('wrong_answers_list');

  if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', fetchAndRenderHistory);
  if (btnCloseWrongAnswers) btnCloseWrongAnswers.addEventListener('click', () => modalWrongAnswers.classList.add('hidden'));

  // History Filter Inputs
  const filterHistorySearch = document.getElementById('filter_history_search');
  const filterHistoryQuiz = document.getElementById('filter_history_quiz');
  const filterHistoryMonth = document.getElementById('filter_history_month');
  const filterHistoryWeek = document.getElementById('filter_history_week');
  const btnClearHistoryFilter = document.getElementById('btn_clear_history_filter');

  const triggerHistoryFilter = () => fetchAndRenderHistory();

  if (filterHistorySearch) filterHistorySearch.addEventListener('input', triggerHistoryFilter);
  if (filterHistoryQuiz) filterHistoryQuiz.addEventListener('change', triggerHistoryFilter);
  if (filterHistoryMonth) filterHistoryMonth.addEventListener('input', triggerHistoryFilter);
  if (filterHistoryWeek) filterHistoryWeek.addEventListener('input', triggerHistoryFilter);

  if (btnClearHistoryFilter) {
    btnClearHistoryFilter.addEventListener('click', () => {
      if (filterHistorySearch) filterHistorySearch.value = '';
      if (filterHistoryQuiz) filterHistoryQuiz.value = '';
      if (filterHistoryMonth) filterHistoryMonth.value = '';
      if (filterHistoryWeek) filterHistoryWeek.value = '';
      fetchAndRenderHistory();
    });
  }

  // Steal History Elements
  const stealHistoryTableBody = document.getElementById('steal_history_table_body');
  const btnRefreshHistorySteal = document.getElementById('btn_refresh_history_steal');
  const filterHistorySearchSteal = document.getElementById('filter_history_search_steal');
  const btnClearHistoryFilterSteal = document.getElementById('btn_clear_history_filter_steal');

  const triggerHistoryFilterSteal = () => fetchAndRenderStealHistory();
  if (btnRefreshHistorySteal) btnRefreshHistorySteal.addEventListener('click', fetchAndRenderStealHistory);
  if (filterHistorySearchSteal) filterHistorySearchSteal.addEventListener('input', triggerHistoryFilterSteal);
  if (btnClearHistoryFilterSteal) {
    btnClearHistoryFilterSteal.addEventListener('click', () => {
      if (filterHistorySearchSteal) filterHistorySearchSteal.value = '';
      fetchAndRenderStealHistory();
    });
  }

  async function fetchAndRenderHistory() {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-400 italic">Đang tải lịch sử...</td></tr>';

    // Load quiz options for filter if empty
    if (filterHistoryQuiz && filterHistoryQuiz.options.length <= 1) {
      const allQuizzes = await db.adminGetQuizzes();
      allQuizzes.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.id;
        opt.textContent = q.title;
        filterHistoryQuiz.appendChild(opt);
      });
    }

    let historyData = await db.adminGetPlayHistory();

    // Apply filters
    const searchVal = filterHistorySearch?.value.toLowerCase().trim() || '';
    const quizVal = filterHistoryQuiz?.value;
    const monthVal = filterHistoryMonth?.value;
    const weekVal = filterHistoryWeek?.value;

    if (searchVal) {
      historyData = historyData.filter(row => {
        const name = row.users?.full_name?.toLowerCase() || '';
        const code = row.users?.employee_code?.toLowerCase() || '';
        return name.includes(searchVal) || code.includes(searchVal);
      });
    }

    if (quizVal) {
      historyData = historyData.filter(row => row.quiz_id === quizVal);
    }
    if (monthVal) {
      historyData = historyData.filter(row => row.quizzes?.month_no == monthVal);
    }
    if (weekVal) {
      historyData = historyData.filter(row => row.quizzes?.week_no == weekVal);
    }

    // Hiển thị Dashboard
    const dashboardContainer = document.getElementById('dashboard_stats');
    if (dashboardContainer) {
      if (quizVal && historyData.length > 0) {
        dashboardContainer.classList.remove('hidden');
        await renderDashboard(historyData, quizVal, dashboardContainer);
      } else {
        dashboardContainer.classList.add('hidden');
        dashboardContainer.innerHTML = '';
      }
    }

    // Lọc theo currentHistoryMode
    if (currentHistoryMode === 'streak') {
      historyData = historyData.filter(row => row.quizzes?.streak_day != null);
    } else {
      historyData = historyData.filter(row => row.quizzes?.streak_day == null);
    }

    if (historyData.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-[#8B5A2B] italic">Chưa có lượt chơi nào.</td></tr>';
      return;
    }

    historyTableBody.innerHTML = '';
    historyData.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-[rgba(139,90,43,0.1)] transition';
      const playedDate = new Date(row.played_at).toLocaleString('vi-VN');
      const userName = row.users ? row.users.full_name : 'N/A';
      const userCode = row.users ? row.users.employee_code : '';
      const quizTitle = row.quizzes ? row.quizzes.title : 'Quiz';

      tr.innerHTML = `
        <td class="py-3 px-4 font-semibold text-[#593113]">${playedDate}</td>
        <td class="py-3 px-4">
          <p class="font-bold text-[#4A240A]">${userName}</p>
          <p class="text-[10px] text-[#8B5A2B]">${userCode}</p>
        </td>
        <td class="py-3 px-4 font-bold text-[#1C5D9F]">${quizTitle}</td>
        <td class="py-3 px-4 text-center font-black text-[#D39B1E]">${row.score}</td>
        <td class="py-3 px-4 text-center">
          <span class="text-[#3C8230] font-bold">${row.correct_count || 0}</span>
          <span class="text-[rgba(139,90,43,0.3)] mx-1">/</span>
          <span class="text-[#DE3A3B] font-bold">${row.wrong_count || 0}</span>
        </td>
        <td class="py-3 px-4 text-center text-[#8B5A2B] font-semibold">${db.formatTimeSpent(row.time_spent)}</td>
        <td class="py-3 px-4 text-center">
          <button class="btn-view-wrong px-2.5 py-1 bg-[#F9F5F0] border-2 border-[#8B5A2B] text-[#4A240A] hover:bg-[#E9C691] rounded-lg text-[10px] font-bold transition cursor-pointer" data-wrong='${JSON.stringify(row.wrong_answers || []).replace(/'/g, "&#39;")}'>Chi tiết</button>
        </td>
      `;
      historyTableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-view-wrong').forEach(btn => {
      btn.addEventListener('click', () => {
        let wrongArr = [];
        try { wrongArr = JSON.parse(btn.getAttribute('data-wrong') || '[]'); } catch (e) { }

        if (wrongArr.length === 0) {
          wrongAnswersList.innerHTML = '<p class="text-[#3C8230] font-bold text-center py-4">Tuyệt vời! Người chơi không sai câu nào.</p>';
        } else {
          wrongAnswersList.innerHTML = wrongArr.map((w, idx) => `
            <div class="p-4 bg-[rgba(255,255,255,0.7)] rounded-2xl border-2 border-[#8B5A2B]">
              <p class="font-bold text-[#4A240A] mb-2"><span class="text-[#DE3A3B] mr-1">Q${idx + 1}.</span> ${w.question}</p>
              <div class="flex flex-col gap-1.5 text-xs">
                <p class="text-[#DE3A3B]"><span class="font-bold">Đã chọn:</span> ${w.selected}</p>
                <p class="text-[#3C8230]"><span class="font-bold">Đáp án đúng:</span> ${w.correct}</p>
              </div>
            </div>
          `).join('');
        }
        modalWrongAnswers.classList.remove('hidden');
      });
    });
  }

  async function fetchAndRenderStealHistory() {
    if (!stealHistoryTableBody) return;
    stealHistoryTableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-400 italic">Đang tải lịch sử thách đấu...</td></tr>';

    let historyData = await db.adminGetStealHistory();

    const searchVal = filterHistorySearchSteal?.value.toLowerCase().trim() || '';
    if (searchVal) {
      historyData = historyData.filter(row => {
        const attackerName = row.attacker?.full_name?.toLowerCase() || '';
        const defenderName = row.defender?.full_name?.toLowerCase() || '';
        return attackerName.includes(searchVal) || defenderName.includes(searchVal);
      });
    }

    if (!historyData || historyData.length === 0) {
      stealHistoryTableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-[#8B5A2B] italic">Chưa có lượt thách đấu nào.</td></tr>';
      return;
    }

    stealHistoryTableBody.innerHTML = '';
    historyData.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-[rgba(139,90,43,0.1)] transition';
      const createdDate = new Date(row.created_at).toLocaleString('vi-VN');
      
      const attackerName = row.attacker ? row.attacker.full_name : 'N/A';
      const attackerDept = row.attacker ? row.attacker.department : '';
      
      const defenderName = row.defender ? row.defender.full_name : 'N/A';
      const defenderDept = row.defender ? row.defender.department : '';

      const isSuccess = row.is_success;
      const resultHtml = isSuccess
        ? '<span class="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px]">Cướp thành công</span>'
        : '<span class="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Thủ thành công</span>';

      const formatTime = (ms) => {
        const m = parseInt(ms) || 0;
        const sec = Math.floor(m / 1000);
        const milli = String(m % 1000).padStart(3, '0');
        return `${sec}s${milli}'`;
      };

      const atkTime = formatTime(row.attacker_time_spent);
      const defTime = formatTime(row.defender_time_spent);

      tr.innerHTML = `
        <td class="py-3 px-4 font-semibold text-[#593113]">${createdDate}</td>
        <td class="py-3 px-4">
          <p class="font-bold text-[#DE3A3B]">${attackerName}</p>
          <p class="text-[10px] text-[#8B5A2B]">${attackerDept}</p>
        </td>
        <td class="py-3 px-4">
          <p class="font-bold text-[#3C8230]">${defenderName}</p>
          <p class="text-[10px] text-[#8B5A2B]">${defenderDept}</p>
        </td>
        <td class="py-3 px-4 text-center">
          ${resultHtml}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="text-[#DE3A3B] font-bold">${row.attacker_correct_count || 0}</span>
          <span class="text-[rgba(139,90,43,0.3)] mx-1">/</span>
          <span class="text-[#3C8230] font-bold">${row.defender_correct_count || 0}</span>
        </td>
        <td class="py-3 px-4 text-center text-[#8B5A2B] font-semibold">
          <span class="text-[#DE3A3B]">${atkTime}</span> / <span class="text-[#3C8230]">${defTime}</span>
        </td>
      `;
      stealHistoryTableBody.appendChild(tr);
    });
  }

  async function renderDashboard(historyData, quizId, container) {
    container.innerHTML = '<p class="text-center text-[#8B5A2B] text-xs py-4">Đang tính toán thống kê...</p>';
    
    const questions = await db.adminGetQuestions(quizId);
    if (!questions || questions.length === 0) {
      container.innerHTML = '<p class="text-center text-[#DE3A3B] text-xs py-4">Không tìm thấy dữ liệu câu hỏi cho đề thi này.</p>';
      return;
    }

    const totalPlays = historyData.length;
    let totalTime = 0;
    
    // Khởi tạo map đếm lỗi
    const wrongCountsByQuestion = {};
    questions.forEach(q => {
      wrongCountsByQuestion[q.question_text.trim()] = 0;
    });

    historyData.forEach(row => {
      const val = parseFloat(row.time_spent) || 0;
      const ms = (val > 0 && val < 500) ? val * 1000 : val;
      totalTime += ms;
      const wrongs = row.wrong_answers || [];
      wrongs.forEach(w => {
        const qText = (w.question || '').trim();
        const matchedKey = Object.keys(wrongCountsByQuestion).find(k => k === qText || k.includes(qText) || qText.includes(k));
        if (matchedKey) {
          wrongCountsByQuestion[matchedKey]++;
        }
      });
    });

    const avgTime = totalPlays > 0 ? db.formatTimeSpent(totalTime / totalPlays) : '0.000s';

    let statsHtml = `
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="card-wood p-4 rounded-2xl flex flex-col items-center justify-center">
          <span class="text-[10px] uppercase font-bold text-[#FFD700] tracking-wider">Tổng số lượt thi</span>
          <span class="text-3xl font-black text-[#FFF8E7] font-['Space_Grotesk']">${totalPlays}</span>
        </div>
        <div class="card-wood p-4 rounded-2xl flex flex-col items-center justify-center">
          <span class="text-[10px] uppercase font-bold text-[#FFD700] tracking-wider">Thời gian TB / lượt</span>
          <span class="text-3xl font-black text-[#FFF8E7] font-['Space_Grotesk']">${avgTime}</span>
        </div>
      </div>
      <div class="bg-[rgba(255,255,255,0.7)] border-2 border-[#8B5A2B] rounded-2xl p-5">
        <h3 class="text-xs font-bold text-[#8B5A2B] mb-4 uppercase tracking-wide">Tỉ lệ Đúng / Sai theo từng câu</h3>
        <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
    `;

    questions.forEach((q, idx) => {
      const qText = q.question_text.trim();
      const wrongs = wrongCountsByQuestion[qText] || 0;
      const corrects = totalPlays - wrongs;
      const correctRatio = Math.round((corrects / totalPlays) * 100) || 0;
      const wrongRatio = 100 - correctRatio;

      statsHtml += `
        <div>
          <div class="flex justify-between items-end mb-1.5 gap-2">
            <span class="text-[11px] font-bold text-[#4A240A] flex-1 leading-snug" title="${qText}">Câu ${idx + 1}: ${qText}</span>
            <span class="text-[10px] font-bold ${correctRatio >= 50 ? 'text-[#3C8230]' : 'text-[#DE3A3B]'} whitespace-nowrap">${correctRatio}% Đúng</span>
          </div>
          <div class="w-full bg-[#E9C691] border-2 border-[#8B5A2B] rounded-full h-2 flex overflow-hidden">
            <div class="bg-[#3C8230] h-2 transition-all duration-500" style="width: ${correctRatio}%"></div>
            <div class="bg-[#DE3A3B] h-2 transition-all duration-500" style="width: ${wrongRatio}%"></div>
          </div>
          <div class="flex justify-between mt-1 text-[9px] text-[#8B5A2B] font-semibold">
            <span>Đúng: ${corrects}</span>
            <span>Sai: ${wrongs}</span>
          </div>
        </div>
      `;
    });

    statsHtml += `
        </div>
      </div>
    `;

    container.innerHTML = statsHtml;
  }

  // ── Search functionality ───────────────────────────────────────────────────────
  const inputSearchUser = document.getElementById('input_search_user');
  if (inputSearchUser) {
    inputSearchUser.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      const usersTableBody = document.getElementById('users_table_body');
      if (!usersTableBody) return;
      const rows = usersTableBody.querySelectorAll('tr');
      rows.forEach(row => {
        if (row.cells.length < 9) return; // Skip loading/empty rows
        const acc = row.cells[0].textContent.toLowerCase();
        const name = row.cells[1].textContent.toLowerCase();
        const mega = row.cells[4].textContent.toLowerCase();
        
        if (acc.includes(searchTerm) || name.includes(searchTerm) || mega.includes(searchTerm)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  // ── Initial render ───────────────────────────────────────────────────────────
  fetchAndRenderUsers();

  // ── EXPORT GLOBAL FUNCTIONS ──────────────────────────────────────────────────
  // Removed undefined global function assignments that were causing ReferenceError crashes
  
  // ── LUCKY DRAW LOGIC ────────────────────────────────────────────────────────
  const luckyMegaDisplay = document.getElementById('lucky_mega_display');
  const luckyWinnerName = document.getElementById('lucky_winner_name');
  const btnStartLuckyDraw = document.getElementById('btn_start_lucky_draw');
  const btnResetLuckyDraw = document.getElementById('btn_reset_lucky_draw');
  const luckyWinnersList = document.getElementById('lucky_winners_list');
  const confettiContainer = document.getElementById('confetti_container');
  
  let luckyDrawInterval = null;
  let luckyDrawPool = [];
  let luckyDrawWinners = [];

  async function loadLuckyDrawPool() {
    const users = await db.getLeaderboard();
    const totalUsers = users ? users.length : 0;
    // Chỉ lấy những người ĐÃ THAM GIA chơi (has_participated) và có mã MEGA
    luckyDrawPool = (users || []).filter(u => u.has_participated && u.mega_code !== null && u.mega_code !== undefined && String(u.mega_code).trim() !== '');
    return { total: totalUsers, valid: luckyDrawPool.length };
  }

  window.startLuckyDrawGlobal = function() {
    startLuckyDraw();
  };

  function startLuckyDraw() {
    if (btnStartLuckyDraw) {
      btnStartLuckyDraw.textContent = '⏳ ĐANG TẢI...';
      btnStartLuckyDraw.disabled = true;
    }
    if (luckyDrawPool.length === 0) {
      loadLuckyDrawPool().then((stats) => {
        if (luckyDrawPool.length === 0) {
          alert(`Không thể quay! Bảng xếp hạng có ${stats.total} người, nhưng KHÔNG CÓ AI có mã MEGA hợp lệ (khác rỗng). Vui lòng kiểm tra lại cột mega_code trong cơ sở dữ liệu!`);
          if (btnStartLuckyDraw) {
            btnStartLuckyDraw.textContent = '🎰 BẮT ĐẦU QUAY';
            btnStartLuckyDraw.disabled = false;
          }
          return;
        }
        executeSpin();
      }).catch(err => {
        console.error("Lỗi khi load danh sách MEGA:", err);
        alert("Có lỗi xảy ra khi tải danh sách người chơi!");
        if (btnStartLuckyDraw) {
          btnStartLuckyDraw.textContent = '🎰 BẮT ĐẦU QUAY';
          btnStartLuckyDraw.disabled = false;
        }
      });
    } else {
      executeSpin();
    }
  }

  function executeSpin() {
    const availablePool = luckyDrawPool.filter(u => !luckyDrawWinners.includes(String(u.mega_code)));
    if (availablePool.length === 0) {
      alert('Tất cả những người có mã MEGA đều đã trúng thưởng!');
      if (btnStartLuckyDraw) {
        btnStartLuckyDraw.textContent = '🎰 BẮT ĐẦU QUAY';
        btnStartLuckyDraw.disabled = false;
      }
      return;
    }

    if (btnStartLuckyDraw) {
      btnStartLuckyDraw.disabled = true;
      btnStartLuckyDraw.textContent = '🎰 ĐANG QUAY...';
      btnStartLuckyDraw.classList.add('opacity-50', 'cursor-not-allowed');
    }
    luckyWinnerName.style.opacity = '0';
    confettiContainer.innerHTML = '';
    
    let spinCount = 0;
    const maxSpins = 40; // 40 spins
    const spinDelay = 100; // 100ms per spin = 4000ms (4 seconds)
    
    // Tắt transition trong lúc quay để tránh giật lag (conflict với spinDelay)
    luckyMegaDisplay.style.transition = 'none';

    // Đảm bảo không có interval nào đang chạy ẩn trước khi bắt đầu
    if (luckyDrawInterval) clearInterval(luckyDrawInterval);

    const currentInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * availablePool.length);
      const tempUser = availablePool[randomIndex];
      luckyMegaDisplay.textContent = tempUser.mega_code;
      // Nhảy nhẹ scale thay vì đổi màu liên tục để giảm lag
      luckyMegaDisplay.style.transform = `scale(${1 + Math.random() * 0.05})`;
      luckyMegaDisplay.classList.remove('text-transparent', 'bg-clip-text', 'bg-gradient-to-b', 'from-amber-100', 'via-amber-400', 'to-orange-600');
      luckyMegaDisplay.classList.add('text-white'); // Chữ trắng tinh khi đang quay
      
      spinCount++;
      if (spinCount >= maxSpins) {
        clearInterval(currentInterval);
        
        // Bật lại transition để scale đẹp mắt khi trúng giải
        luckyMegaDisplay.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        luckyMegaDisplay.style.transform = 'scale(1.1)';
        luckyMegaDisplay.classList.remove('text-white');
        luckyMegaDisplay.classList.add('text-transparent', 'bg-clip-text', 'bg-gradient-to-b', 'from-amber-100', 'via-amber-400', 'to-orange-600');
        
        let winner = null;
        const targetInput = document.getElementById('lucky_mega_target');
        if (targetInput && targetInput.value.trim() !== '') {
          const forcedCode = targetInput.value.trim();
          winner = availablePool.find(u => String(u.mega_code) === forcedCode);
          if (winner) targetInput.value = ''; // clear it after use
        }

        if (!winner) {
          const finalIndex = Math.floor(Math.random() * availablePool.length);
          winner = availablePool[finalIndex];
        }
        
        luckyMegaDisplay.textContent = winner.mega_code;
        luckyWinnerName.textContent = winner.full_name;
        luckyWinnerName.style.opacity = '1';
        
        luckyDrawWinners.push(String(winner.mega_code));
        updateWinnersList();
        createConfetti();
        
        btnStartLuckyDraw.textContent = '🎰 BẮT ĐẦU QUAY';
        btnStartLuckyDraw.disabled = false;
        btnStartLuckyDraw.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }, spinDelay);
    luckyDrawInterval = currentInterval;
  }

  function updateWinnersList() {
    if (luckyDrawWinners.length === 0) {
      luckyWinnersList.innerHTML = '<li class="text-xs italic text-slate-500 text-center">Chưa có ai trúng thưởng phiên này</li>';
      return;
    }
    luckyWinnersList.innerHTML = '';
    luckyDrawWinners.forEach((code, index) => {
      const user = luckyDrawPool.find(u => String(u.mega_code) === code);
      const li = document.createElement('li');
      li.className = 'flex flex-col md:flex-row justify-between items-center bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-amber-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 gap-3 md:gap-0 relative overflow-hidden group';
      li.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-orange-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
        <div class="flex items-center gap-3 pl-2">
          <span class="flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 text-amber-800 font-bold text-sm px-4 py-1.5 rounded-full border border-amber-200 shadow-sm">
            🎁 Giải ${index + 1}
          </span>
        </div>
        <div class="flex flex-col items-center justify-center">
          <span class="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 font-['Space_Grotesk'] tracking-[0.2em] drop-shadow-sm">${code}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-[#4A240A] tracking-tight uppercase">${user ? user.full_name : 'Tài Khoản Ẩn'}</span>
          <span class="text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-110">✨</span>
        </div>
      `;
      luckyWinnersList.appendChild(li);
    });
  }

  function createConfetti() {
    if (!window.confetti) return;

    var duration = 5 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function() {
      var timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      var particleCount = 50 * (timeLeft / duration);
      // Phát pháo hoa từ 2 bên màn hình
      window.confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      window.confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
  }

  if (btnStartLuckyDraw) {
    btnStartLuckyDraw.addEventListener('click', startLuckyDraw);
  }
  
  if (btnResetLuckyDraw) {
    btnResetLuckyDraw.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn làm mới lịch sử người trúng giải?')) {
        luckyDrawWinners = [];
        updateWinnersList();
        luckyMegaDisplay.textContent = '000';
        luckyWinnerName.style.opacity = '0';
        confettiContainer.innerHTML = '';
        luckyMegaDisplay.style.transform = 'scale(1)';
        luckyMegaDisplay.classList.remove('text-white', 'opacity-50', 'grayscale');
        luckyMegaDisplay.classList.add('text-transparent', 'bg-clip-text', 'bg-gradient-to-b', 'from-amber-100', 'via-amber-400', 'to-orange-600');
      }
    });
  }
  } catch (err) {
    alert("CRASH KHI KHỞI TẠO ADMIN: " + err.message + "\\n" + err.stack);
    console.error(err);
  }
});
