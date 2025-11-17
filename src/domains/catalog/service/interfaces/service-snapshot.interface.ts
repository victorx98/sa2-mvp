import { BillingMode } from "../../common/interfaces/enums";

// Service snapshot interface (used for contracts)
export interface IServiceSnapshot {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  serviceType: string; // Service type (references service_types.code)
  billingMode: BillingMode;
  requiresEvaluation: boolean;
  requiresMentorAssignment: boolean;
  metadata?: {
    features?: string[];
    deliverables?: string[];
    duration?: number;
  };
  snapshotAt: Date;
}
