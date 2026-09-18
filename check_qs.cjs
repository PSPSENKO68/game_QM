const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = require('dotenv').config({ path: '/Users/user/Downloads/game_QM/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: quizzes } = await supabase.from('quizzes').select('*').eq('active', true).is('streak_day', null);
  console.log('Active quizzes:', quizzes.map(q => ({id: q.id, title: q.title})));
  
  if (quizzes.length > 0) {
    const { data: qs } = await supabase.from('questions').select('id, image_url').eq('quiz_id', quizzes[0].id);
    console.log(`Quiz ${quizzes[0].title} has ${qs.length} questions.`);
    const imgQs = qs.filter(q => q.image_url).length;
    const txtQs = qs.length - imgQs;
    console.log(`Image Qs: ${imgQs}, Text Qs: ${txtQs}`);
  }
}
check();
