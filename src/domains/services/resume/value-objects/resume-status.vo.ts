// Resume status enum and helpers
export enum ResumeStatus {
  UPLOADED = 'uploaded',
  FINAL = 'final',
  DELETED = 'deleted',
}

export function isValidResumeStatus(status: string): status is ResumeStatus {
  return Object.values(ResumeStatus).includes(status as ResumeStatus);
}

export function canMarkAsFinal(status: ResumeStatus): boolean {
  return status === ResumeStatus.UPLOADED;
}

export function canMarkAsDeleted(status: ResumeStatus): boolean {
  return status === ResumeStatus.UPLOADED || status === ResumeStatus.FINAL;
}

