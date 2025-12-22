// Domain Layer (领域层)
export * from "./entities";
export * from "./value-objects";
export * from "./repositories";
export * from "./exceptions";

// Infrastructure Layer (基础设施层)
export * from "./infrastructure/mappers";
export * from "./infrastructure/repositories";

// Module (模块配置)
export * from "./product.module";

// Keep old exports for backward compatibility during migration (保留旧导出以在迁移期间保持向后兼容)
// TODO: Remove after migration complete (TODO: 迁移完成后移除)
export * from "./interfaces/product.interface";
export * from "./interfaces/product-detail.interface";
export * from "./interfaces/product-snapshot.interface";
