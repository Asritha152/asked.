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

