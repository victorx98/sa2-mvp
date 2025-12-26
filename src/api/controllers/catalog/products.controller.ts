import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Query,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
import { CreateProductCommand } from "@application/commands/product/create-product.command";
import { UpdateProductCommand } from "@application/commands/product/update-product.command";
import { UpdateProductStatusCommand } from "@application/commands/product/update-product-status.command";
import { CreateProductSnapshotCommand } from "@application/commands/product/create-snapshot.command";
import { GetProductDetailUseCase } from "@application/queries/product/use-cases/get-product-detail.use-case";
import { SearchProductsUseCase } from "@application/queries/product/use-cases/search-products.use-case";
import { CreateProductRequestDto, UpdateProductRequestDto, UpdateProductStatusRequestDto } from "@api/dto/request/catalog/product.request.dto";
import { ProductDetailResponseDto, ProductItemResponseDto, ProductResponseDto, ProductSnapshotResponseDto } from "@api/dto/response/catalog/product.response.dto";
import { ProductListQueryDto } from "@api/dto/request/catalog/product-list.request.dto";
import { ProductListResponseDto, ProductListItemResponseDto } from "@api/dto/response/catalog/product-list.response.dto";

/**
 * Admin Products Controller
 * [管理员产品控制器]
 *
 * 职责：
 * 1. 处理产品相关的HTTP请求
 * 2. 执行认证和授权
 * 3. 调用Application Layer的Command和Query
 * 4. 返回HTTP响应
 */
@Controller("api/products")
@ApiTags("Catalog")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin", "manager")
@ApiBearerAuth()
export class ProductsController {
  constructor(
    private readonly createProductCommand: CreateProductCommand,
    private readonly updateProductCommand: UpdateProductCommand,
    private readonly updateProductStatusCommand: UpdateProductStatusCommand,
    private readonly createProductSnapshotCommand: CreateProductSnapshotCommand,
    private readonly getProductDetailUseCase: GetProductDetailUseCase,
    private readonly searchProductsUseCase: SearchProductsUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a new product",
    description:
      "Creates a catalog product with optional entitlement items. [创建目录产品，可选带权益项]",
  })
  @ApiBody({ type: CreateProductRequestDto })
  @ApiCreatedResponse({
    description: "Product created successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async create(
    @CurrentUser() user: IJwtUser,
    @Body() body: CreateProductRequestDto,
  ): Promise<ProductResponseDto> {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    // User object from JwtAuthGuard has 'id' property [来自JwtAuthGuard的用户对象具有'id'属性]
    const product = await this.createProductCommand.execute(
      body,
      String((user as unknown as { id: string }).id),
    );
    return this.mapProductToDto(product);
  }

  private mapProductToDto(product: import("@domains/catalog/product/interfaces/product.interface").IProduct): ProductResponseDto {
    return {
      ...product,
      publishedAt: product.publishedAt?.toISOString(),
      unpublishedAt: product.unpublishedAt?.toISOString(),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      items: product.items?.map(item => ({
        ...item,
        serviceTypeCode: (item as unknown as { serviceTypeCode?: string }).serviceTypeCode || '',
        serviceTypeName: (item as unknown as { serviceTypeName?: string }).serviceTypeName || '',
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })) as ProductItemResponseDto[],
    };
  }



  // Product-specific routes (more specific paths before generic :id) [产品特定路由（更具体的路径在通用:id之前）]
  @Get(":id/snapshot")
  @ApiOperation({
    summary: "Create product snapshot",
    description:
      "Creates a frozen snapshot of the current product for contract creation. [创建当前产品的冻结快照，用于创建合同]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Product ID (UUID). [产品ID(UUID)]",
    type: String,
  })
  @ApiOkResponse({
    description: "Product snapshot created successfully",
    type: ProductSnapshotResponseDto,
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  async createSnapshot(@Param("id") id: string): Promise<ProductSnapshotResponseDto> {
    const snapshot = await this.createProductSnapshotCommand.execute(id);
    return {
      productId: snapshot.productId,
      productName: snapshot.name,
      productCode: snapshot.code,
      price: snapshot.price,
      currency: snapshot.currency,
      items: snapshot.items,
      snapshotAt: snapshot.snapshotAt.toISOString(),
    };
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get product detail (with entitlements)",
    description:
      "Returns product detail with enriched entitlement items (service type code/name). [返回产品详情，包含补全后的权益项(服务类型编码/名称)]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Product ID (UUID). [产品ID(UUID)]",
    type: String,
  })
  @ApiOkResponse({
    description: "Product detail returned successfully",
    type: ProductDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  @Roles("student", "mentor", "counselor", "admin", "manager")
  async getProductDetail(@Param("id") id: string): Promise<ProductDetailResponseDto> {
    const detail = await this.getProductDetailUseCase.execute({ id });
    if (!detail) {
      throw new NotFoundException("Product not found");
    }

    return {
      id: detail.id,
      name: detail.name,
      code: detail.code ?? "",
      status: detail.status as any,
      price: String(detail.price),
      currency: detail.currency as any,
      targetUserPersonas: detail.userPersona ? [detail.userPersona as any] : [],
      marketingLabels: detail.marketingLabel ? [detail.marketingLabel as any] : [],
      publishedAt: detail.availableFrom?.toISOString(),
      unpublishedAt: detail.availableTo?.toISOString(),
      createdAt: detail.createdAt.toISOString(),
      updatedAt: detail.updatedAt.toISOString(),
      createdBy: detail.createdBy,
      items: detail.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        serviceTypeId: item.serviceTypeId,
        serviceTypeCode: item.serviceTypeCode ?? "",
        serviceTypeName: item.serviceTypeName ?? "",
        quantity: item.quantity,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  @Get()
  @ApiOperation({
    summary: "Get products list with pagination",
    description:
      "Retrieve paginated products list with filtering and sorting. [获取分页产品列表，支持筛选和排序]",
  })
  @ApiOkResponse({
    description: "Products retrieved successfully",
    type: ProductListResponseDto,
  })
  async getProducts(
    @Query() queryDto: ProductListQueryDto,
  ): Promise<ProductListResponseDto> {
    const result = await this.searchProductsUseCase.execute({
      filter: {
        includeDeleted: false,
        status: queryDto.status,
        name: queryDto.keyword,
      },
      pagination: {
        page: queryDto.page || 1,
        pageSize: queryDto.pageSize || 20,
      },
      sort: {
        field: queryDto.field || "createdAt",
        order: queryDto.order || "desc",
      },
    });

    return {
      data: result.data.map((product) => ({
        id: product.id,
        name: product.name,
        status: product.status,
        price: Number(product.price),
        currency: product.currency,
        code: product.code,
        itemCount: product.items?.length || 0,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Patch(":id/status")
  @ApiOperation({
    summary: "Update product status",
    description:
      "Updates product lifecycle status (e.g., DRAFT/ACTIVE/INACTIVE). [更新产品生命周期状态，如DRAFT/ACTIVE/INACTIVE]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Product ID (UUID). [产品ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateProductStatusRequestDto })
  @ApiOkResponse({
    description: "Product status updated successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request or invalid status transition",
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateProductStatusRequestDto,
  ): Promise<ProductResponseDto> {
    const product = await this.updateProductStatusCommand.execute(
      id,
      body.status,
    );
    return this.mapProductToDto(product);
  }

  // Generic product routes (must come after specific routes) [通用产品路由（必须在特定路由之后）]
  @Patch(":id")
  @ApiOperation({
    summary: "Update product",
    description:
      "Updates product fields and product items (add/remove/sort). [更新产品字段及产品项(新增/删除/排序)]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Product ID (UUID). [产品ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateProductRequestDto })
  @ApiOkResponse({
    description: "Product updated successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  async update(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: UpdateProductRequestDto,
  ): Promise<ProductResponseDto> {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    // User object from JwtAuthGuard has 'id' property [来自JwtAuthGuard的用户对象具有'id'属性]
    const product = await this.updateProductCommand.execute(
      id,
      body,
      String((user as unknown as { id: string }).id),
    );
    return this.mapProductToDto(product);
  }
}
