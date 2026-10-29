import { useState } from 'react';
import PostList from './PostList.jsx';
import PostDetail from './PostDetail.jsx';

function App() {
  // null = show the list, a post id = show that post
  const [selectedPostId, setSelectedPostId] = useState(null);

  function openPost(postId) {
    setSelectedPostId(postId);
    window.scrollTo(0, 0);
  }

  return (
    <div className="page">
      {/* The list stays mounted (just hidden) so your filters and page are kept when you go back */}
      <div style={{ display: selectedPostId ? 'none' : 'block' }}>
        <PostList onOpenPost={openPost} />
      </div>

      {selectedPostId && <PostDetail postId={selectedPostId} onBack={() => setSelectedPostId(null)} />}

      <footer className="footer">
        Questions are extracted automatically from public LeetCode interview-experience posts. Check the original
        post before you rely on a detail.
      </footer>
    </div>
  );
}

export default App;
