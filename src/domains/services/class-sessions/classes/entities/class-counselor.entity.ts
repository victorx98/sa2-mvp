export class ClassCounselorEntity {
  id: string;
  classId: string;
  counselorUserId: string;
  createdAt: Date;

  constructor(data: Partial<ClassCounselorEntity>) {
    Object.assign(this, data);
  }
}

