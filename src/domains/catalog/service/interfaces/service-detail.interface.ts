import { IService } from "./service.interface";

// Service detail interface (same as base interface, but semantically represents complete information)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IServiceDetail extends IService {
  // Currently same as IService, reserved for future extension
}
