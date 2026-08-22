/**
 * Quiz core gameplay engine
 * Manages question shuffling, answering state, score calculation, correct feedback, and database persistence.
 */

import { db } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticated session check
  const sessionUser = sessionStorage.getItem('current_user');
  if (!sessionUser) {
    window.location.replace('/login.html');
    return;
  }
  const user = JSON.parse(sessionUser);

  // 2. Quiz ID validation
  const quizId = sessionStorage.getItem('current_quiz_id');
  if (!quizId) {
    window.location.replace('/index.html');
    return;
  }

  // Get elements
  const questionCounter = document.getElementById('question_counter');
  const scoreDisplay = document.getElementById('score_display');
  const progressBarFill = document.getElementById('progress_bar_fill');
  const quizWeekBadge = document.getElementById('quiz_week_badge');
  const questionText = document.getElementById('question_text');
  
  const answersContainer = document.getElementById('answers_container');
  const feedbackBanner = document.getElementById('feedback_banner');
  const feedbackIcon = document.getElementById('feedback_icon');
  const feedbackTitle = document.getElementById('feedback_title');
  const feedbackSub = document.getElementById('feedback_sub');
  const btnNextQuestion = document.getElementById('btn_next_question');

  // Opt buttons references
  const optButtons = {
    red: { btn: document.getElementById('opt_red'), label: document.getElementById('text_red') },
    blue: { btn: document.getElementById('opt_blue'), label: document.getElementById('text_blue') },
    yellow: { btn: document.getElementById('opt_yellow'), label: document.getElementById('text_yellow') },
    green: { btn: document.getElementById('opt_green'), label: document.getElementById('text_green') }
  };

  // Quit buttons
  const btnQuitQuiz = document.getElementById('btn_quit_quiz');
  const quitConfirmModal = document.getElementById('quit_confirm_modal');
  const btnCancelQuit = document.getElementById('btn_cancel_quit');
  const btnConfirmQuit = document.getElementById('btn_confirm_quit');

  // Gameplay state values
  let rawQuestions = [];
  let questions = [];
  let currentIndex = 0;
  let currentScore = 0;
  let bonusScore = 0;
  let correctCount = 0;
  let hasSelected = false;
  
  let totalTimeSpent = 0; // Milliseconds
  let questionStartTime = 0;
  let wrongAnswersDetails = [];
  
  // Timer state
  let timerInterval = null;
  let currentRemainingTime = 0;
  let currentMaxTime = 15;
  const countdownTimer = document.getElementById('countdown_timer');

  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get('mode');
  const mode = modeParam === 'streak' ? 'streak' : (parseInt(modeParam) || 1);
  const stealTargetId = sessionStorage.getItem('steal_target_id');
  let targetUser = null;

  // Active quiz metadata elements
  const activeQuiz = await db.getActiveQuiz(mode === 'streak');

  if (mode === 2) {
    if (!stealTargetId) {
      window.location.replace('/index.html');
      return;
    }
    targetUser = await db.getUserById(stealTargetId);
    if (!targetUser) {
      window.location.replace('/index.html');
      return;
    }
  } else if (mode === 'streak') {
    const streakQuiz = await db.getActiveStreakQuiz();
    if (!streakQuiz) {
      window.location.replace('/index.html');
      return;
    }
  }

  // 3. Strict Limit Validation (Prevents bypassing via URL)
  if (mode === 1) {
    const playsToday = await db.getPlaysInCurrentCycle(user.id);
    const globalLimit = await db.getCycleLimit();
    const userLimit = typeof user.max_plays === 'number' ? user.max_plays : globalLimit;
    if (playsToday >= userLimit) {
      alert(`Bạn đã sử dụng hết ${userLimit} lượt cày cuốc trong chu kỳ này. Không thể vào thi!`);
      window.location.replace('/index.html');
      return;
    }
  } else if (mode === 2) {
    const stealsToday = await db.getStealsToday(user.id);
    const maxSteals = await db.getMaxStealsPerDay();
    if (stealsToday >= maxSteals) {
      alert('Bạn đã hết lượt thách đấu trong ngày! Không thể vào thi!');
      window.location.replace('/index.html');
      return;
    }
  } 
  
  if (mode === 2) {
    if (quizWeekBadge) {
      quizWeekBadge.textContent = `⚔️ THÁCH ĐẤU: ${targetUser.full_name}`;
      quizWeekBadge.classList.replace('bg-orange-50', 'bg-rose-50');
      quizWeekBadge.classList.replace('border-orange-100', 'border-rose-100');
      quizWeekBadge.classList.replace('text-[#E07242]', 'text-rose-500');
    }
    const scoreLabel = document.getElementById('score_label');
    if (scoreLabel) scoreLabel.textContent = 'Điểm Thách Đấu:';
    const bonusLabel = document.getElementById('bonus_label');
    if (bonusLabel) bonusLabel.textContent = '';
  } else if (mode === 'streak') {
    if (activeQuiz && quizWeekBadge) {
      quizWeekBadge.textContent = `🔥 Ngày ${activeQuiz.streak_day || 1}`;
    }
  } else {
    if (activeQuiz && quizWeekBadge) {
      quizWeekBadge.textContent = `Tháng ${activeQuiz.month_no || 1} • Tuần ${activeQuiz.week_no || 'Này'}`;
    }
  }

  // Fetch questions
  const loadedQuestions = await db.getQuizQuestions(quizId);
  if (!loadedQuestions || loadedQuestions.length === 0) {
    console.error('No questions found for this quiz ID', quizId);
    window.location.replace('/index.html');
    return;
  }

  rawQuestions = loadedQuestions;

  // Helper: Shuffle items in array
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Set up quiz questions sequence
  const isRandomizeOn = await db.getRandomizeQuestionsStatus();
  if (mode === 'streak') {
    const imgQs = rawQuestions.filter(q => q.image_url);
    const txtQs = rawQuestions.filter(q => !q.image_url);
    const selectedQs = [...shuffleArray(imgQs).slice(0, 2), ...shuffleArray(txtQs).slice(0, 5)];
    questions = isRandomizeOn ? shuffleArray(selectedQs) : selectedQs;
  } else {
    if (isRandomizeOn) {
      questions = shuffleArray(rawQuestions).slice(0, 10);
    } else {
      questions = rawQuestions.slice(0, 10);
    }
  }

  // Initialize Gameplay
  loadQuestion(currentIndex);

  function loadQuestion(index) {
    hasSelected = false;
    feedbackBanner.classList.add('hidden');
    answersContainer.classList.remove('opacity-50', 'opacity-80');

    // Reset buttons styles to clean original Kahoot states
    Object.keys(optButtons).forEach(key => {
      const { btn } = optButtons[key];
      btn.disabled = false;
      btn.className = btn.className.replace(/\b(ring-4|ring-emerald-500|ring-emerald-400|ring-rose-400|border-4|opacity-40|opacity-30|grayscale|scale-\[1\.03\])\b/g, '').trim();
      btn.classList.add('scale-100');
    });

    const currentQuestion = questions[index];
    if (!currentQuestion) return;

    // Reset and Start Timer
    if (timerInterval) clearInterval(timerInterval);
    currentMaxTime = currentQuestion.time_limit || 15;
    currentRemainingTime = currentMaxTime;
    questionStartTime = performance.now(); // Mốc thời gian chính xác mili-giây lúc câu hỏi xuất hiện

    const sparkContainer = document.getElementById('spark_container');
    if (countdownTimer) {
      countdownTimer.textContent = currentRemainingTime;
      countdownTimer.className = 'absolute inset-0 inline-flex items-center justify-center bg-black border-4 border-[#4A240A] rounded-full text-[#FFD700] font-black text-lg shadow-lg transition-colors';
    }
    if (sparkContainer) {
      sparkContainer.style.transform = `rotate(0deg)`;
      sparkContainer.style.opacity = '1';
    }

    timerInterval = setInterval(() => {
      currentRemainingTime--;
      if (countdownTimer) countdownTimer.textContent = currentRemainingTime;
      
      if (sparkContainer) {
        const angle = ((currentMaxTime - currentRemainingTime) / currentMaxTime) * 360;
        sparkContainer.style.transform = `rotate(${angle}deg)`;
      }
      
      if (currentRemainingTime <= 5 && countdownTimer) {
         countdownTimer.classList.remove('bg-black', 'text-[#FFD700]');
         countdownTimer.classList.add('animate-pulse', 'bg-red-600', 'text-white');
      }

      if (currentRemainingTime <= 0) {
        if (sparkContainer) sparkContainer.style.opacity = '0';
        clearInterval(timerInterval);
        if (!hasSelected) {
          handleAnswerSelection(null); // Time out
        }
      }
    }, 1000);

    // Counter UI
    questionCounter.textContent = `Câu ${index + 1}/${questions.length}`;
    scoreDisplay.textContent = currentScore;
    
    // Smooth progress fill
    const progressPerc = (index / questions.length) * 100;
    progressBarFill.style.width = `${progressPerc}%`;

    // Question content text
    questionText.textContent = currentQuestion.question_text;
    const questionImage = document.getElementById('question_image');
    if (questionImage) {
      if (currentQuestion.image_url && currentQuestion.image_url.trim() !== '') {
        questionImage.src = currentQuestion.image_url.trim();
        questionImage.classList.remove('hidden');
      } else {
        questionImage.src = '';
        questionImage.classList.add('hidden');
      }
    }

    // Randomize answers list
    const shuffledAnswers = shuffleArray(currentQuestion.answers || []);

    // Get the keys of our 4 buttons
    const optKeys = Object.keys(optButtons);

    // Dynamic map to support 1-4 answers structurally
    optKeys.forEach((key, idx) => {
      const { btn, label } = optButtons[key];
      const answerData = shuffledAnswers[idx];

      if (answerData) {
        btn.classList.remove('hidden');
        label.textContent = answerData.answer_text;
        
        // Store answer dataset attributes natively on button elements
        btn.setAttribute('data-id', answerData.id);
        btn.setAttribute('data-correct', answerData.is_correct ? 'true' : 'false');
      } else {
        // Safe hide if question has fewer than 4 choices
        btn.classList.add('hidden');
      }
    });
  }

  // Setup click listeners on colored option buttons
  Object.keys(optButtons).forEach(key => {
    const { btn } = optButtons[key];
    btn.addEventListener('click', () => {
      if (hasSelected) return;
      handleAnswerSelection(btn);
    });
  });

  function handleAnswerSelection(selectedButton) {
    if (hasSelected) return; // Prevent double trigger
    hasSelected = true;
    if (timerInterval) clearInterval(timerInterval);

    // Calculate exact time spent in milliseconds for this question
    const elapsedMs = Math.max(0, Math.round(performance.now() - questionStartTime));
    const maxMs = currentMaxTime * 1000;
    const timeSpentForThisQuestion = Math.min(elapsedMs, maxMs);
    totalTimeSpent += timeSpentForThisQuestion;

    answersContainer.classList.add('opacity-80');

    const isCorrect = selectedButton ? (selectedButton.getAttribute('data-correct') === 'true') : false;
    const selectedAnswerId = selectedButton ? selectedButton.getAttribute('data-id') : null;

    // Freeze all choices
    Object.keys(optButtons).forEach(key => {
      optButtons[key].btn.disabled = true;
    });

    const currentQuestion = questions[currentIndex];
    const basePoint = 10; // Cố định 10 điểm theo yêu cầu

    if (isCorrect) {
      // Correct flow
      correctCount += 1;
      let bonusEarned = 0;

      currentScore += basePoint;
      bonusScore += bonusEarned;
      
      // Update score display immediately for microfeedback
      scoreDisplay.textContent = currentScore;
      const scorePill = document.getElementById('score_pill');
      if (scorePill) {
        scorePill.classList.remove('score-animate');
        void scorePill.offsetWidth; // trigger reflow
        scorePill.classList.add('score-animate');
      }

      // Animate selected button
      selectedButton.classList.add('ring-4', 'ring-emerald-400');

      // Style feedback banner beautiful green success
      feedbackBanner.className = "mb-6 p-4 rounded-3xl bg-emerald-600 text-white flex items-center justify-between shadow-lg";
      feedbackIcon.className = "w-10 h-10 rounded-2xl bg-white text-emerald-600 flex items-center justify-center font-black text-xl";
      feedbackIcon.textContent = "✓";
      feedbackTitle.textContent = "CHÍNH XÁC! 🎉";
      feedbackSub.textContent = `+${basePoint} Điểm${bonusEarned > 0 ? ` (+${bonusEarned}đ Thưởng Tốc Độ)` : ''}`;
    } else {
      // Incorrect flow
      let selectedText = "";

      if (selectedButton) {
        selectedButton.classList.add('ring-4', 'ring-rose-400');
        feedbackTitle.textContent = "SAI MẤT RỒI! 😢";
        
        Object.keys(optButtons).forEach(key => {
          if (optButtons[key].btn === selectedButton) {
            selectedText = optButtons[key].label.textContent;
          }
        });
      } else {
        feedbackTitle.textContent = "HẾT GIỜ! ⏰";
        selectedText = "Không trả lời";
      }

      let correctText = "";
      Object.keys(optButtons).forEach(key => {
        if (optButtons[key].btn.getAttribute('data-correct') === 'true') {
          correctText = optButtons[key].label.textContent;
        }
      });

      wrongAnswersDetails.push({
        question: currentQuestion.question_text,
        selected: selectedText,
        correct: correctText
      });

      // Style feedback banner red error
      feedbackBanner.className = "mb-6 p-4 rounded-3xl bg-rose-600 text-white flex items-center justify-between shadow-lg animate-shake";
      feedbackIcon.className = "w-10 h-10 rounded-2xl bg-white text-rose-600 flex items-center justify-center font-black text-xl animate-bounce";
      feedbackIcon.textContent = "✗";
      feedbackSub.textContent = "Cố gắng câu sau nhé!";
    }

    // Highlight the correct answer vividly and turn all incorrect answers gray
    Object.keys(optButtons).forEach(key => {
      const currentBtn = optButtons[key].btn;
      const optCorrect = currentBtn.getAttribute('data-correct') === 'true';
      
      if (optCorrect) {
        currentBtn.classList.remove('opacity-40', 'opacity-30', 'grayscale');
        currentBtn.classList.add('ring-4', 'ring-emerald-500', 'scale-[1.03]');
      } else {
        currentBtn.classList.add('grayscale', 'opacity-30');
      }
    });

    // Make feedback details visible
    feedbackBanner.classList.remove('hidden');
  }

  // Handle "TIẾP TỤC" (Next question or finish)
  btnNextQuestion.addEventListener('click', async () => {
    currentIndex += 1;

    if (currentIndex < questions.length) {
      // Transition to next question
      loadQuestion(currentIndex);
    } else {
      // Quiz finished! Calculate final calculations
      btnNextQuestion.disabled = true;
      btnNextQuestion.textContent = "ĐANG LƯU...";

      // If quiz finished, score is currentScore (max 100)
      const earnedBonus = bonusScore;
      const totalQuizScore = currentScore;

      try {
        // Save results to Database
        const wrongCount = questions.length - correctCount;
        const result = await db.savePlayRecord(user.id, quizId, totalQuizScore + earnedBonus, correctCount, wrongCount, totalTimeSpent, wrongAnswersDetails, mode, stealTargetId);

        if (mode === 2) {
          if (result && result.success) {
            sessionStorage.setItem('steal_result_is_win', String(result.isWin));
            sessionStorage.setItem('steal_result_win_points', String(result.winPoints || 20));
            sessionStorage.setItem('steal_result_lose_points', String(result.losePoints || 10));
            sessionStorage.setItem('steal_result_def_correct', String(result.defCorrect || 0));
            sessionStorage.setItem('steal_result_def_time', String(result.defTime || 0));
            sessionStorage.setItem('steal_result_atk_correct', String(result.atkCorrect || 0));
            sessionStorage.setItem('steal_result_atk_time', String(result.atkTime || 0));
          } else {
            // executeSteal failed (e.g. already challenged today) - treat as error
            console.error('Steal failed:', result?.message);
            sessionStorage.setItem('steal_result_is_win', 'error');
            sessionStorage.setItem('steal_result_error_msg', result?.message || 'Lỗi thách đấu');
          }
        }

        // Save session items so results page can display them elegantly
        sessionStorage.setItem('last_quiz_score', totalQuizScore);
        sessionStorage.setItem('last_quiz_correct_count', correctCount);
        sessionStorage.setItem('last_quiz_bonus', earnedBonus);
        sessionStorage.setItem('last_quiz_total_questions', questions.length);
        sessionStorage.setItem('last_quiz_mode', mode);

        // Redirect to results visualizer page
        window.location.replace('/result.html');
      } catch (err) {
        console.error('Failed to commit results history record', err);
        // Navigate gracefully regardless to prevent blocking user progress
        window.location.replace('/result.html');
      }
    }
  });

  // Quit and Modal management routines
  if (btnQuitQuiz) {
    btnQuitQuiz.addEventListener('click', () => {
      quitConfirmModal.classList.remove('hidden');
    });
  }

  if (btnCancelQuit) {
    btnCancelQuit.addEventListener('click', () => {
      quitConfirmModal.classList.add('hidden');
    });
  }

  if (btnConfirmQuit) {
    btnConfirmQuit.addEventListener('click', () => {
      window.location.replace('/index.html');
    });
  }
});
