require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');

const app = express();


app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// List of posts, newest first. Each post includes a short list of its questions.
app.get('/api/posts', async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const company = req.query.company;
  const search = req.query.q;

  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: 'page must be a number >= 1' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ error: 'limit must be between 1 and 50' });
  }

  const start = (page - 1) * limit;
  const end = start + limit - 1;
  let query = supabase
    .from('raw_posts')
    .select('topic_id, title, company, created_at', { count: 'exact' })
    .eq('status', 'PROCESSED');

  if (company) {
    query = query.eq('company', company);
  }
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const { data: posts, count, error } = await query
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load posts' });
  }

  if (posts.length === 0) {
    return res.json({ page, limit, total: 0, total_pages: 1, data: [] });
  }

  // Get the questions for all these posts in ONE query
  const postIds = posts.map((post) => post.topic_id);
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('topic_id, role, round_type, problem_title')
    .in('topic_id', postIds)
    .order('id');

  if (questionsError) {
    console.error(questionsError);
    return res.status(500).json({ error: 'Could not load questions' });
  }

  const output = posts.map((post) => {
    const postQuestions = questions.filter((q) => q.topic_id === post.topic_id);

    return {
      post_id: post.topic_id,
      title: post.title,
      company: post.company,
      role: postQuestions.length > 0 ? postQuestions[0].role : null,
      created_at: post.created_at,
      question_count: postQuestions.length,
      questions: postQuestions.slice(0, 3).map((q) => ({
        round_type: q.round_type,
        problem_title: q.problem_title,
      })),
    };
  });

  res.json({
    page,
    limit,
    total: count,
    total_pages: Math.ceil(count / limit),
    data: output,
  });
});

// One post with all of its questions
app.get('/api/posts/:postId', async (req, res) => {
  const postId = req.params.postId;

  const { data: post, error } = await supabase
    .from('raw_posts')
    .select('topic_id, title, company, url, created_at')
    .eq('topic_id', postId)
    .eq('status', 'PROCESSED')
    .maybeSingle();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load post' });
  }
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('topic_id', postId)
    .order('id');

  if (questionsError) {
    console.error(questionsError);
    return res.status(500).json({ error: 'Could not load questions' });
  }

  res.json({
    post_id: post.topic_id,
    title: post.title,
    company: post.company,
    role: questions.length > 0 ? questions[0].role : null,
    source_url: post.url,
    created_at: post.created_at,
    questions: questions.map((q) => ({
      id: q.id,
      round_type: q.round_type,
      problem_title: q.problem_title,
      problem_statement: q.problem_statement,
      input_format: q.input_format,
      output_format: q.output_format,
      sample_io: q.sample_io || [],
      practice_links: q.practice_links || [],
    })),
  });
});

// Companies with how many posts each has (uses the "companies" view from schema.sql)
app.get('/api/companies', async (req, res) => {
  const { data, error } = await supabase
    .from('companies')
    .select('company, post_count')
    .order('company');

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load companies' });
  }

  res.json({ companies: data });
});

// Start the server only when you run "node app.js"
if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

module.exports = app;
