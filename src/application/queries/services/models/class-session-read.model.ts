export interface ClassSessionReadModel {
  id: string;
  classId: string;
  title: string;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
