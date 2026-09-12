/**
 * Quiz results display script
 * Pulls current session result logs, validates retry limits, and guides navigation back to active play.
 */

import { db, formatTimeSpent, supabase } from './supabase.js';

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

      // MEGA Spinner Logic (CHỈ DÀNH CHO CHẾ ĐỘ CÀY CUỐC - MODE 1)
      const modeRaw = sessionStorage.getItem('last_quiz_mode') || '1';
      const mode = modeRaw === 'streak' ? 'streak' : parseInt(modeRaw);
      
      // Người chơi chỉ được cấp số MEGA khi họ tham gia Cày Cuốc (mode === 1)
      // Call generateMegaCode with a flag to check if they ALREADY have one, or just let generateMegaCode tell us.
      // Actually, we can add a method checkUserMegaCode in db, or we can use fetch/REST?
      // No, we can just use the db object! Wait, let's look at db.getUserById again.
      // If we need to explicitly query, we should do it in supabase.js. 
      // But we can just use db.generateMegaCode to check FIRST!
      
      let hasMegaCode = false;
      if (freshUser && freshUser.mega_code) {
        hasMegaCode = true;
      } else {
        // Fallback explicit check to bypass select(*) schema cache issues
        const { data: megaData } = await supabase.from('users').select('mega_code').eq('id', user.id).single();
        if (megaData && megaData.mega_code) hasMegaCode = true;
      }
      
      if (mode === 1 && !hasMegaCode) {
        const megaCode = await db.generateMegaCode(user.id);
        if (megaCode) {
          const modal = document.getElementById('mega_spinner_modal');
          const audio = document.getElementById('audio_mega');
          const numberEl = document.getElementById('mega_spinner_number');
          const msgEl = document.getElementById('mega_spinner_msg');
          const header = document.getElementById('celebration_header');
          const btnStartMega = document.getElementById('btn_start_mega');
          const container = document.getElementById('mega_spinner_container');
          
          if (modal && btnStartMega && container) {
            modal.classList.remove('hidden');
            if (header) header.classList.add('hidden');
            
            btnStartMega.onclick = () => {
              btnStartMega.classList.add('hidden');
              container.classList.remove('hidden');

              // Play audio
              const audio = document.getElementById('audio_mega');
              if (audio) {
                audio.currentTime = 0;
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Audio error:', e));
              }

              const strip = document.getElementById('mega_strip');
              if (strip) {
                // Generate strip HTML
                let stripHTML = '';
                const itemWidth = 128; // matches w-32
                const winningIndex = 25;
                
                // Filler items before winner
                for (let i = 0; i < winningIndex; i++) {
                  const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                  stripHTML += `<div class="w-32 shrink-0 flex justify-center items-center text-5xl font-black text-white/40 font-['Space_Grotesk']">${rnd}</div>`;
                }
                
                // Winning item
                stripHTML += `<div class="w-32 shrink-0 flex justify-center items-center text-[54px] font-black text-yellow-300 drop-shadow-[0_0_15px_rgba(255,215,0,0.8)] font-['Space_Grotesk'] pk-text-stroke">${megaCode}</div>`;
                
                // Filler items after winner
                for (let i = 0; i < 5; i++) {
                  const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                  stripHTML += `<div class="w-32 shrink-0 flex justify-center items-center text-5xl font-black text-white/40 font-['Space_Grotesk']">${rnd}</div>`;
                }
                
                strip.innerHTML = stripHTML;

                const containerWidth = container.offsetWidth;
                const startX = (containerWidth / 2) - (itemWidth / 2);
                
                // Set initial position instantly
                strip.style.transition = 'none';
                strip.style.transform = `translateX(${startX}px)`;
                
                // Start the animation a brief moment later
                setTimeout(() => {
                  const targetX = (containerWidth / 2) - (winningIndex * itemWidth + itemWidth / 2);
                  strip.style.transition = 'transform 4.5s cubic-bezier(0.15, 0.85, 0.3, 1.0)';
                  strip.style.transform = `translateX(${targetX}px)`;
                }, 50);

                setTimeout(() => {
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
                }, 4700);
              }
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

    const formatMs = (ms) => {
      const totalSeconds = ms / 1000;
      if (totalSeconds >= 60) {
        const m = Math.floor(totalSeconds / 60);
        const s = Math.floor(totalSeconds % 60);
        const msPart = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
        return `${m}p${s}s${msPart.toString().padStart(3, '0')}'`;
      }
      const str = totalSeconds.toFixed(3);
      const parts = str.split('.');
      return `${parts[0]}s${parts[1]}'`;
    };

    let reasonHTML = '';
    if (isWin) {
      if (Number(atkCorrect) > Number(defCorrect)) {
        reasonHTML = `Bạn trả lời đúng nhiều hơn người bị thách đấu (${atkCorrect} vs ${defCorrect} câu).`;
      } else {
        if (normDefTime >= 999999000) {
           reasonHTML = `Bạn trả lời đúng ${atkCorrect} câu, trong khi người bị thách đấu chưa có thành tích.`;
        } else {
           let diffMs = Math.abs(normDefTime - normAtkTime);
           let diffSec = formatMs(diffMs);
           reasonHTML = `Bạn trả lời nhanh hơn người bị thách đấu ${diffSec} (bạn ${formattedAtkTime} vs họ ${formattedDefTime}) với cùng ${atkCorrect} câu đúng.`;
        }
      }
    } else {
      if (Number(atkCorrect) < Number(defCorrect)) {
        reasonHTML = `Bạn trả lời đúng ít hơn người bị thách đấu (${atkCorrect} vs ${defCorrect} câu).`;
      } else if (Number(atkCorrect) === Number(defCorrect) && normAtkTime > normDefTime) {
        let diffMs = Math.abs(normAtkTime - normDefTime);
        let diffSec = formatMs(diffMs);
        reasonHTML = `Bạn trả lời chậm hơn người bị thách đấu ${diffSec} (bạn ${formattedAtkTime} vs họ ${formattedDefTime}) với cùng ${atkCorrect} câu đúng.`;
      } else {
        if (normDefTime >= 999999000) {
           reasonHTML = `Bạn cần trả lời đúng ít nhất 1 câu để thách đấu thành công (Bạn đúng 0 câu).`;
        } else {
           reasonHTML = `Thành tích của bạn không vượt qua người bị thách đấu (bạn ${formattedAtkTime} vs họ ${formattedDefTime}).`;
        }
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
          const playsToday = await db.getPlaysInCurrentCycle(user.id);
          const globalLimit = await db.getCycleLimit();
          const userLimit = typeof user.max_plays === 'number' ? user.max_plays : globalLimit;
          if (playsToday >= userLimit) {
            document.getElementById('retry_limit_title').textContent = 'Hết lượt cày cuốc';
            document.getElementById('retry_limit_desc').textContent = 'Bạn đã sử dụng hết lượt cày cuốc trong thời gian quy định. Hệ thống sẽ sớm tự động hồi lại lượt mới!';
            retryLimitModal.classList.remove('hidden');
            btnRetryQuiz.disabled = false;
            btnRetryQuiz.innerHTML = initialText;
            return;
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
