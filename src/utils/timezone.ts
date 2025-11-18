import { DateTime } from 'luxon';

/**
 * Get the user's timezone from their profile, falling back to UTC
 */
export function getUserTimezone(profileTimezone?: string | null): string {
  return profileTimezone || 'UTC';
}

/**
 * Convert a local datetime string to UTC ISO string
 * @param localInput - Local datetime string (e.g., from datetime-local input: "2025-01-15T19:00")
 * @param timezone - User's timezone (e.g., "Asia/Kolkata")
 * @returns UTC ISO string for database storage
 */
export function localToUtcISO(localInput: string, timezone: string): string {
  const dt = DateTime.fromISO(localInput, { zone: timezone });
  return dt.toUTC().toISO()!;
}

/**
 * Convert a UTC ISO string to local datetime string for form inputs
 * @param utcISO - UTC ISO string from database
 * @param timezone - User's timezone
 * @returns Local datetime string (e.g., "2025-01-15T19:00" for datetime-local inputs)
 */
export function utcToLocalISO(utcISO: string, timezone: string): string {
  const dt = DateTime.fromISO(utcISO, { zone: 'UTC' });
  return dt.setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm");
}

/**
 * Format a UTC ISO string for display in user's timezone
 * @param utcISO - UTC ISO string from database
 * @param timezone - User's timezone
 * @param format - Display format type
 * @returns Formatted string for display
 */
export function formatUtcForDisplay(
  utcISO: string,
  timezone: string,
  format: 'date' | 'time' | 'datetime'
): string {
  const dt = DateTime.fromISO(utcISO, { zone: 'UTC' }).setZone(timezone);
  
  switch (format) {
    case 'date':
      return dt.toLocaleString(DateTime.DATE_MED);
    case 'time':
      return dt.toLocaleString(DateTime.TIME_SIMPLE);
    case 'datetime':
      return dt.toLocaleString(DateTime.DATETIME_MED);
    default:
      return dt.toISO()!;
  }
}

/**
 * Get the start of today in the user's timezone as a DateTime object
 */
export function startOfTodayInZone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone).startOf('day');
}

/**
 * Get the start of tomorrow in the user's timezone as a DateTime object
 */
export function startOfTomorrowInZone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone).plus({ days: 1 }).startOf('day');
}
