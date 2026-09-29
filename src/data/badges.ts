/**
 * Canonical Listing Status Badges & Legacy Mapping
 *
 * Defines the canonical allowed status badges shown under the price on listings,
 * their canonical display order, sanitizer, and legacy data migration mapper.
 */

export const CANONICAL_STATUS_BADGES = [
  'Gömrük olunub',
  'Azərbaycanda sürülməyib',
  'Vuruqsuz və rəngsiz',
] as const;

export type CanonicalBadge = typeof CANONICAL_STATUS_BADGES[number];

/**
 * Type guard for canonical badge strings
 */
export function isCanonicalBadge(val: unknown): val is CanonicalBadge {
  return typeof val === 'string' && (CANONICAL_STATUS_BADGES as readonly string[]).includes(val);
}

/**
 * Sanitizes incoming badges against the canonical list.
 * Drops unknown values, removes duplicates, and preserves canonical display order.
 * If empty or invalid, returns an empty array.
 */
export function sanitizeStatusBadges(input: unknown): CanonicalBadge[] {
  if (!input) return [];

  const rawArray = Array.isArray(input)
    ? input
    : (typeof input === 'string' && input.trim() ? [input.trim()] : []);

  const set = new Set<string>();
  for (const item of rawArray) {
    if (typeof item === 'string') {
      const clean = item.trim();
      if (clean) set.add(clean);
    }
  }

  return CANONICAL_STATUS_BADGES.filter(badge => set.has(badge));
}

/**
 * Legacy data mapping function for read-side data consumption.
 *
 * Rules:
 * 1. Empty or missing input -> returns [] (no fake defaults).
 * 2. If a car's stored badges exactly match the old auto-saved default
 *    ['Vuruqsuz', 'Gömrük olunub', 'Zəmanətli'] in any order:
 *    treat it as all three canonical badges (['Gömrük olunub', 'Azərbaycanda sürülməyib', 'Vuruqsuz və rəngsiz']).
 * 3. Otherwise, map known legacy values to canonical ones:
 *    - 'Vuruqsuz', 'Vuruqsuz Rəngsiz', 'Əla vuruqsuz' -> 'Vuruqsuz və rəngsiz'
 *    - 'Gömrük olunub' -> 'Gömrük olunub'
 *    - 'Azərbaycanda sürülməyib' -> 'Azərbaycanda sürülməyib'
 *    - 'Vuruqsuz və rəngsiz' -> 'Vuruqsuz və rəngsiz'
 *    and drop the rest ('Zəmanətli', 'Kondisionerli', 'Texniki baxışdan keçib', etc.).
 *    Returns in canonical display order without duplicates.
 */
export function mapLegacyBadges(raw: unknown): CanonicalBadge[] {
  if (!raw) return [];

  const rawList: string[] = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean)
    : (typeof raw === 'string' && raw.trim() ? [raw.trim()] : []);

  if (rawList.length === 0) {
    return [];
  }

  // Check if exactly matches old auto-saved default ['Vuruqsuz', 'Gömrük olunub', 'Zəmanətli'] (any order)
  if (rawList.length === 3) {
    const normSet = new Set(rawList.map(s => s.toLowerCase()));
    if (
      normSet.size === 3 &&
      normSet.has('vuruqsuz') &&
      normSet.has('gömrük olunub') &&
      normSet.has('zəmanətli')
    ) {
      return [...CANONICAL_STATUS_BADGES];
    }
  }

  // Map known legacy values to canonical badges
  const mappedSet = new Set<CanonicalBadge>();

  for (const item of rawList) {
    const lower = item.toLowerCase();

    if (item === 'Gömrük olunub' || lower === 'gömrük olunub' || lower === 'gomruk olunub') {
      mappedSet.add('Gömrük olunub');
    } else if (
      item === 'Azərbaycanda sürülməyib' ||
      lower === 'azərbaycanda sürülməyib' ||
      lower === 'azerbaycanda surulmeyib'
    ) {
      mappedSet.add('Azərbaycanda sürülməyib');
    } else if (
      item === 'Vuruqsuz və rəngsiz' ||
      lower === 'vuruqsuz və rəngsiz' ||
      lower === 'vuruqsuz ve rengsiz' ||
      item === 'Vuruqsuz' ||
      lower === 'vuruqsuz' ||
      item === 'Vuruqsuz Rəngsiz' ||
      lower === 'vuruqsuz rəngsiz' ||
      lower === 'vuruqsuz rengsiz' ||
      item === 'Əla vuruqsuz' ||
      lower === 'əla vuruqsuz' ||
      lower === 'ela vuruqsuz'
    ) {
      mappedSet.add('Vuruqsuz və rəngsiz');
    }
    // All other unknown strings or old tags ('Zəmanətli', 'Kondisionerli', 'Texniki baxışdan keçib') are dropped
  }

  return CANONICAL_STATUS_BADGES.filter(badge => mappedSet.has(badge));
}
