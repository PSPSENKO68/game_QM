/**
 * Application Core — Màn hình chính của nhân viên
 * Quản lý thông tin cá nhân, kiểm tra quiz, lượt chơi, và profile update.
 */

import { db } from './supabase.js?v=6';

document.addEventListener('DOMContentLoaded', async () => {
  // Kiểm tra đăng nhập
  const sessionUser = sessionStorage.getItem('current_user');
  if (!sessionUser) {
    window.location.replace('/login.html');
    return;
  }

  let user = JSON.parse(sessionUser);

  // Lấy elements
  const userProfileCard = document.getElementById('user_profile_card');
  const userAvatarChar = document.getElementById('user_avatar_char');
  const userFullName = document.getElementById('user_full_name');
  const userDepartment = document.getElementById('user_department');
  const userEmployeeCode = document.getElementById('user_employee_code');
  const userTotalScore = document.getElementById('user_total_score');
  const userPlaysToday = document.getElementById('user_plays_today');
  const userRank = document.getElementById('user_rank');
  const activeQuizPanel = document.getElementById('active_quiz_panel');
  const quizTitle = document.getElementById('quiz_title');
  const btnPlayQuiz = document.getElementById('btn_play_quiz');
  const btnLogout = document.getElementById('btn_logout');


  // Làm mới dữ liệu user từ DB
  try {
    const updatedUser = await db.getUserById(user.id);
    if (updatedUser) {
      user = updatedUser;
      sessionStorage.setItem('current_user', JSON.stringify(user));
    }
  } catch (error) {
    console.error('Lỗi làm mới thông tin user:', error);
  }

  // Hiển thị thông tin user
  if (userProfileCard) {
    userFullName.textContent = user.full_name;
    userDepartment.textContent = user.department;
    userEmployeeCode.textContent = user.employee_code;
    userAvatarChar.textContent = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';
    userTotalScore.textContent = user.total_score || 0;

    if (userRank) {
      db.getUserRank(user.id).then(rank => {
        userRank.textContent = rank ? `#${rank}` : `--`; // null = chưa có điểm
      }).catch(() => {
        userRank.textContent = `--`;
      });
    }

    // Tính giới hạn lượt chơi: ưu tiên max_plays riêng của user, fallback về setting chung
    const playsNum = await db.getPlaysInCurrentCycle(user.id);
    const globalLimit = await db.getCycleLimit();
    const userLimit = typeof user.max_plays === 'number' ? user.max_plays : globalLimit;
    
    if (playsNum >= userLimit) {
      alert('Bạn đã sử dụng hết lượt cày cuốc trong thời gian quy định. Hệ thống sẽ sớm tự động hồi lại lượt mới!');
    }
    
    userPlaysToday.textContent = `${playsNum}/${userLimit}`;
    if (playsNum >= userLimit) {
      userPlaysToday.classList.add('text-rose-600', 'font-extrabold');
    }
    userProfileCard.classList.remove('hidden');
  }

  // ── Profile Update Modal ───────────────────────────────────────────────────
  const btnEditProfile = document.getElementById('btn_edit_profile');
  const modalUpdateProfile = document.getElementById('modal_update_profile');
  const btnCloseProfileModal = document.getElementById('btn_close_profile_modal');
  const formUpdateProfile = document.getElementById('form_update_profile');
  const profileFullNameInput = document.getElementById('profile_fullname');
  const profilePhoneInput = document.getElementById('profile_phone');
  const profileDeptInput = document.getElementById('profile_dept');
  const profilePinInput = document.getElementById('profile_pin');

  if (btnEditProfile && modalUpdateProfile) {
    btnEditProfile.addEventListener('click', () => {
      profileFullNameInput.value = user.full_name || '';
      profilePhoneInput.value = user.employee_code || '';
      profileDeptInput.value = user.department || '';
      profilePinInput.value = user.pin || '';
      modalUpdateProfile.classList.remove('hidden');
    });
  }

  if (btnCloseProfileModal) {
    btnCloseProfileModal.addEventListener('click', () => {
      modalUpdateProfile.classList.add('hidden');
    });
  }

  if (formUpdateProfile) {
    formUpdateProfile.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newName = profileFullNameInput.value.trim();
      const newDept = profileDeptInput.value.trim();
      const newPin = profilePinInput.value.trim();

      if (!newName || !newDept || !newPin) {
        showGlobalAlert('Thiếu thông tin', 'Vui lòng điền đầy đủ Họ tên, Phòng ban và PIN!');
        return;
      }

      try {
        const payload = {
          full_name: newName,
          department: newDept,
          pin: newPin
        };

        const result = await db.adminUpdateUser(user.id, payload);
        if (result && result.success) {
          user = { ...user, ...payload };
          sessionStorage.setItem('current_user', JSON.stringify(user));

          // Cập nhật UI
          userFullName.textContent = user.full_name;
          userDepartment.textContent = user.department;
          userAvatarChar.textContent = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';

          modalUpdateProfile.classList.add('hidden');
          showGlobalAlert('Thành công ✅', 'Đã lưu thông tin cá nhân thành công!');
        } else {
          showGlobalAlert('Thất bại', result?.message || 'Cập nhật không thành công. Vui lòng thử lại.');
        }
      } catch (err) {
        console.error(err);
        showGlobalAlert('Lỗi kết nối', 'Không thể kết nối đến cơ sở dữ liệu.');
      }
    });
  }

  // ── Hiển thị link Admin Dashboard ─────────────────────────────────────────
  const btnAdminLink = document.querySelector('a[href="/admin.html"]');
  if (btnAdminLink) {
    if (user.role === 'admin' || user.role === 'owner') {
      btnAdminLink.classList.remove('hidden');
    } else {
      btnAdminLink.classList.add('hidden');
    }
  }

  // ── Kiểm tra và hiển thị Trạng thái Game ─────────────────────────────────
  const gamePanel = document.getElementById('game_panel');
  const gameOffState = document.getElementById('game_off_state');
  const gameOnState = document.getElementById('game_on_state');

  const mode1PlaysStatus = document.getElementById('mode1_plays_status');
  const mode2StealsStatus = document.getElementById('mode2_steals_status');
  const btnMode1 = document.getElementById('btn_mode_1');

  if (gamePanel) {
    gamePanel.classList.remove('hidden');

    const isModule1On = await db.getModule1Status();
    const isModule2On = await db.getModule2Status();
    const isStreakOn = await db.getStreakGameMode();
    const isGameOn = isModule1On || isModule2On || isStreakOn;

    const gameStreakState = document.getElementById('game_streak_state');

    if (!isGameOn) {
      gameOffState.classList.remove('hidden');
      gameOnState.classList.add('hidden');
      if (gameStreakState) gameStreakState.classList.add('hidden');
    } else {
      gameOffState.classList.add('hidden');

      if (isStreakOn && gameStreakState) {
        gameOnState.classList.add('hidden');
        gameStreakState.classList.remove('hidden');
        
        const lbLink = document.querySelector('a[href="/leaderboard.html"]');
        if (lbLink) lbLink.href = '/leaderboard.html?mode=streak';
        
        const streakInfo = await db.getUserStreakStatus(user.id);
        const maxDays = await db.getMaxStreakDays();
        console.log('[APP] streakInfo:', streakInfo, 'maxDays:', maxDays, typeof maxDays);
        let timelineHtml = '';
        for (let i = 1; i <= maxDays; i++) {
          let statusColor = 'bg-[#FFF8E7] text-[#4A240A] border-[#8B5A2B] opacity-70';
          let icon = i;
          
          if (i <= streakInfo.streakDays) {
            statusColor = 'bg-[#677B40] text-white border-[#677B40]';
            icon = '✓';
          } else if (i === streakInfo.streakDays + 1) {
            statusColor = 'bg-[#FFD700] text-[#2B1607] border-[#2B1607] animate-pulse';
          }
          
          timelineHtml += `
            <div class="relative flex flex-col items-center flex-1">
              <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs ${statusColor} z-10 relative shadow-sm">
                ${icon}
              </div>
              <div class="text-[9px] font-bold mt-1 text-[#8B5A2B]">Ngày ${i}</div>
              ${i < maxDays ? `<div class="absolute top-4 left-[50%] w-full h-0.5 bg-[#8B5A2B]/30 z-0"></div>` : ''}
            </div>
          `;
        }
        
        const timeline = document.getElementById('streak_timeline');
        if (timeline) timeline.innerHTML = timelineHtml;
        
        // Find active streak quiz
        const activeStreakQuiz = await db.getActiveStreakQuiz();
        
        const btnPlayStreak = document.getElementById('btn_play_streak');
        const streakPlayStatus = document.getElementById('streak_play_status');
        
        if (activeStreakQuiz) {
          sessionStorage.setItem('current_quiz_id', activeStreakQuiz.id);
          streakPlayStatus.textContent = activeStreakQuiz.title;
          btnPlayStreak.addEventListener('click', () => {
             // In Streak Mode, we might not check limit plays unless we want to. Let's let them play unlimited.
             window.location.href = '/quiz.html?mode=streak';
          });
        } else {
          streakPlayStatus.textContent = 'Chưa có đề hôm nay';
          btnPlayStreak.disabled = true;
          btnPlayStreak.classList.add('opacity-50', 'cursor-not-allowed');
        }

      } else {
        if (gameStreakState) gameStreakState.classList.add('hidden');
        gameOnState.classList.remove('hidden');

      const btnMode2 = document.getElementById('btn_mode_2');
      if (!isModule1On && btnMode1) {
        btnMode1.classList.add('opacity-50', 'cursor-not-allowed', 'grayscale');
        btnMode1.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showGlobalAlert('Đang khóa', 'Chế độ Cày Cuốc đang tạm thời bị khóa.'); }, {capture: true});
      }
      
      const minPlaysRaw = await db.getSettingValue('min_plays_to_unlock_steal');
      const minPlaysToUnlock = minPlaysRaw ? parseInt(minPlaysRaw) : 1;
      const playsToday = await db.getPlaysInCurrentCycle(user.id);
      
      const isMode2Locked = !isModule2On || (isModule1On && playsToday < minPlaysToUnlock);
      
      if (isMode2Locked && btnMode2) {
        if (!isModule2On) {
          btnMode2.classList.add('opacity-50', 'cursor-not-allowed', 'grayscale');
        }
        btnMode2.href = "javascript:void(0)";
        
        if (!isModule2On) {
          btnMode2.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showGlobalAlert('Sắp ra mắt', 'Sự kiện bắt đầu sau 24h'); }, {capture: true});
        } else {
          btnMode2.addEventListener('click', (e) => { 
            e.preventDefault(); e.stopPropagation(); 
            showGlobalAlert('Thông báo', `Bạn cần hoàn thành chế độ cày cuốc để mở khóa tính năng thách đấu với bạn bè\n\n(Đã hoàn thành: ${playsToday}/${minPlaysToUnlock})`); 
          }, {capture: true});
        }
      }

      // Load Tutorial Video
      const tutorialVideoUrl = await db.getTutorialVideoUrl();
      const btnOpenTutorial = document.getElementById('btn_open_tutorial');
      const tutorialVideoPlayer = document.getElementById('tutorial_video_player');
      
      if (tutorialVideoUrl && tutorialVideoUrl.trim() !== '') {
        if (btnOpenTutorial) btnOpenTutorial.classList.remove('hidden');
        if (tutorialVideoPlayer) {
          tutorialVideoPlayer.src = tutorialVideoUrl;
        }
      } else {
        if (btnOpenTutorial) btnOpenTutorial.classList.add('hidden');
      }

      // Tải Active Quiz
      const activeQuiz = await db.getActiveQuiz();
      if (activeQuiz) {
        quizTitle.textContent = activeQuiz.title;
        sessionStorage.setItem('current_quiz_id', activeQuiz.id);

        // Limit Mode 1
        const playsToday = await db.getPlaysInCurrentCycle(user.id);
        const globalLimit = await db.getCycleLimit();
        const userLimit = typeof user.max_plays === 'number' ? user.max_plays : globalLimit;
        
        mode1PlaysStatus.textContent = `${playsToday}/${userLimit} LƯỢT`;

        // Countdown timer cho Cày Cuốc
        const cycleBounds = await db.getCurrentCycleBounds();
        const cycleEndTime = new Date(cycleBounds.end).getTime();
        const countdownEl = document.getElementById('mode1_countdown');
        if (countdownEl) {
          countdownEl.classList.remove('hidden');
          const updateTimer = () => {
            const now = new Date().getTime();
            const distance = cycleEndTime - now;
            if (distance < 0) {
              countdownEl.textContent = 'ĐANG LÀM MỚI...';
              return;
            }
            const d = Math.floor(distance / (1000 * 60 * 60 * 24));
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);
            
            let timeStr = 'HỒI LƯỢT SAU ';
            if (d > 0) timeStr += `${d} NGÀY `;
            timeStr += `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            countdownEl.textContent = timeStr;
          };
          updateTimer();
          setInterval(updateTimer, 1000);
        }
        if (playsToday >= userLimit) {
          alert('Bạn đã sử dụng hết lượt cày cuốc trong thời gian quy định. Hệ thống sẽ sớm tự động hồi lại lượt mới!');
          mode1PlaysStatus.classList.add('text-rose-400');
        }

        const cycleDaysRaw = await db.getSettingValue('mode1_cycle_days');
        const cycleDays = parseInt(cycleDaysRaw) || 1;
        const basePointRaw = await db.getSettingValue('mode1_base_point');
        const basePoint = parseInt(basePointRaw) || 10;

        btnMode1.addEventListener('click', () => {
          if (playsToday >= userLimit) {
            showGlobalAlert('Hết lượt chơi', `Bạn đã sử dụng hết ${userLimit} lượt cày cuốc trong chu kỳ này.`);
            return;
          }
          
          const modalRules = document.getElementById('modal_rules');
          if (modalRules) {
            document.getElementById('rules_max_plays').textContent = userLimit;
            document.getElementById('rules_max_plays_2').textContent = userLimit;
            document.getElementById('rules_cycle_days').textContent = cycleDays;
            
            const rulesBasePoint = document.getElementById('rules_base_point');
            if (rulesBasePoint) rulesBasePoint.textContent = `+${basePoint} điểm/câu`;
            
            modalRules.classList.remove('hidden');

            const btnCancel = document.getElementById('btn_cancel_rules');
            const btnStart = document.getElementById('btn_start_quiz_after_rules');

            const closeModal = () => {
              modalRules.classList.add('hidden');
              btnCancel.removeEventListener('click', closeModal);
            };

            btnCancel.addEventListener('click', closeModal);
            
            btnStart.onclick = () => {
              window.location.href = '/quiz.html?mode=1';
            };
          } else {
             // Fallback
             window.location.href = '/quiz.html?mode=1';
          }
        });

        // Limit Mode 2
        const stealsToday = await db.getStealsToday(user.id);
        const maxSteals = await db.getMaxStealsPerDay();
        mode2StealsStatus.textContent = `${stealsToday}/${maxSteals} LƯỢT`;

        if (stealsToday >= maxSteals) {
          mode2StealsStatus.classList.add('text-rose-400');
        }
      } else {
        quizTitle.textContent = 'Chưa có đề thi nào được kích hoạt';
        btnMode1.disabled = true;
        btnMode1.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }
  }

  // ── Lucky Wheel ───────────────────────────────────────────────────────────
  const btnLuckyWheel = document.getElementById('btn_lucky_wheel');
  const modalLuckyWheel = document.getElementById('modal_lucky_wheel');
  const btnCloseWheel = document.getElementById('btn_close_wheel');
  const btnSpinWheel = document.getElementById('btn_spin_wheel');
  const wheelSpinner = document.getElementById('wheel_spinner');

  if (btnLuckyWheel && modalLuckyWheel) {
    const isWheelOn = await db.getWheelStatus();
    if (isWheelOn) {
      btnLuckyWheel.classList.remove('hidden');
    }

    btnLuckyWheel.addEventListener('click', async () => {
      modalLuckyWheel.classList.remove('hidden');
      // Tự động kiểm tra và khóa nút nếu đã quay
      const freshUser = await db.getUserById(user.id);
      if (freshUser && freshUser.has_spun_wheel) {
        btnSpinWheel.textContent = 'ĐÃ QUAY XONG';
        btnSpinWheel.disabled = true;
        btnSpinWheel.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    btnCloseWheel.addEventListener('click', () => {
      modalLuckyWheel.classList.add('hidden');
    });

    let isSpinning = false;
    btnSpinWheel.addEventListener('click', async () => {
      if (isSpinning) return;

      // Kiểm tra xem đã quay chưa
      const freshUser = await db.getUserById(user.id);
      if (freshUser && freshUser.has_spun_wheel) {
        showGlobalAlert('Bạn đã quay rồi!', 'Mỗi người chỉ được quay vòng quay 1 lần duy nhất.');
        btnSpinWheel.textContent = 'ĐÃ QUAY XONG';
        btnSpinWheel.disabled = true;
        btnSpinWheel.classList.add('opacity-50', 'cursor-not-allowed');
        return;
      }

      isSpinning = true;
      btnSpinWheel.disabled = true;
      btnSpinWheel.textContent = 'ĐANG QUAY...';
      btnSpinWheel.classList.add('opacity-50', 'cursor-not-allowed');

      const slice = Math.floor(Math.random() * 4);
      const targetAngles = [
        { type: 'POINTS', value: 10, angle: 315, label: '+10 Điểm' },
        { type: 'SHIELD', value: 0, angle: 225, label: 'KHIÊN BẢO VỆ' },
        { type: 'POINTS', value: 20, angle: 135, label: '+20 Điểm' },
        { type: 'POINTS', value: 50, angle: 45, label: '+50 Điểm' },
      ];

      const prize = targetAngles[slice];

      // Randomize angle within slice slightly
      const offset = Math.floor(Math.random() * 60) - 30; // +/- 30 degrees
      const totalRotation = 5 * 360 + prize.angle + offset;

      wheelSpinner.style.transform = `rotate(${totalRotation}deg)`;

      setTimeout(async () => {
        const result = await db.updateUserWheelResult(user.id, prize.type, prize.value);
        if (result.success) {
          showGlobalAlert('Chúc mừng!', `Bạn quay trúng: ${prize.label}.`);
          if (prize.type === 'POINTS') {
            userTotalScore.textContent = result.newScore;
          }
        } else {
          showGlobalAlert('Lỗi', result.message || 'Có lỗi xảy ra.');
        }

        btnSpinWheel.textContent = 'ĐÃ QUAY XONG';
      }, 5000);
    });
  }

  // ── Đăng xuất ─────────────────────────────────────────────────────────────
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('current_user');
      sessionStorage.removeItem('current_quiz_id');
      window.location.replace('/login.html');
    });
  }
});

// ── Polyfill alert component ──────────────────────────────────────────────────
function showGlobalAlert(title, message) {
  let modal = document.getElementById('global_error_modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global_error_modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs';
    modal.innerHTML = `
      <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
        <div class="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 mb-4 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-slate-900 text-center mb-1" id="global_modal_title">Thông báo</h3>
        <p class="text-sm text-slate-500 text-center mb-6 leading-relaxed" id="global_modal_msg"></p>
        <button id="close_global_alert" class="w-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold py-3 px-6 rounded-2xl hover:opacity-90 active:scale-95 transition cursor-pointer">
          Đóng thông báo
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('global_modal_title').textContent = title;
  document.getElementById('global_modal_msg').textContent = message;
  modal.classList.remove('hidden');

  const closeBtn = document.getElementById('close_global_alert');
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener('click', () => modal.classList.add('hidden'));
}
