/**
 * Comm Session Not Found Exception
 */
export class CommSessionNotFoundException extends Error {
  constructor(sessionId: string) {
    super(`Comm session not found with ID: ${sessionId}`);
    this.name = 'CommSessionNotFoundException';
  }
}

