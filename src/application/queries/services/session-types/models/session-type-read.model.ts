export interface SessionTypeReadModel {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  serviceTypeCode: string;
  description?: string;
  durationMinutes: number;
  isActive: boolean;
  isBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
}
