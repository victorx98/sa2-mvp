// Resume domain exceptions
export class ResumeNotFoundException extends Error {
  constructor(resumeId: string) {
    super(`Resume not found: ${resumeId}`);
    this.name = 'ResumeNotFoundException';
  }
}

export class InvalidResumeStatusException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResumeStatusException';
  }
}

export class InvalidResumeUrlException extends Error {
  constructor(url: string) {
    super(`Invalid resume URL format: ${url}`);
    this.name = 'InvalidResumeUrlException';
  }
}

export class ResumeAlreadyBilledException extends Error {
  constructor(resumeId: string) {
    super(`Resume already billed: ${resumeId}`);
    this.name = 'ResumeAlreadyBilledException';
  }
}

