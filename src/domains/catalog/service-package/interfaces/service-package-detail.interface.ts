import { IServicePackage } from "./service-package.interface";
import { IService } from "../../service/interfaces/service.interface";

// ServicePackage detail interface (includes service items)
export interface IServicePackageItem {
  id: string;
  serviceId: string;
  quantity: number;
  sortOrder: number;
  service?: IService; // Associated service information
}

export interface IServicePackageDetail extends IServicePackage {
  items?: IServicePackageItem[]; // Service items in the package
}
