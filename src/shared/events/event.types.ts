// Event generic type definition
// Represents a structured event with source information and typed payload

/**
 * Generic event type with typed payload
 * @template T The type of the event payload
 */
export interface IEvent<T> {
  /**
   * Event type identifier (Published Language / routing key)
   */
  type: string;

  /**
   * Unique event identifier (UUID)
   */
  id?: string;

  /**
   * Timestamp when the event was published (Unix timestamp in milliseconds)
   */
  timestamp?: number;

  /**
   * Source information about the event
   */
  source?: {
    /**
     * Domain where the event originated from
     */
    domain?: string;

    /**
     * Service where the event originated from
     */
    service?: string;
  };

  /**
   * Event payload with specific type
   */
  payload: T;
}
