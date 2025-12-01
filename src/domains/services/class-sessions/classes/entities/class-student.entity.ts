export class ClassStudentEntity {
  id: string;
  classId: string;
  studentUserId: string;
  enrolledAt: Date;
  createdAt: Date;

  constructor(data: Partial<ClassStudentEntity>) {
    Object.assign(this, data);
  }
}

