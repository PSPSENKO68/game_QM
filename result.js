/**
 * Quiz results display script
 * Pulls current session result logs, validates retry limits, and guides navigation back to active play.
 */

import { db, formatTimeSpent } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate check
  const sessionUser = sessionStorage.getItem('current_user');
  if (!sessionUser) {
    window.location.replace('/login.html');
    return;
  }
  const user = JSON.parse(sessionUser);

  // Get elements
  const scoreEarned = document.getElementById('score_earned');
  const correctCounter = document.getElementById('correct_counter');
  const bonusBadge = document.getElementById('bonus_badge');
  const userFeedbackMsg = document.getElementById('user_feedback_msg');

  const btnRetryQuiz = document.getElementById('btn_retry_quiz');
  const retryLimitModal = document.getElementById('retry_limit_modal');
  const closeLimitModal = document.getElementById('close_limit_modal');

  // Load latest state from session
  const score = parseInt(sessionStorage.getItem('last_quiz_score') || '0');
  const correct = parseInt(sessionStorage.getItem('last_quiz_correct_count') || '0');
  const total = parseInt(sessionStorage.getItem('last_quiz_total_questions') || '10');
  const bonus = parseInt(sessionStorage.getItem('last_quiz_bonus') || '20');

  const totalScoreDisplay = document.getElementById('total_score_display');

  // Populate UI elements
  if (scoreEarned) scoreEarned.textContent = score;
  if (correctCounter) correctCounter.textContent = `${correct}/${total}`;
  if (bonusBadge) bonusBadge.textContent = `+${bonus}đ`;

  // Fetch và hiển thị tổng điểm tích lũy mới nhất từ DB và Hạng
  if (totalScoreDisplay) {
    try {
      const freshUser = await db.getUserById(user.id);
      const totalScore = freshUser ? (freshUser.total_score || 0) : 0;
      totalScoreDisplay.innerHTML = `<span class="text-[#FFF8E7]">${totalScore}</span>`;

      const rankBadge = document.getElementById('rank_badge');
      if (rankBadge) {
        const rank = await db.getUserRank(user.id);
        if (rank) {
          rankBadge.textContent = `Hạng #${rank}`;
          // Kích hoạt animation nảy lên
          setTimeout(() => {
            rankBadge.classList.add('rank-animate');
          }, 300);
        } else {
          // Chưa có điểm → ẩn badge hạng
          rankBadge.style.display = 'none';
        }
      }

      // MEGA Spinner Logic for Mode 1
      const modeRaw = sessionStorage.getItem('last_quiz_mode') || '1';
      const mode = modeRaw === 'streak' ? 'streak' : parseInt(modeRaw);
      if (mode === 1 && !freshUser.mega_code) {
        const megaCode = await db.generateMegaCode(user.id);
        if (megaCode) {
          const modal = document.getElementById('mega_spinner_modal');
          const audio = document.getElementById('audio_mega');
          const numberEl = document.getElementById('mega_spinner_number');
          const msgEl = document.getElementById('mega_spinner_msg');
          const header = document.getElementById('celebration_header');
          const btnStartMega = document.getElementById('btn_start_mega');
          const spinnerContainer = document.getElementById('mega_spinner_container');
          
          if (modal && numberEl && btnStartMega) {
            modal.classList.remove('hidden');
            if (header) header.classList.add('hidden');
            
            btnStartMega.onclick = () => {
              btnStartMega.classList.add('hidden');
              if (spinnerContainer) {
                spinnerContainer.classList.remove('hidden');
                // The flex class is already present, but we need to ensure it overrides hidden properly
              }
              
              if (audio) {
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Audio autoplay blocked', e));
              }

              let spins = 0;
              const spinInterval = setInterval(() => {
                 const r = Math.floor(Math.random() * 200) + 1;
                 numberEl.textContent = String(r).padStart(3, '0');
                 spins++;
              }, 50);

              // Stop after 4 seconds
              setTimeout(() => {
                clearInterval(spinInterval);
                numberEl.textContent = megaCode;
                if (msgEl) msgEl.classList.remove('opacity-0');
                
                const btnMegaComplete = document.getElementById('btn_mega_complete');
                if (btnMegaComplete) {
                  btnMegaComplete.classList.remove('hidden');
                  btnMegaComplete.onclick = () => {
                    if (audio) {
                      audio.pause();
                      audio.currentTime = 0;
                    }
                    modal.classList.add('hidden');
                    if (header) header.classList.remove('hidden');
                  };
                }
              }, 4000);
            };
          }
        }
      }

    } catch (_) {
      totalScoreDisplay.textContent = '—';
    }
  }

  const modeRaw = sessionStorage.getItem('last_quiz_mode') || '1';
  const mode = modeRaw === 'streak' ? 'streak' : parseInt(modeRaw);
  const isWin = sessionStorage.getItem('steal_result_is_win') === 'true';

  // Dynamic feedback personalized comments
  if (userFeedbackMsg && mode === 'streak') {
    let comment = '';
    if (correct === total) {
      comment = `Tuyệt vời! Bạn đã giữ được chuỗi. Hoàn hảo ${correct}/${total}! 🔥`;
    } else if (correct >= 5) {
      comment = `Làm tốt lắm! Bạn đã sống sót với ${correct}/${total} câu đúng! 🔥`;
    } else {
      comment = `Rất tiếc, chuỗi của bạn có nguy cơ bị đứt! Đúng ${correct}/${total} câu hỏi.`;
    }
    userFeedbackMsg.textContent = comment;
    const titleEl = document.querySelector('h2');
    if (titleEl) titleEl.textContent = 'KẾT QUẢ GIỮ CHUỖI';
  }

  if (userFeedbackMsg && mode === 1) {
    let comment = '';
    if (correct === total) {
      comment = `Tuyệt đỉnh! Bạn trả lời đúng tuyệt đối ${correct}/${total} câu hỏi! Tặng bạn ${bonus} like hoàn thành! 🏆`;
    } else if (correct >= 8) {
      comment = `Rất Xuất Sắc! Đúng ${correct}/${total} câu hỏi. Tiếp tục phát huy nhé! 🎉`;
    } else if (correct >= 5) {
      comment = `Khá tốt! Bạn đạt được ${correct}/${total} câu trả lời chuẩn xác. Hãy lưu tâm thêm nhé! 👍`;
    } else {
      comment = `Hãy cố gắng thêm! Trả lời đúng ${correct}/${total} câu hỏi. Hãy thử sức lại để thăng cấp điểm! 💪`;
    }
    userFeedbackMsg.textContent = comment;
  }

  if (mode === 2) {
    const titleEl = document.querySelector('h2');
    if (titleEl) titleEl.textContent = isWin ? 'THÁCH ĐẤU THÀNH CÔNG!' : 'THÁCH ĐẤU THẤT BẠI!';
    
    // Tìm p tag 'ĐIỂM ĐẠT ĐƯỢC LƯỢT NÀY' (sẽ nằm ở parentElement của score_earned, là p trước đó)
    const scoreTitle = scoreEarned ? scoreEarned.parentElement.previousElementSibling : null;
    if (scoreTitle) scoreTitle.textContent = isWin ? 'PHẦN THƯỞNG THÁCH ĐẤU' : 'HÌNH PHẠT THÁCH ĐẤU';
    
    const winPoints = sessionStorage.getItem('steal_result_win_points') || '20';
    const losePoints = sessionStorage.getItem('steal_result_lose_points') || '10';

    if (scoreEarned) {
      scoreEarned.textContent = isWin ? winPoints : `-${losePoints}`;
      scoreEarned.parentElement.innerHTML = isWin ? `+<span id="score_earned">${winPoints}</span>` : `<span id="score_earned" class="text-rose-500">-${losePoints}</span>`;
    }
    
    const atkCorrect = sessionStorage.getItem('steal_result_atk_correct') || 0;
    const atkTime = sessionStorage.getItem('steal_result_atk_time') || 0;
    const defCorrect = sessionStorage.getItem('steal_result_def_correct') || 0;
    const defTime = sessionStorage.getItem('steal_result_def_time') || 0;
    
    const normAtkTime = Number(atkTime) < 500 ? Number(atkTime) * 1000 : Number(atkTime);
    const normDefTime = Number(defTime) < 500 ? Number(defTime) * 1000 : Number(defTime);

    const formattedAtkTime = formatTimeSpent(normAtkTime);
    const formattedDefTime = formatTimeSpent(normDefTime);

    let reasonHTML = '';
    if (isWin) {
      if (Number(atkCorrect) > Number(defCorrect)) {
        reasonHTML = `Bạn trả lời đúng nhiều hơn người bị thách đấu (${atkCorrect} vs ${defCorrect} câu).`;
      } else {
        let diffMs = Math.abs(normDefTime - normAtkTime);
        let diffSec = (diffMs / 1000).toFixed(3);
        reasonHTML = `Bạn trả lời nhanh hơn người bị thách đấu ${diffSec}s (${formattedAtkTime} vs ${formattedDefTime}) với cùng ${atkCorrect} câu đúng.`;
      }
    } else {
      if (Number(atkCorrect) < Number(defCorrect)) {
        reasonHTML = `Bạn trả lời đúng ít hơn người bị thách đấu (${atkCorrect} vs ${defCorrect} câu).`;
      } else if (Number(atkCorrect) === Number(defCorrect) && normAtkTime > normDefTime) {
        let diffMs = Math.abs(normAtkTime - normDefTime);
        let diffSec = (diffMs / 1000).toFixed(3);
        reasonHTML = `Bạn trả lời chậm hơn người bị thách đấu ${diffSec}s (${formattedAtkTime} vs ${formattedDefTime}) với cùng ${atkCorrect} câu đúng.`;
      } else {
        reasonHTML = `Thành tích của bạn không vượt qua người bị thách đấu (${formattedAtkTime} vs ${formattedDefTime}).`;
      }
    }

    if (userFeedbackMsg) {
       userFeedbackMsg.innerHTML = isWin 
         ? `Bạn đã đánh bại đối thủ và giành được ${winPoints} điểm!<br><br><span style="color:#0284c7; font-weight:normal;">Chi tiết: ${reasonHTML}</span>` 
         : `Bạn đã thua cuộc và bị trừ ${losePoints} điểm!<br><br><span style="color:#dc2626; font-weight:normal;">Chi tiết: ${reasonHTML}</span>`;
    }

    if (btnRetryQuiz) {
      btnRetryQuiz.innerHTML = `
        🥷 THÁCH ĐẤU NGƯỜI KHÁC
      `;
    }
  }

  // Handle Retry click routine
  if (btnRetryQuiz) {
    btnRetryQuiz.addEventListener('click', async () => {
      btnRetryQuiz.disabled = true;
      const initialText = btnRetryQuiz.innerHTML;
      btnRetryQuiz.innerHTML = 'ĐANG ĐỒNG BỘ LƯỢT CHƠI...';

      try {
        if (mode === 2) {
          const stealsToday = await db.getStealsToday(user.id);
          const maxSteals = await db.getMaxStealsPerDay();
          const isMaxStolen = stealsToday >= maxSteals;
          if (isMaxStolen) {
            document.getElementById('retry_limit_title').textContent = 'Hết lượt thách đấu hôm nay';
            document.getElementById('retry_limit_desc').textContent = 'Bạn đã sử dụng hết lượt thách đấu hôm nay. Vui lòng quay lại vào ngày mai!';
            retryLimitModal.classList.remove('hidden');
          } else {
            window.location.href = '/leaderboard.html?action=steal';
          }
        } else {
          const playsToday = await db.getPlaysToday(user.id);
          const globalLimit = await db.getDailyLimit();
          const maxPlays = (user.max_plays !== null && user.max_plays !== undefined) ? user.max_plays : globalLimit;

          if (playsToday >= maxPlays) {
            document.getElementById('retry_limit_title').textContent = 'Hết lượt chơi hôm nay';
            document.getElementById('retry_limit_desc').textContent = 'Bạn đã sử dụng hết lượt chơi hôm nay. Vui lòng quay lại vào ngày mai để tiếp tục chinh phục điểm cao!';
            retryLimitModal.classList.remove('hidden');
          } else {
            window.location.href = '/quiz.html?mode=1';
          }
        }
      } catch (err) {
        console.error('Error syncing dynamic play records', err);
        window.location.href = '/index.html';
      } finally {
        btnRetryQuiz.disabled = false;
        btnRetryQuiz.innerHTML = initialText;
      }
    });
  }

  // Handle modal closures
  if (closeLimitModal) {
    closeLimitModal.addEventListener('click', () => {
      retryLimitModal.classList.add('hidden');
      window.location.replace('/index.html');
    });
  }
});
