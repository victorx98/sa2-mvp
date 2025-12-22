// Recommendation Letter domain exceptions
export class RecommLetterNotFoundException extends Error {
  constructor(letterId: string) {
    super(`Recommendation letter not found: ${letterId}`);
    this.name = 'RecommLetterNotFoundException';
  }
}

export class InvalidRecommLetterStatusException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRecommLetterStatusException';
  }
}

export class InvalidRecommLetterUrlException extends Error {
  constructor(url: string) {
    super(`Invalid recommendation letter URL format: ${url}`);
    this.name = 'InvalidRecommLetterUrlException';
  }
}

export class RecommLetterAlreadyBilledException extends Error {
  constructor(letterId: string) {
    super(`Recommendation letter already billed: ${letterId}`);
    this.name = 'RecommLetterAlreadyBilledException';
  }
}

