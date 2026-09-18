/**
 * Authentication — Game HRIS
 * Xử lý đăng nhập, kiểm tra Chủ Nhật, và tự động seed database lần đầu.
 */

import { db, bootstrapDatabase } from './supabase.js?v=12';

document.addEventListener('DOMContentLoaded', async () => {
  // Đã đăng nhập → chuyển thẳng vào app
  if (sessionStorage.getItem('current_user')) {
    window.location.replace('/index.html');
    return;
  }

  // ── Tự động khởi tạo DB (chỉ chạy khi bảng rỗng / admin chưa tồn tại) ────
  const bootstrapResult = await bootstrapDatabase();
  if (!bootstrapResult.success && bootstrapResult.reason === 'table_missing') {
    // Bảng chưa tạo → hiển thị hướng dẫn
    showError('⚠️ Cơ sở dữ liệu chưa được khởi tạo. Vui lòng chạy SQL Schema trong Supabase Dashboard trước.');
  }

  // DOM Elements - Quick Play
  const quickForm = document.getElementById('quick_play_form');
  const quickNameInput = document.getElementById('quick_fullname');
  const quickDeptInput = document.getElementById('quick_department');
  const btnSubmitQuick = document.getElementById('btn_submit_quick');
  
  // Force uppercase on input
  if (quickNameInput) {
    quickNameInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }
  if (quickDeptInput) {
    quickDeptInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }
  
  // DOM Elements - Admin Login
  const adminForm = document.getElementById('admin_login_form');
  const adminPhoneInput = document.getElementById('admin_phone');
  const adminPinInput = document.getElementById('admin_pin');
  const btnSubmitAdmin = document.getElementById('btn_submit_admin');
  
  const errorAlert = document.getElementById('error_alert');
  const successAlert = document.getElementById('success_alert');

  if (quickForm) {
    quickForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlerts();

      const fullName = quickNameInput.value.trim().toUpperCase();
      const department = quickDeptInput.value.trim().toUpperCase();

      if (!fullName || !department) {
        showError('Vui lòng nhập Họ Tên và Bộ phận / Please enter Full Name and Department.');
        return;
      }

      // Danh sách ngoại lệ: Các tên người nước ngoài không có dấu tiếng Việt (viết HOA toàn bộ)
      const allowedForeignNames = [
        'YUYA HAMASAKI',
        'YOSUKE NAKADA'
      ];

      // Nếu tên không nằm trong danh sách ngoại lệ thì mới kiểm tra dấu tiếng Việt
      if (!allowedForeignNames.includes(fullName)) {
        const hasVietnameseAccent = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(fullName);
        if (!hasVietnameseAccent) {
          showError('Vui lòng nhập Họ và tên có dấu / Please enter Full Name with Vietnamese accents!');
          shakeForm(quickForm);
          return;
        }
      }

      setLoading(btnSubmitQuick, true, 'THAM GIA NGAY / JOIN NOW');

      try {
        const result = await db.quickLogin(fullName, department);
        if (result.success) {
          sessionStorage.setItem('current_user', JSON.stringify(result.user));
          window.location.replace('/index.html');
        } else {
          showError(result.message);
          shakeForm(quickForm);
        }
      } catch (err) {
        console.error(err);
        showError('Lỗi kết nối. Vui lòng thử lại / Connection error. Please try again.');
      } finally {
        setLoading(btnSubmitQuick, false, 'THAM GIA NGAY / JOIN NOW');
      }
    });
  }

  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlerts();

      const phone = adminPhoneInput.value.trim();
      const pin = adminPinInput.value.trim();

      if (!phone || !pin) {
        showError('Vui lòng nhập SĐT và mã PIN / Please enter Phone and PIN.');
        return;
      }

      setLoading(btnSubmitAdmin, true, 'ĐĂNG NHẬP / LOGIN');

      try {
        const result = await db.login(phone, pin);
        if (result.success) {
          sessionStorage.setItem('current_user', JSON.stringify(result.user));
          window.location.replace('/index.html');
        } else {
          showError(result.message);
          shakeForm(adminForm);
        }
      } catch (err) {
        console.error(err);
        showError('Lỗi kết nối. Vui lòng thử lại / Connection error. Please try again.');
      } finally {
        setLoading(btnSubmitAdmin, false, 'ĐĂNG NHẬP / LOGIN');
      }
    });
  }

  // --- Change Password Logic ---
  const btnShowChangePassword = document.getElementById('btn_show_change_password');
  const btnBackToLogin = document.getElementById('btn_back_to_login');
  const changePasswordForm = document.getElementById('change_password_form');
  const cpPhoneInput = document.getElementById('cp_phone');
  const cpOldPinInput = document.getElementById('cp_old_pin');
  const cpNewPinInput = document.getElementById('cp_new_pin');
  const btnSubmitChangePassword = document.getElementById('btn_submit_change_password');

  if (btnShowChangePassword && btnBackToLogin && changePasswordForm) {
    btnShowChangePassword.addEventListener('click', () => {
      adminForm.classList.add('hidden-form');
      changePasswordForm.classList.remove('hidden-form');
      hideAlerts();
    });

    btnBackToLogin.addEventListener('click', () => {
      changePasswordForm.classList.add('hidden-form');
      adminForm.classList.remove('hidden-form');
      hideAlerts();
    });

    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlerts();

      const phone = cpPhoneInput.value.trim();
      const oldPin = cpOldPinInput.value.trim();
      const newPin = cpNewPinInput.value.trim();

      if (!phone || !oldPin || !newPin) {
        showError('Vui lòng nhập đầy đủ thông tin.');
        return;
      }
      if (newPin.length < 4) {
        showError('PIN mới phải có ít nhất 4 ký tự.');
        return;
      }

      setLoading(btnSubmitChangePassword, true, 'XÁC NHẬN ĐỔI MẬT KHẨU');

      try {
        // 1. Xác thực bằng PIN cũ
        const loginResult = await db.login(phone, oldPin);
        if (!loginResult.success) {
          showError('Sai SĐT hoặc PIN cũ không đúng.');
          shakeForm(changePasswordForm);
          return;
        }

        // 2. Cập nhật PIN mới
        const user = loginResult.user;
        const updateResult = await db.adminUpdateUser(user.id, { pin: newPin });
        
        if (updateResult.success) {
          showSuccess('Đổi mật khẩu thành công! Vui lòng quay lại Đăng nhập.');
          cpOldPinInput.value = '';
          cpNewPinInput.value = '';
        } else {
          showError(updateResult.message || 'Lỗi: Không thể cập nhật PIN (Vui lòng kiểm tra lại quyền Supabase RLS).');
          shakeForm(changePasswordForm);
        }
      } catch (err) {
        console.error(err);
        showError('Lỗi kết nối. Vui lòng thử lại.');
      } finally {
        setLoading(btnSubmitChangePassword, false, 'XÁC NHẬN ĐỔI MẬT KHẨU');
      }
    });
  }

  function setLoading(btn, isLoading, originalText) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>ĐANG XỬ LÝ / PROCESSING...</span>
      `;
    } else {
      btn.disabled = false;
      btn.innerHTML = `<span>${originalText}</span>`;
    }
  }

  function shakeForm(form) {
    const card = form.closest('.brand-card');
    if (card) {
      card.classList.add('animate-shake');
      setTimeout(() => card.classList.remove('animate-shake'), 350);
    }
  }

  function hideAlerts() {
    if (errorAlert) errorAlert.classList.add('hidden');
    if (successAlert) successAlert.classList.add('hidden');
  }

  function showSuccess(msg) {
    if (successAlert) {
      successAlert.textContent = msg;
      successAlert.classList.remove('hidden');
    }
  }

  function showError(msg) {
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.classList.remove('hidden');
    }
  }
});
