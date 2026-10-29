// Shows the round type as a coloured highlighter mark, e.g. DSA in yellow
function RoundTag({ type }) {
  const roundType = type || 'OTHER';
  return <span className={`mark mark-${roundType.toLowerCase()}`}>{roundType}</span>;
}

export default RoundTag;
