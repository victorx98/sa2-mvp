import {
  ServiceType,
  BillingMode,
  ServiceUnit,
} from "../../common/interfaces/enums";

// Service snapshot interface (used for contracts)
export interface IServiceSnapshot {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  serviceType: ServiceType;
  billingMode: BillingMode;
  defaultUnit: ServiceUnit;
  requiresEvaluation: boolean;
  requiresMentorAssignment: boolean;
  metadata?: {
    features?: string[];
    deliverables?: string[];
    duration?: number;
  };
  snapshotAt: Date;
}
