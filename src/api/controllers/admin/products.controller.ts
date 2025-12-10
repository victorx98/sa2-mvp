import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
import { CreateProductCommand } from "@application/commands/product/create-product.command";
import { UpdateProductCommand } from "@application/commands/product/update-product.command";
import { UpdateProductStatusCommand } from "@application/commands/product/update-product-status.command";
import { CreateProductSnapshotCommand } from "@application/commands/product/create-snapshot.command";
import { GetProductQuery } from "@application/queries/product/get-product.query";
import { GetProductsQuery } from "@application/queries/product/get-products.query";
import { CreateProductDto } from "@domains/catalog/product/dto/create-product.dto";
import { UpdateProductDto } from "@domains/catalog/product/dto/update-product.dto";
import { UpdateProductStatusDto } from "@domains/catalog/product/dto/update-product-status.dto";
import { ProductFilterDto } from "@domains/catalog/product/dto/product-filter.dto";
import { PaginationDto } from "@domains/catalog/common/dto/pagination.dto";
import { SortDto } from "@domains/catalog/common/dto/sort.dto";

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
@Controller("api/admin/products")
@ApiTags("Admin Products")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin", "manager")
export class AdminProductsController {
  constructor(
    private readonly createProductCommand: CreateProductCommand,
    private readonly updateProductCommand: UpdateProductCommand,
    private readonly updateProductStatusCommand: UpdateProductStatusCommand,
    private readonly createProductSnapshotCommand: CreateProductSnapshotCommand,
    private readonly getProductQuery: GetProductQuery,
    private readonly getProductsQuery: GetProductsQuery,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new product" })
  @ApiResponse({ status: 201, description: "Product created successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async create(
    @CurrentUser() user: IJwtUser,
    @Body() createProductDto: CreateProductDto,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    // User object from JwtAuthGuard has 'id' property [来自JwtAuthGuard的用户对象具有'id'属性]
    return this.createProductCommand.execute(
      createProductDto,
      String((user as unknown as { id: string }).id),
    );
  }

  @Get()
  @ApiOperation({ summary: "Get all products" })
  @ApiResponse({ status: 200, description: "Products retrieved successfully" })
  async findAll(@Query() query: any) {
    // Extract filter, pagination, and sort parameters
    const filter = query as ProductFilterDto;

    // Validate and provide defaults for pagination [验证分页参数并提供默认值]
    const page =
      query.page !== undefined &&
      query.page !== null &&
      !isNaN(Number(query.page))
        ? Number(query.page)
        : 1;
    const pageSize =
      query.pageSize !== undefined &&
      query.pageSize !== null &&
      !isNaN(Number(query.pageSize))
        ? Number(query.pageSize)
        : 20;

    if (page < 1 || pageSize < 1) {
      throw new HttpException(
        "Invalid pagination parameters. Page and pageSize must be positive integers.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const pagination = {
      page,
      pageSize,
    } as PaginationDto;
    const sort = {
      orderField: query.orderField || query.field, // Support both old and new parameter name for backward compatibility
      orderDirection: query.orderDirection || query.order, // Support both old and new parameter name for backward compatibility
    } as SortDto;
    return this.getProductsQuery.execute(filter, pagination, sort);
  }

  // Product-specific routes (more specific paths before generic :id) [产品特定路由（更具体的路径在通用:id之前）]
  @Get(":id/snapshot")
  @ApiOperation({ summary: "Create product snapshot" })
  @ApiResponse({
    status: 200,
    description: "Product snapshot created successfully",
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  async createSnapshot(@Param("id") id: string) {
    return this.createProductSnapshotCommand.execute(id);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update product status" })
  @ApiResponse({
    status: 200,
    description: "Product status updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request or invalid status transition",
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  async updateStatus(
    @Param("id") id: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
  ) {
    return this.updateProductStatusCommand.execute(
      id,
      updateProductStatusDto.status,
    );
  }

  // Generic product routes (must come after specific routes) [通用产品路由（必须在特定路由之后）]
  @Get(":id")
  @ApiOperation({ summary: "Get product by ID" })
  @ApiResponse({ status: 200, description: "Product retrieved successfully" })
  @ApiResponse({ status: 404, description: "Product not found" })
  async findOne(@Param("id") id: string) {
    return this.getProductQuery.execute({ id });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update product" })
  @ApiResponse({ status: 200, description: "Product updated successfully" })
  @ApiResponse({ status: 404, description: "Product not found" })
  async update(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    // User object from JwtAuthGuard has 'id' property [来自JwtAuthGuard的用户对象具有'id'属性]
    return this.updateProductCommand.execute(
      id,
      updateProductDto,
      String((user as unknown as { id: string }).id),
    );
  }
}
