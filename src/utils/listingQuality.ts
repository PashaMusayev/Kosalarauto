import { TransitCar } from '../types';

/**
 * Pure helper to compute listing quality issues for a car.
 * Rules:
 *  - fewer than 8 photos -> "X şəkil (min. 8 tövsiyə olunur)"
 *  - no description (empty or whitespace) -> "Təsvir yoxdur"
 *  - no status badges selected -> "Status nişanı seçilməyib"
 *  - horsepower missing or 0 -> "At gücü qeyd olunmayıb"
 */
export function getListingQualityIssues(car: TransitCar): string[] {
  if (!car) return [];
  const issues: string[] = [];

  // 1. Photos count: fewer than 8 photos
  const photoCount = Array.isArray(car.images) && car.images.length > 0
    ? car.images.length
    : (car.primaryImage ? 1 : 0);
  if (photoCount < 8) {
    issues.push(`${photoCount} şəkil (min. 8 tövsiyə olunur)`);
  }

  // 2. Description: empty or whitespace
  const desc = (car.description || '').trim();
  if (!desc) {
    issues.push('Təsvir yoxdur');
  }

  // 3. Status badges: no status badges selected (Phase 62)
  const badges = (car.statusBadges ?? car.badges) || [];
  if (!Array.isArray(badges) || badges.length === 0) {
    issues.push('Status nişanı seçilməyib');
  }

  // 4. Horsepower: missing or 0
  const hp = Number(car.hp);
  if (!car.hp || isNaN(hp) || hp <= 0) {
    issues.push('At gücü qeyd olunmayıb');
  }

  return issues;
}
