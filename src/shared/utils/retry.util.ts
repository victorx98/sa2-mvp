import { Logger } from '@nestjs/common';

/**
 * Retry Utility
 * 
 * Provides retry mechanism with exponential backoff for external API calls
 * Used across event handlers for resilient operations
 */

/**
 * Execute function with exponential backoff retry mechanism
 * Automatically retries on failure with increasing delay
 * 
 * @param fn - Async function to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000ms)
 * @param logger - Optional logger instance for debugging
 * @returns Result from function
 * @throws Error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
  logger?: Logger,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delayMs = initialDelayMs * Math.pow(2, i);
      if (logger) {
        logger.debug(
          `Retry attempt ${i + 1}/${maxRetries - 1} after ${delayMs}ms delay`,
        );
      }
      await sleep(delayMs);
    }
  }
}

/**
 * Sleep helper
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

