import { useEffect, useState } from 'react';
import RoundTag from './RoundTag.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

// Grey placeholder cards shown while posts load
function LoadingCards() {
  return (
    <ol className="cards" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="card card-skeleton">
          <span className="skel skel-sm" />
          <span className="skel skel-lg" />
          <span className="skel" />
          <span className="skel skel-md" />
        </li>
      ))}
    </ol>
  );
}

function PostList({ onOpenPost }) {
  const [posts, setPosts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load the company list once
  useEffect(() => {
    fetch(`${API_URL}/api/companies`)
      .then((res) => res.json())
      .then((data) => setCompanies(data.companies || []))
      .catch(() => setCompanies([]));
  }, []);

  // Load posts again whenever the company, search or page changes
  useEffect(() => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ page: page });
    if (company) params.append('company', company);
    if (search) params.append('q', search);

    fetch(`${API_URL}/api/posts?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then((data) => {
        setPosts(data.data);
        setTotalPages(data.total_pages);
      })
      .catch(() => setError('Could not load posts. Check that the backend is running.'))
      .finally(() => setLoading(false));
  }, [company, search, page]);

  function selectCompany(name) {
    setCompany(name);
    setPage(1);
  }

  function handleSearch(event) {
    event.preventDefault();
    setSearch(searchText.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearchText('');
    setSearch('');
    setPage(1);
  }

  function goToPage(newPage) {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead-text">
          <h1 className="wordmark">
            Asked<span className="wordmark-dot">.</span>
          </h1>
          <p className="lede">
            Interview questions companies <mark className="lede-mark">actually asked</mark>, pulled from fresh
            LeetCode interview write-ups and sorted by round.
          </p>
        </div>

        <form className="search" onSubmit={handleSearch} role="search">
          <label htmlFor="search">Search post titles</label>
          <div className="search-row">
            <div className="search-field">
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="search"
                type="search"
                placeholder="Amazon SDE 2, OA..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <button type="submit" className="button button-solid">
              Search
            </button>
          </div>
        </form>
      </header>

      <div className="layout">
        <nav className="companies" aria-label="Filter by company">
          <h2>Companies</h2>
          <ul>
            <li>
              <button
                className={company === '' ? 'active' : ''}
                aria-pressed={company === ''}
                onClick={() => selectCompany('')}
              >
                All companies
              </button>
            </li>
            {companies.map((c) => (
              <li key={c.company}>
                <button
                  className={company === c.company ? 'active' : ''}
                  aria-pressed={company === c.company}
                  onClick={() => selectCompany(c.company)}
                >
                  <span className="company-name">{c.company}</span>
                  <span className="count">{c.post_count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="results" aria-live="polite">
          <div className="results-head">
            <h2 className="results-heading">{company || 'All companies'}</h2>
            {search && (
              <button className="chip" onClick={clearSearch} aria-label={`Clear search for ${search}`}>
                “{search}” <span aria-hidden="true">×</span>
              </button>
            )}
          </div>

          {loading && <LoadingCards />}
          {error && <p className="status status-error">{error}</p>}

          {!loading && !error && posts.length === 0 && (
            <p className="status">No posts found. Try another company or search.</p>
          )}

          {!loading && !error && posts.length > 0 && (
            <ol className="cards">
              {posts.map((post) => (
                <li key={post.post_id} className="card">
                  <div className="entry-meta">
                    <strong className="entry-company">{post.company}</strong>
                    {post.role && <span className="pill">{post.role}</span>}
                    <time className="muted entry-date" dateTime={post.created_at}>
                      {new Date(post.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </div>

                  <h3 className="entry-title">
                    {/* The link stretches over the whole card, so anywhere on it opens the post */}
                    <a
                      href="#"
                      className="stretched"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenPost(post.post_id);
                      }}
                    >
                      {post.title}
                    </a>
                  </h3>

                  <ul className="entry-questions">
                    {post.questions.map((q, index) => (
                      <li key={index}>
                        <RoundTag type={q.round_type} />
                        <span>{q.problem_title}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="card-foot">
                    {post.question_count > post.questions.length ? (
                      <span className="muted">+ {post.question_count - post.questions.length} more questions</span>
                    ) : (
                      <span />
                    )}
                    <span className="open-hint" aria-hidden="true">
                      View questions →
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {totalPages > 1 && (
            <div className="pager">
              <button
                className="button"
                aria-label="Newer posts"
                disabled={page === 1 || loading}
                onClick={() => goToPage(page - 1)}
              >
                ← <span className="pager-label">Newer</span>
              </button>
              <span className="muted pager-status">
                Page <strong>{page}</strong> of {totalPages}
              </span>
              <button
                className="button"
                aria-label="Older posts"
                disabled={page === totalPages || loading}
                onClick={() => goToPage(page + 1)}
              >
                <span className="pager-label">Older</span> →
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default PostList;
