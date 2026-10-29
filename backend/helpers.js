// Small helper functions used by the fetcher and parser.
// They don't touch the database, so they are easy to test.

// Skip posts that are clearly not interview experiences (advice, salary, etc.)
function isGarbagePost(title, content) {
  if (content.trim().length < 120) {
    return true;
  }

  const text = `${title} ${content}`;
  const lowerTitle = title.toLowerCase();

  const adviceWords = ['referral', 'resume review', 'profile review', 'advice', 'which offer', 'salary negotiation'];
  const isAdvice = adviceWords.some((word) => lowerTitle.includes(word));
  if (isAdvice && !/\bround/i.test(text)) {
    return true;
  }

  // \b means "whole word", so "oa" won't match inside "load" or "board"
  const interviewWords = /\b(round|rounds|oa|assessment|leetcode|dsa|lld|hld|system design|asked|interviewer)\b/i;
  return !interviewWords.test(text);
}

// The LLM sometimes returns "System Design" or "dsa" instead of our exact labels
function cleanRoundType(roundType) {
  const value = (roundType || '').toUpperCase().trim();

  if (value === 'SYSTEM DESIGN') return 'HLD';
  if (value === 'MACHINE CODING') return 'LLD';
  if (['DSA', 'OA', 'LLD', 'HLD', 'BEHAVIORAL'].includes(value)) return value;
  return 'OTHER';
}

// Prefer the company the LLM found, then the LeetCode tag, else "Unknown"
function pickCompany(llmCompany, tagCompany) {
  const badNames = ['', 'unknown', 'technical interview'];

  if (llmCompany && !badNames.includes(llmCompany.trim().toLowerCase())) {
    return llmCompany.trim();
  }
  if (tagCompany && !badNames.includes(tagCompany.trim().toLowerCase())) {
    return tagCompany.trim();
  }
  return 'Unknown';
}

// "https://leetcode.com/problems/two-sum/" -> "two-sum"
function getLeetCodeSlug(url) {
  const match = (url || '').match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
  return match ? match[1].toLowerCase() : null;
}

module.exports = { isGarbagePost, cleanRoundType, pickCompany, getLeetCodeSlug };
