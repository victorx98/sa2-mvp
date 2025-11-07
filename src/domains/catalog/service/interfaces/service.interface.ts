import {
  ServiceType,
  BillingMode,
  ServiceStatus,
} from "../../common/interfaces/enums";

// Service 基础接口
export interface IService {
  id: string;
  code: string;
  serviceType: ServiceType;
  name: string;
  description?: string;
  coverImage?: string;
  billingMode: BillingMode;
  requiresEvaluation: boolean;
  requiresMentorAssignment: boolean;
  status: ServiceStatus;
  metadata?: {
    features?: string[];
    deliverables?: string[];
    duration?: number;
    prerequisites?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
