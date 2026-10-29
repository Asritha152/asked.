const supabase = require('./supabase');
const { isGarbagePost } = require('./helpers');

const LEETCODE_URL = 'https://leetcode.com/graphql';
const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const LIST_QUERY = `
  query getRecentInterviews($orderBy: ArticleOrderByEnum, $skip: Int, $first: Int) {
    ugcArticleDiscussionArticles(
      orderBy: $orderBy
      keywords: []
      tagSlugs: ["interview-experience"]
      skip: $skip
      first: $first
    ) {
      edges {
        node { topicId uuid title slug summary createdAt tags { name slug tagType } }
      }
    }
  }
`;

const DETAIL_QUERY = `
  query getArticleDetail($topicId: ID!) {
    ugcArticleDiscussionArticle(topicId: $topicId) {
      content
    }
  }
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Send a GraphQL query to LeetCode. Gives up after 15 seconds.
async function leetcodeRequest(query, variables) {
  const res = await fetch(LEETCODE_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`LeetCode returned status ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

async function fetchPostContent(topicId) {
  const data = await leetcodeRequest(DETAIL_QUERY, { topicId: String(topicId) });
  if (!data || !data.ugcArticleDiscussionArticle) {
    return '';
  }
  return data.ugcArticleDiscussionArticle.content || '';
}

async function runFetcher(maxHoursBack = 48) {
  const cutoff = new Date(Date.now() - maxHoursBack * 60 * 60 * 1000);
  console.log(`Fetcher started. Scanning up to ${maxHoursBack} hours back...`);

  const batchSize = 20;
  const maxPages = 10;
  let stagedCount = 0;
  let skippedOld = 0;
  let skippedExisting = 0;

  for (let page = 0; page < maxPages; page++) {
   const data = await leetcodeRequest(LIST_QUERY, {
  orderBy: 'MOST_RECENT',
  skip: page * batchSize,
  first: batchSize,
});
    const edges = data?.ugcArticleDiscussionArticles?.edges || [];

    // Check for an empty page first: [].every(...) is always true, which would
    // wrongly report "older than the cutoff"
    if (edges.length === 0) {
      console.log('No more posts returned by LeetCode.');
      break;
    }

    const allOld = edges.every((edge) => new Date(edge.node.createdAt) < cutoff);
    if (allOld) {
      const newest = edges[0].node.createdAt;
      console.log(
        `Page ${page + 1} only has posts older than the cutoff (${cutoff.toISOString()}); ` +
          `its newest post is from ${newest}. Stopping. Raise FETCH_HOURS_BACK in .env to go further back.`,
      );
      break;
    }

    console.log(`Scanning page ${page + 1}...`);

    // Check which of these posts we already have, with ONE query for the whole page
    const pageIds = edges.map((edge) => String(edge.node.topicId));
    const { data: existingRows, error } = await supabase
      .from('raw_posts')
      .select('topic_id')
      .in('topic_id', pageIds);

    if (error) throw error;
    const existingIds = existingRows.map((row) => row.topic_id);

    for (const edge of edges) {
      const node = edge.node;
      const topicId = String(node.topicId);

      if (new Date(node.createdAt) < cutoff) {
        skippedOld++;
        continue;
      }

      if (existingIds.includes(topicId)) {
        skippedExisting++;
        continue;
      }

      const tags = node.tags || [];
      const companyTag = tags.find((tag) => tag.tagType === 'COMPANY');
      const company = companyTag ? companyTag.name : 'Unknown';
      const otherTags = tags.filter((tag) => tag.tagType !== 'COMPANY').map((tag) => tag.name);
      const postUrl = `https://leetcode.com/discuss/interview-experience/${topicId}/${node.slug}`;

      let content = '';
      try {
        content = await fetchPostContent(topicId);
      } catch (err) {
        console.log(`Could not fetch post ${topicId}: ${err.message}`);
        continue;
      }
      await sleep(300);

      const status = isGarbagePost(node.title, content) ? 'DROPPED' : 'PENDING';
      if (status === 'PENDING') {
        stagedCount++;
      }

      const { error: insertError } = await supabase.from('raw_posts').insert({
        topic_id: topicId,
        uuid: node.uuid,
        title: node.title,
        company: company,
        url: postUrl,
        created_at: node.createdAt,
        tags: otherTags,
        summary: node.summary || '',
        content: content,
        status: status,
      });

      if (insertError) {
        console.log(`Could not save post ${topicId}: ${insertError.message}`);
      } else {
        console.log(`Staged [${status}]: ${node.title.slice(0, 60)}`);
      }
    }
  }

  console.log(
    `Fetcher completed. ${stagedCount} new posts queued as PENDING. ` +
      `${skippedOld} old posts skipped, ${skippedExisting} existing posts skipped.`,
  );
}

if (require.main === module) {
  const hoursBack = Number(process.env.FETCH_HOURS_BACK) || 150;
  runFetcher(hoursBack).catch((err) => {
    console.error('Fetcher failed:', err);
    process.exit(1);
  });
}
