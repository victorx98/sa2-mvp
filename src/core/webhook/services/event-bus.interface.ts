/**
 * Event Bus Interface
 *
 * Defines contract for publishing domain events
 * Allows decoupling between Webhook Module and consumer modules
 */
export interface IEventBus {
  /**
   * Publish a domain event to all subscribers
   *
   * @param event - Domain event to publish
   * @returns Promise that resolves when event is published to all subscribers
   */
  publish<T = any>(event: T): Promise<void>;

  /**
   * Subscribe to events of a specific type
   *
   * @param eventClass - Event class/type to subscribe to
   * @param handler - Handler function to call when event is published
   * @returns Unsubscribe function
   */
  subscribe<T = any>(
    eventClass: new (...args: any[]) => T,
    handler: (event: T) => Promise<void> | void,
  ): () => void;
}

