import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch, UseGuards
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
import { GetProductDetailQuery } from "@application/queries/product/get-product-detail.query";
import { CreateProductDto } from "@domains/catalog/product/dto/create-product.dto";
import { UpdateProductDto } from "@domains/catalog/product/dto/update-product.dto";
import { UpdateProductStatusDto } from "@domains/catalog/product/dto/update-product-status.dto";

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
@ApiTags("Catalog Products")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin", "manager")
export class ProductsController {
  constructor(
    private readonly createProductCommand: CreateProductCommand,
    private readonly updateProductCommand: UpdateProductCommand,
    private readonly updateProductStatusCommand: UpdateProductStatusCommand,
    private readonly createProductSnapshotCommand: CreateProductSnapshotCommand,
    private readonly getProductDetailQuery: GetProductDetailQuery,
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

  @Get(":id")
  @ApiOperation({ summary: "Get product detail (with entitlements)" })
  @ApiResponse({ status: 200, description: "Product detail returned successfully" })
  @ApiResponse({ status: 404, description: "Product not found" })
  @Roles("student", "mentor", "counselor", "admin", "manager")
  async getProductDetail(@Param("id") id: string) {
    return this.getProductDetailQuery.execute(id);
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
