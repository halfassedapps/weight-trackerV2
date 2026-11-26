// Consolidates the localStorage try/catch idiom that was independently
// copy-pasted across useRangePicker, PkChart, DoseChart, and
// DoseRecommendationCard (the last of these even commented "see
// useRangePicker's identical try/catch" — a sure sign it belonged here
// instead). localStorage can throw in private-browsing contexts; every
// caller in this app treats a failed write the same way: silently drop it,
// since the preference just resets next visit rather than breaking anything.
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private-browsing / quota — a persistence miss just resets next visit */
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* see safeSetItem */
  }
}

export function safeGetJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function safeSetJSON(key: string, value: unknown): void {
  safeSetItem(key, JSON.stringify(value));
}
