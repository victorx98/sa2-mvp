export interface ClassMemberReadModel {
  userId: string;
  name: {
    en: string;
    zh: string;
  };
  pricePerSession?: number;
  addedAt: Date;
}

export interface ClassReadModel {
  id: string;
  name: string;
  status: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  mentors?: ClassMemberReadModel[];
  counselors?: ClassMemberReadModel[];
  students?: ClassMemberReadModel[];
}
