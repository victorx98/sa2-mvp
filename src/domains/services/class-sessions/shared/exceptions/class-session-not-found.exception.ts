export class ClassSessionNotFoundException extends Error {
  constructor(sessionId: string) {
    super(`Class session with ID ${sessionId} not found`);
    this.name = 'ClassSessionNotFoundException';
  }
}

