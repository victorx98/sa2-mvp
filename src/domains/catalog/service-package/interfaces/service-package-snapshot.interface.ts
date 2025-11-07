import { IServiceSnapshot } from "../../service/interfaces/service-snapshot.interface";

// ServicePackage snapshot item
export interface IServicePackageSnapshotItem {
  serviceSnapshot: IServiceSnapshot;
  quantity: number; // All services are billed by times (次数)
  sortOrder: number;
}

// ServicePackage snapshot interface (with expanded services, used for contract snapshots)
export interface IServicePackageSnapshot {
  packageId: string;
  packageName: string;
  packageCode: string;
  items: IServicePackageSnapshotItem[];
  snapshotAt: Date;
}
