# Asked

Interview questions companies actually asked, pulled from LeetCode interview-experience posts and sorted by round (DSA, OA, LLD, HLD, Behavioral).

## How it works

1. `fetcher.js` downloads recent posts from LeetCode and saves them in the `raw_posts` table as `PENDING` (or `DROPPED` if they're not interview posts).
2. `parser.js` sends each `PENDING` post to the Groq LLM, saves the questions in the `questions` table, and marks the post `PROCESSED`.
3. `app.js` is an Express API that the React frontend calls.
4. GitHub Actions runs steps 1 and 2 every 6 hours.

## Folder structure

```
backend/
  app.js          Express API
  fetcher.js      LeetCode -> raw_posts
  parser.js       raw_posts -> LLM -> questions
  supabase.js     Supabase client
  helpers.js      small helper functions
  tests/          tests for helpers.js
frontend/
  src/App.jsx         switches between the list and a post
  src/PostList.jsx    list of posts with company filter and search
  src/PostDetail.jsx  one post with all its questions
db/schema.sql     run this once in Supabase
.github/workflows/
  ci.yml          tests + build + Docker images on every push
  ingest.yml      runs fetcher + parser every 6 hours
```

## Setup

1. In Supabase, open **SQL Editor** and run `db/schema.sql`.
2. Install packages (this also creates `package-lock.json`, **commit it**, GitHub Actions needs it):
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Copy `backend/.env.example` to `backend/.env` and fill it in.

## Run locally

```bash
# terminal 1
cd backend
npm run fetch      # get posts from LeetCode
npm run parse      # extract questions with the LLM
npm run dev        # API on http://localhost:4000

# terminal 2
cd frontend
npm run dev        # website on http://localhost:5173
```

Or with Docker: `docker compose up --build`, then open http://localhost:8080.

## Tests

```bash
cd backend
npm test
```

## GitHub Actions

Add these in your repo under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key (needed to write data) |
| `GROQ_API_KEY` | your Groq key |

- **ci.yml** runs tests and builds the frontend on every push. On `main` it also pushes Docker images to `ghcr.io/<your-username>/asked-backend` and `asked-frontend`. (The registry needs a lowercase username; if yours has capitals, change `github.repository_owner` in the workflow to your name in lowercase.)
- **ingest.yml** runs the fetcher and parser every 6 hours. You can also run it from the **Actions** tab.

Note: LeetCode sometimes blocks GitHub's servers. If the fetch step fails with a 403, run `npm run fetch` from your laptop and let GitHub do the parsing.

## API

| Endpoint | What it returns |
| --- | --- |
| `GET /api/posts?page=1&company=Amazon&q=sde` | posts, newest first |
| `GET /api/posts/:postId` | one post with all its questions |
| `GET /api/companies` | companies and how many posts each has |
| `GET /api/health` | `{ "status": "ok" }` |

## Fixes compared to the Python version

- `/api/posts` pages through posts, not questions, so a post with 3 questions shows once.
- Companies come from a database view instead of loading the whole table.
- A post that fails parsing is retried at most 3 times, then marked `FAILED`.
- Running the parser twice doesn't create duplicate questions.
- Practice links are checked against LeetCode, so made-up links are removed.
- The pre-filter matches whole words, so "oa" no longer matches "load" or "board".
- The API uses the read-only `anon` key; only the jobs use the `service_role` key.
