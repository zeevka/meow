export function normalizeProductName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreArchivedMatch(query: string, candidate: string) {
  const normalizedQuery = normalizeProductName(query);
  const normalizedCandidate = normalizeProductName(candidate);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return 100;
  }

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 85;
  }

  const queryWords = normalizedQuery.split(" ");
  const candidateWords = normalizedCandidate.split(" ");
  const sharedWords = queryWords.filter((word) => candidateWords.includes(word));

  if (sharedWords.length > 0) {
    return 60 + sharedWords.length * 5;
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    return 45;
  }

  return 0;
}

