export { cn } from "cn";

/** Initials for an avatar, from words that start with a letter: "Faculty CSE (demo)" → "FC". */
export function initials(name) {
  const parts = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
}
