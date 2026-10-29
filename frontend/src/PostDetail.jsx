import { useEffect, useState } from 'react';
import RoundTag from './RoundTag.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

function PostDetail({ postId, onBack }) {
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/posts/${postId}`)
      .then((res) => {
        if (res.status === 404) throw new Error('This post was not found.');
        if (!res.ok) throw new Error('Could not load this post.');
        return res.json();
      })
      .then((data) => setPost(data))
      .catch((err) => setError(err.message));
  }, [postId]);

  return (
    <article className="detail">
      <div className="back-bar">
        <button className="back" onClick={onBack}>
          <span aria-hidden="true">←</span> All posts
        </button>
      </div>

      {error && <p className="status status-error">{error}</p>}
      {!post && !error && (
        <div className="card card-skeleton" aria-label="Loading questions">
          <span className="skel skel-lg" />
          <span className="skel" />
          <span className="skel skel-md" />
        </div>
      )}

      {post && (
        <>
          <header className="detail-head">
            <h1 className="title">{post.company}</h1>
            {post.role && <p className="detail-role">{post.role}</p>}
            <p className="detail-source">{post.title}</p>
            <div className="detail-actions">
              <span className="pill">
                {post.questions.length} question{post.questions.length === 1 ? '' : 's'}
              </span>
              <a className="button button-small" href={post.source_url} target="_blank" rel="noreferrer">
                Original post on LeetCode ↗
              </a>
            </div>
          </header>

          <ol className="questions">
            {post.questions.map((q, qIndex) => (
              <li key={q.id} className="card question">
                <div className="question-top">
                  <span className="question-num">Q{qIndex + 1}</span>
                  <RoundTag type={q.round_type} />
                </div>
                <h2 className="question-title">{q.problem_title}</h2>
                <p className="statement">{q.problem_statement}</p>

                {(q.input_format || q.output_format) && (
                  <dl className="formats">
                    {q.input_format && (
                      <>
                        <dt>Input</dt>
                        <dd>
                          <code>{q.input_format}</code>
                        </dd>
                      </>
                    )}
                    {q.output_format && (
                      <>
                        <dt>Output</dt>
                        <dd>
                          <code>{q.output_format}</code>
                        </dd>
                      </>
                    )}
                  </dl>
                )}

                {q.sample_io.map((sample, index) => (
                  <div key={index} className="sample">
                    <div>
                      <span className="sample-label">Example {q.sample_io.length > 1 ? index + 1 : ''} input</span>
                      <pre>{sample.input}</pre>
                    </div>
                    <div>
                      <span className="sample-label">Output</span>
                      <pre>{sample.output}</pre>
                    </div>
                    {sample.explanation && <p className="muted sample-note">{sample.explanation}</p>}
                  </div>
                ))}

                {q.practice_links.length > 0 && (
                  <div className="practice-box">
                    <span className="sample-label">Practice on LeetCode</span>
                    <ul className="practice">
                      {q.practice_links.map((link) => (
                        <li key={link.url}>
                          <a href={link.url} target="_blank" rel="noreferrer">
                            {link.title}
                          </a>
                          <span className="pill pill-small">{link.similarity.toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  );
}

export default PostDetail;
