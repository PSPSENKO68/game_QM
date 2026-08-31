/**
 * Authentication — Game HRIS
 * Xử lý đăng nhập, kiểm tra Chủ Nhật, và tự động seed database lần đầu.
 */

import { db, bootstrapDatabase } from './supabase.js';

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
        showError('Vui lòng nhập Họ Tên và Bộ phận của bạn.');
        return;
      }

      setLoading(btnSubmitQuick, true, 'THAM GIA NGAY');

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
        showError('Lỗi kết nối đến cơ sở dữ liệu. Vui lòng thử lại.');
      } finally {
        setLoading(btnSubmitQuick, false, 'THAM GIA NGAY');
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
        showError('Vui lòng nhập đầy đủ Số điện thoại và mã PIN.');
        return;
      }

      setLoading(btnSubmitAdmin, true, 'ĐĂNG NHẬP ADMIN');

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
        showError('Lỗi kết nối đến cơ sở dữ liệu. Vui lòng thử lại.');
      } finally {
        setLoading(btnSubmitAdmin, false, 'ĐĂNG NHẬP ADMIN');
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
        <span>ĐANG XỬ LÝ...</span>
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
