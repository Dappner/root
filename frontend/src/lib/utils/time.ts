/**
 * Formats seconds into a human-readable time string (H:MM:SS or M:SS)
 * @param seconds - The number of seconds to format
 * @returns Formatted time string (e.g., "1:23:45" or "12:34")
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
