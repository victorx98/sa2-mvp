// Recommendation Letter status enum and helpers
export enum RecommLetterStatus {
  UPLOADED = 'uploaded',
  DELETED = 'deleted',
}

export function isValidRecommLetterStatus(status: string): status is RecommLetterStatus {
  return Object.values(RecommLetterStatus).includes(status as RecommLetterStatus);
}

export function canMarkAsDeleted(status: RecommLetterStatus): boolean {
  return status === RecommLetterStatus.UPLOADED;
}

