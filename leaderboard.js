/**
 * Leaderboard — Game HRIS
 * Hiển thị bảng xếp hạng Top 20 nhân viên điểm cao nhất.
 */

import { db } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  const leaderboardList = document.getElementById('leaderboard_list');
  const selfRankRow = document.getElementById('self_rank_row');
  const selfRankNum = document.getElementById('self_rank_num');
  const selfName = document.getElementById('self_name');
  const selfDept = document.getElementById('self_dept');
  const selfScore = document.getElementById('self_score');

    // Session user
  const sessionUser = sessionStorage.getItem('current_user');
  let currentUser = sessionUser ? JSON.parse(sessionUser) : null;

  const urlParams = new URLSearchParams(window.location.search);
  const isActionSteal = urlParams.get('action') === 'steal';

  const module2Status = await db.getModule2Status();
  const isStealMode = module2Status || isActionSteal;

  const isStreakMode = urlParams.get('mode') === 'streak';

  if (isStreakMode) {
    const titleEl = document.querySelector('h2');
    if (titleEl) titleEl.textContent = 'TOP LÂM TẶC GIỮ CHUỖI';
    const subtitleEl = document.querySelector('p.text-xs');
    if (subtitleEl) subtitleEl.textContent = 'Dựa trên chuỗi ngày sống sót cao nhất';
  } else if (isStealMode) {
    const titleEl = document.querySelector('h2');
    if (titleEl) titleEl.textContent = 'CHỌN MỤC TIÊU SĂN MỒI';
    const subtitleEl = document.querySelector('p.text-xs');
    if (subtitleEl) subtitleEl.textContent = 'Chọn một đối thủ để khiêu chiến và thách đấu';
  }

  // --- Defense History Logic ---
  const btnHistoryModal = document.getElementById('btn_history_modal');
  const defenseHistoryModal = document.getElementById('defense_history_modal');
  const defenseHistoryList = document.getElementById('defense_history_list');
  const btnCloseDefenseHistory = document.getElementById('btn_close_defense_history');

  if (currentUser && btnHistoryModal) {
    btnHistoryModal.classList.remove('hidden');
    
    btnHistoryModal.addEventListener('click', async () => {
      if (defenseHistoryModal) defenseHistoryModal.classList.remove('hidden');
      if (defenseHistoryList) {
        defenseHistoryList.innerHTML = '<p class="text-center text-xs text-[#8B5A2B] font-bold mt-4">Đang tải lịch sử...</p>';
        const history = await db.getDefenseHistory(currentUser.id);
        
        if (!history || history.length === 0) {
          defenseHistoryList.innerHTML = '<p class="text-center text-xs text-[#8B5A2B] font-bold mt-4">Chưa có ai thách đấu bạn.</p>';
          return;
        }

        defenseHistoryList.innerHTML = '';
        history.forEach(record => {
          const isWin = !record.is_success; // Tức là người thủ thắng (kẻ địch thua)
          const statusHtml = isWin 
            ? '<span class="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Phòng thủ THÀNH CÔNG</span>'
            : '<span class="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px]">Bị cướp THÀNH CÔNG</span>';
            
          const attackerName = record.attacker ? record.attacker.full_name : 'Người ẩn danh';
          const attackerDept = record.attacker ? record.attacker.department : '';
          
          const timeLabel = new Date(record.created_at).toLocaleString('vi-VN', { 
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          });

          const formatTime = (ms) => {
            const m = parseInt(ms) || 0;
            const sec = Math.floor(m / 1000);
            const milli = String(m % 1000).padStart(3, '0');
            return `${sec}s${milli}'`;
          };

          const atkTime = formatTime(record.attacker_time_spent);
          const defTime = formatTime(record.defender_time_spent);

          const div = document.createElement('div');
          div.className = 'border-b-2 border-dashed border-[#8B5A2B]/20 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0';
          div.innerHTML = `
            <div class="flex justify-between items-start mb-1">
              <div>
                <p class="font-bold text-[#4A240A] text-[12px]">${attackerName}</p>
                <p class="text-[10px] text-[#8B5A2B]">${attackerDept}</p>
              </div>
              <div class="text-right">
                ${statusHtml}
                <p class="text-[9px] text-[#8B5A2B] mt-1">${timeLabel}</p>
              </div>
            </div>
            <div class="flex justify-between items-center text-[10px] bg-white/50 p-1.5 rounded">
              <span class="text-[#DE3A3B] font-bold">Kẻ địch: ${record.attacker_correct_count || 0} câu (${atkTime})</span>
              <span class="text-emerald-600 font-bold">Bạn: ${record.defender_correct_count || 0} câu (${defTime})</span>
            </div>
          `;
          defenseHistoryList.appendChild(div);
        });
      }
    });
  }

  if (btnCloseDefenseHistory) {
    btnCloseDefenseHistory.addEventListener('click', () => {
      if (defenseHistoryModal) defenseHistoryModal.classList.add('hidden');
    });
  }

  try {
    const rankings = isStreakMode ? await db.getStreakLeaderboard() : await db.getLeaderboard();

    leaderboardList.innerHTML = '';

    if (!rankings || rankings.length === 0) {
      leaderboardList.innerHTML = `
        <div class="py-12 text-center text-[#877A6E] text-xs font-semibold">
          Chưa có hoạt động xếp hạng nào được ghi nhận.
        </div>
      `;
      return;
    }

    // Tìm vị trí của user hiện tại bằng ID (chính xác hơn name)
    let currentUserRank = -1;
    let currentUserScore = currentUser ? (currentUser.total_score || 0) : 0;

    if (currentUser) {
      const foundIdx = rankings.findIndex(r => r.user_id === currentUser.id || r.id === currentUser.id);
      if (foundIdx !== -1) {
        currentUserRank = foundIdx + 1;
        currentUserScore = isStreakMode ? (rankings[foundIdx].maxStreakDay || 0) : rankings[foundIdx].total_score;
      } else {
        if (!isStreakMode) {
          const realRank = await db.getUserRank(currentUser.id);
          currentUserRank = realRank || '20+';
        }
      }
    }

    // Hiển thị badge rank cá nhân
    if (currentUser && selfRankRow) {
      selfName.textContent = currentUser.full_name;
      selfDept.textContent = currentUser.department;
      const coinIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="inline-block ml-1 drop-shadow-md" style="transform: translateY(-2px);">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFF500" />
            <stop offset="50%" stop-color="#FFB800" />
            <stop offset="100%" stop-color="#FF8A00" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#goldGrad)" stroke="#A0522D" stroke-width="2"/>
        <circle cx="12" cy="12" r="8" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.6"/>
        <path d="M12 7l1.5 4.5h4.5l-3.5 2.5 1.5 4.5-4-3-4 3 1.5-4.5-3.5-2.5h4.5z" fill="#FFFFFF" opacity="0.9"/>
      </svg>`;
      selfScore.innerHTML = isStreakMode ? `Chuỗi ${currentUserScore}` : `${currentUserScore} ${coinIcon}`;
      
      const freshUser = await db.getUserById(currentUser.id);
      if (freshUser && freshUser.mega_code) {
        const selfMega = document.getElementById('self_mega_code');
        if (selfMega) {
          selfMega.textContent = `MEGA: ${freshUser.mega_code}`;
          selfMega.classList.remove('hidden');
        }
      }

      const bestPlay = await db.getBestPlayOverall(currentUser.id);
      if (bestPlay) {
        document.getElementById('self_correct').textContent = bestPlay.correct_count || 0;
        document.getElementById('self_wrong').textContent = bestPlay.wrong_count || 0;
        document.getElementById('self_time').textContent = db.formatTimeSpent(bestPlay.time_spent);
        
        const maxSteals = await db.getMaxStealsPerDay();
        const usedSteals = await db.getStealsToday(currentUser.id);
        const selfStealsEl = document.getElementById('self_steals');
        if (selfStealsEl) selfStealsEl.textContent = `${usedSteals}/${maxSteals}`;
        
        document.getElementById('self_stats_row').classList.remove('hidden');
      }
      
      // Hiển thị rank cho tất cả người chơi
      if (currentUserRank && currentUserRank > 0) {
        selfRankNum.textContent = `#${currentUserRank}`;
      } else {
        selfRankNum.textContent = `--`;
      }
      selfRankRow.classList.remove('hidden');
    }

    // Render danh sách - hiển thị tất cả người chơi
    const playersWithScore = rankings;
    let rankCounter = 1;
    playersWithScore.forEach((player, index) => {
      const rank = index + 1;
      const isSelf = currentUser && ((player.id || player.user_id) === currentUser.id);

      // Medal icon
      let medalHtml = '';
      if (rank === 1) {
        medalHtml = `<div class="w-10 h-10 rounded-full medal-gold flex items-center justify-center text-lg shadow-sm">🥇</div>`;
      } else if (rank === 2) {
        medalHtml = `<div class="w-10 h-10 rounded-full medal-silver flex items-center justify-center text-lg shadow-sm">🥈</div>`;
      } else if (rank === 3) {
        medalHtml = `<div class="w-10 h-10 rounded-full medal-bronze flex items-center justify-center text-lg shadow-sm">🥉</div>`;
      } else {
        medalHtml = `<div class="w-10 h-10 rounded-full medal-default flex items-center justify-center text-[13px] font-black font-['Space_Grotesk'] shadow-sm">#${rank}</div>`;
      }

      const selfBadge = isSelf
        ? `<span class="inline-flex px-2 py-0.5 text-[9px] font-black rounded bg-[#FFD700] text-[#2B1607] uppercase tracking-wider border border-[#8B6508] shadow-sm ml-2">BẠN</span>`
        : '';

      // Score color
      const scoreColor = rank <= 3 ? '#DE3A3B' : '#4A2E15';

      let actionHtml = '';
      const playerScore = isStreakMode ? (player.maxStreakDay || 0) : (parseInt(player.total_score) || 0);
      const coinIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="inline-block ml-1 drop-shadow-md" style="transform: translateY(-2px);">
        <defs>
          <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFF500" />
            <stop offset="50%" stop-color="#FFB800" />
            <stop offset="100%" stop-color="#FF8A00" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#goldGrad2)" stroke="#A0522D" stroke-width="2"/>
        <circle cx="12" cy="12" r="8" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.6"/>
        <path d="M12 7l1.5 4.5h4.5l-3.5 2.5 1.5 4.5-4-3-4 3 1.5-4.5-3.5-2.5h4.5z" fill="#FFFFFF" opacity="0.9"/>
      </svg>`;
      const playerDisplayScore = isStreakMode ? `Chuỗi ${playerScore}` : `${playerScore} ${coinIcon}`;
      const playerId = isStreakMode ? player.user_id : player.id;
      const playerName = isStreakMode ? player.user.full_name : player.full_name;
      const playerDept = isStreakMode ? player.user.department : player.department;
      const playerMega = isStreakMode ? player.user.mega_code : player.mega_code;
      
      if (isStealMode && !isStreakMode && playerId !== currentUser.id) {
        if (playerScore <= 0) {
          actionHtml = `<button class="btn-steal btn-pirate px-3 py-1.5 ml-3 shrink-0 text-[11px] uppercase tracking-wider opacity-40 cursor-not-allowed" disabled>Thách Đấu ⚔️</button>`;
        } else {
          actionHtml = `<button class="btn-steal btn-pirate px-3 py-1.5 ml-3 cursor-pointer shrink-0 text-[11px] uppercase tracking-wider" data-id="${player.id}">Thách Đấu ⚔️</button>`;
        }
      }

      const row = document.createElement('div');
      row.className = `rank-row ${isSelf ? 'is-self' : ''} ${rank === 1 ? 'is-top-1' : ''}`;
      row.innerHTML = `
        <div class="flex items-center gap-3 flex-1 overflow-hidden">
          ${medalHtml}
          <div class="flex-1">
            <div class="font-black text-[14px] text-[#2B1607] flex flex-wrap items-center gap-x-1.5 gap-y-1 drop-shadow-sm">
              <span class="break-words leading-tight flex-1 min-w-0">${playerName}</span>
              ${selfBadge}
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 mt-1.5 items-center">
              <span class="text-[11px] text-[#8B5A2B] font-bold">${playerDept || '—'}</span>
              <div class="flex">
                ${playerMega ? `<span class="text-[#DE3A3B] bg-rose-50 px-1.5 py-0.5 rounded shadow-sm border border-rose-100 text-[10px] shrink-0">MEGA: ${playerMega}</span>` : ''}
              </div>
              <div></div>
              <div class="flex text-[11px] font-bold">
                ${(player.best_time && player.best_time < 999999000) ? `<span class="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100 flex items-center gap-1 shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${db.formatTimeSpent(player.best_time)}</span>` : `<span class="text-[#8B5A2B]/60 bg-white/50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-[#8B5A2B]/10 shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Chưa có</span>`}
              </div>
            </div>
          </div>
        </div>
        <div class="text-right flex items-center justify-end pl-2 shrink-0">
          <span class="text-[17px] font-black font-['Space_Grotesk'] shrink-0 whitespace-nowrap" style="color:${scoreColor}">${playerDisplayScore}</span>
          ${actionHtml}
        </div>
      `;
      leaderboardList.appendChild(row);
    });
    
    // Tự động cuộn đến vị trí của mình
    setTimeout(() => {
      const selfRow = leaderboardList.querySelector('.is-self');
      if (selfRow) {
        selfRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);

    // Bind Steal buttons
    if (isStealMode) {
      // Helper function for custom alerts
      const showCustomAlert = (msg) => {
        const modal = document.getElementById('custom_alert_modal');
        const msgEl = document.getElementById('custom_alert_message');
        const btnClose = document.getElementById('btn_close_custom_alert');
        if (modal && msgEl && btnClose) {
          msgEl.textContent = msg;
          modal.classList.remove('hidden');
          btnClose.onclick = () => modal.classList.add('hidden');
        } else {
          alert(msg); // Fallback
        }
      };

      document.querySelectorAll('.btn-steal').forEach(btn => {
        btn.addEventListener('click', async () => {
          const targetId = btn.getAttribute('data-id');
          
          if (!currentUser) return;

          btn.textContent = '...';

          // Check limits before steal mode
          const stealsToday = await db.getStealsToday(currentUser.id);
          const maxSteals = await db.getMaxStealsPerDay();
          if (stealsToday >= maxSteals) {
            showCustomAlert('Bạn đã hết lượt thách đấu hôm nay!');
            btn.textContent = 'Thách Đấu ⚔️';
            return;
          }

          // Check if already challenged THIS SPECIFIC person today
          const alreadyChallenged = await db.hasStolenFromUserToday(currentUser.id, targetId);
          if (alreadyChallenged) {
            showCustomAlert('Bạn đã thách đấu người này hôm nay rồi! Hãy chọn đối thủ khác.');
            btn.textContent = 'Thách Đấu ⚔️';
            return;
          }
          
          // Lấy cấu hình hệ số và hiển thị popup
          const multipliers = await db.getStealMultipliers();
          const basePoints = await db.getStealBasePoints();
          
          const elWinMult = document.getElementById('modal_win_multiplier');
          if (elWinMult) elWinMult.textContent = multipliers.win;
          
          const elLoseMult = document.getElementById('modal_lose_multiplier');
          if (elLoseMult) elLoseMult.textContent = multipliers.lose;

          const elWinBase = document.getElementById('modal_win_base');
          if (elWinBase) elWinBase.textContent = basePoints.win;

          const elLoseBase = document.getElementById('modal_lose_base');
          if (elLoseBase) elLoseBase.textContent = basePoints.lose;
          
          const elStealsCount = document.getElementById('modal_steals_count');
          if (elStealsCount) elStealsCount.textContent = `${stealsToday}/${maxSteals}`;

          const modal = document.getElementById('steal_confirm_modal');
          if (modal) modal.classList.remove('hidden');

          const btnCancel = document.getElementById('btn_cancel_steal');
          const btnConfirm = document.getElementById('btn_confirm_steal');

          if (btnCancel) {
            btnCancel.onclick = () => {
              modal.classList.add('hidden');
              btn.textContent = 'Thách Đấu ⚔️';
            };
          }

          if (btnConfirm) {
            btnConfirm.onclick = () => {
              btnConfirm.disabled = true;
              btnConfirm.textContent = 'ĐANG VÀO TRẬN...';
              sessionStorage.setItem('steal_target_id', targetId);
              window.location.href = '/quiz.html?mode=2';
            };
          }
        });
      });
    }

    // Nếu không có ai có điểm
    if (playersWithScore.length === 0) {
      leaderboardList.innerHTML = `<div class="py-12 text-center text-[#877A6E] text-xs font-semibold">Chưa có người chơi nào có điểm. Hãy là người đầu tiên!</div>`;
    }

  } catch (error) {
    console.error('Leaderboard error:', error);
    if (leaderboardList) {
      leaderboardList.innerHTML = `
        <div class="py-12 text-center text-rose-500 text-xs font-semibold">
          Lỗi tải dữ liệu. Vui lòng kiểm tra kết nối.
        </div>
      `;
    }
  }
});
