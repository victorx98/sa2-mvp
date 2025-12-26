export interface RecommLetterTypeReadModel {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  serviceTypeCode: string;
  parentId?: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  children?: RecommLetterTypeReadModel[];
}

export interface RecommLetterTypeTreeNode {
  code: string;
  nameZh: string;
  nameEn: string;
  children?: RecommLetterTypeTreeNode[];
}
