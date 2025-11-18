import { ServiceStatus } from "@shared/types/catalog-enums";

// ServicePackage 基础接口
export interface IServicePackage {
  id: string;
  code: string;
  name: string;
  description?: string;
  coverImage?: string;
  status: ServiceStatus;
  metadata?: {
    features?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
