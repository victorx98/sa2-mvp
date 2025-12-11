export class ClassNotFoundException extends Error {
  constructor(classId: string) {
    super(`Class with ID ${classId} not found`);
    this.name = 'ClassNotFoundException';
  }
}

