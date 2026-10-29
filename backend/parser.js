const Groq = require('groq-sdk');
const supabase = require('./supabase');
const { cleanRoundType, pickCompany, getLeetCodeSlug } = require('./helpers');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'openai/gpt-oss-120b';
const MAX_ATTEMPTS = 3; // after 3 failures a post is marked FAILED instead of retrying forever

const SYSTEM_PROMPT = `You are a strict data extraction API. Extract technical interview questions from the text.
Extract I/O ONLY if explicitly provided. Never invent examples.
round_type must be one of: DSA, LLD, HLD, OA, BEHAVIORAL.
"company" is the company that interviewed the author. Check the title first
(e.g. "Trintech - Senior Software Engineer" means "Trintech"), then the post text.
Use "Unknown" only if no company is named anywhere.
For practice_links, only include LeetCode problems you are sure exist, with url "https://leetcode.com/problems/<slug>/".
If there are no technical questions (e.g., career advice), return exactly: {"company": "Unknown", "questions": []}.
You MUST output ONLY valid JSON that matches this structure:
{
  "company": "Stripe",
  "role": "Software Engineer",
  "questions": [
    {
      "round_type": "OA",
      "problem_title": "Sliding Window Alert System",
      "problem_statement": "Full description of the problem...",
      "has_io": true,
      "input_format": "timestamp, merchant_id...",
      "output_format": "timestamp, EVENT_TYPE...",
      "sample_io": [
        {"input": "10,merchant1,500,2", "output": "20,TRIGGER...", "explanation": "optional explanation"}
      ],
      "practice_links": [
        {"platform": "LeetCode", "title": "Number of Recent Calls", "url": "https://leetcode.com/problems/number-of-recent-calls/", "similarity": "SIMILAR"}
      ]
    }
  ]
}`;

async function askLLM(post) {
  // Don't write "Company: Unknown" in the prompt; the LLM just copies it back
  const companyTag = post.company === 'Unknown' ? 'none' : post.company;
  const userPrompt = `Title: ${post.title}\nLeetCode company tag: ${companyTag}\n\nContent:\n${post.content.slice(0, 20000)}`;

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const result = JSON.parse(completion.choices[0].message.content);

  if (!Array.isArray(result.questions)) {
    throw new Error('LLM response has no "questions" list');
  }
  return result;
}

// Ask LeetCode if a problem exists. Returns { title, titleSlug } or null.
async function findLeetCodeProblem(slug) {
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query ($slug: String!) { question(titleSlug: $slug) { title titleSlug } }',
        variables: { slug },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    return json.data ? json.data.question : null;
  } catch (err) {
    return null;
  }
}

// The LLM sometimes makes up links, so keep only real LeetCode problems
async function cleanPracticeLinks(links) {
  const cleaned = [];

  for (const link of links || []) {
    const slug = getLeetCodeSlug(link.url);
    if (!slug) continue; // not a LeetCode link

    const problem = await findLeetCodeProblem(slug);
    if (!problem) continue; // problem doesn't exist

    cleaned.push({
      platform: 'LeetCode',
      title: problem.title,
      url: `https://leetcode.com/problems/${problem.titleSlug}/`,
      similarity: link.similarity || 'SIMILAR',
    });
  }

  return cleaned;
}

async function saveQuestions(post, result) {
  const questions = result.questions.filter((q) => q.problem_title);

  // No actual questions in this post, so drop it
  if (questions.length === 0) {
    await supabase.from('raw_posts').update({ status: 'DROPPED' }).eq('topic_id', post.topic_id);
    console.log(`[-] Dropped ${post.topic_id} (0 questions)`);
    return;
  }

  const company = pickCompany(result.company, post.company);
  const rows = [];

  for (const q of questions) {
    rows.push({
      topic_id: post.topic_id,
      company: company,
      role: result.role || null,
      round_type: cleanRoundType(q.round_type),
      problem_title: q.problem_title,
      problem_statement: q.problem_statement || '',
      has_io: Boolean(q.has_io),
      input_format: q.input_format || null,
      output_format: q.output_format || null,
      sample_io: q.sample_io || [],
      practice_links: await cleanPracticeLinks(q.practice_links),
      source_url: post.url,
      created_at: post.created_at,
    });
  }

  // Delete old questions for this post first, so running twice never creates duplicates
  await supabase.from('questions').delete().eq('topic_id', post.topic_id);

  const { error } = await supabase.from('questions').insert(rows);
  if (error) throw error;

  await supabase
    .from('raw_posts')
    .update({ status: 'PROCESSED', company: company })
    .eq('topic_id', post.topic_id);

  console.log(`[+] Saved ${rows.length} question(s) for ${company} (${post.topic_id})`);
}

async function markFailed(post, err) {
  const attempts = (post.attempts || 0) + 1;
  const status = attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';

  await supabase
    .from('raw_posts')
    .update({ status: status, attempts: attempts, last_error: err.message })
    .eq('topic_id', post.topic_id);

  console.log(`[!] Error parsing ${post.topic_id} (attempt ${attempts}): ${err.message}`);
}

async function parsePost(post) {
  try {
    const result = await askLLM(post);
    await saveQuestions(post, result);
  } catch (err) {
    await markFailed(post, err);
  }
}

async function runParser() {
  const { data: posts, error } = await supabase
    .from('raw_posts')
    .select('topic_id, title, company, url, created_at, content, attempts')
    .eq('status', 'PENDING')
    .lt('attempts', MAX_ATTEMPTS)
    .limit(30);

  if (error) throw error;

  if (posts.length === 0) {
    console.log('No pending posts to parse.');
    return;
  }

  console.log(`Found ${posts.length} pending posts. Parsing 3 at a time...`);

  // Same idea as ThreadPoolExecutor(max_workers=3) in the Python version
  for (let i = 0; i < posts.length; i += 3) {
    const group = posts.slice(i, i + 3);
    await Promise.all(group.map((post) => parsePost(post)));
  }

  console.log('Parsing finished.');
}

if (require.main === module) {
  runParser().catch((err) => {
    console.error('Parser failed:', err);
    process.exit(1);
  });
}
