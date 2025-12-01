export class ClassMentorPriceEntity {
  id: string;
  classId: string;
  mentorUserId: string;
  pricePerSession: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ClassMentorPriceEntity>) {
    Object.assign(this, data);
  }
}

