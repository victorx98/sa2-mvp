import { IServiceSnapshot } from "../../service/interfaces/service-snapshot.interface";
import { ServiceUnit } from "../../common/interfaces/enums";

// ServicePackage snapshot item
export interface IServicePackageSnapshotItem {
  serviceSnapshot: IServiceSnapshot;
  quantity: number;
  unit: ServiceUnit;
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
