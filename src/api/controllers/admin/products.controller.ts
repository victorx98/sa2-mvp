import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard as AuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CreateProductCommand } from '@application/commands/product/create-product.command';
import { UpdateProductCommand } from '@application/commands/product/update-product.command';
import { PublishProductCommand } from '@application/commands/product/publish-product.command';
import { UnpublishProductCommand } from '@application/commands/product/unpublish-product.command';
import { RevertToDraftProductCommand } from '@application/commands/product/revert-to-draft.command';
import { AddProductItemCommand } from '@application/commands/product/add-product-item.command';
import { RemoveProductItemCommand } from '@application/commands/product/remove-product-item.command';
import { UpdateProductItemSortOrderCommand } from '@application/commands/product/update-item-sort-order.command';
import { CreateProductSnapshotCommand } from '@application/commands/product/create-snapshot.command';
import { GetProductQuery } from '@application/queries/product/get-product.query';
import { GetProductsQuery } from '@application/queries/product/get-products.query';
import { CreateProductDto } from '@domains/catalog/product/dto/create-product.dto';
import { UpdateProductDto } from '@domains/catalog/product/dto/update-product.dto';
import { AddProductItemDto } from '@domains/catalog/product/dto/add-product-item.dto';
import { ProductFilterDto } from '@domains/catalog/product/dto/product-filter.dto';
import { PaginationDto } from '@domains/catalog/common/dto/pagination.dto';
import { SortDto } from '@domains/catalog/common/dto/sort.dto';

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
@Controller('api/admin/products')
@ApiTags('Admin Products')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class AdminProductsController {
  constructor(
    private readonly createProductCommand: CreateProductCommand,
    private readonly updateProductCommand: UpdateProductCommand,
    private readonly publishProductCommand: PublishProductCommand,
    private readonly unpublishProductCommand: UnpublishProductCommand,
    private readonly revertToDraftProductCommand: RevertToDraftProductCommand,
    private readonly addProductItemCommand: AddProductItemCommand,
    private readonly removeProductItemCommand: RemoveProductItemCommand,
    private readonly updateProductItemSortOrderCommand: UpdateProductItemSortOrderCommand,
    private readonly createProductSnapshotCommand: CreateProductSnapshotCommand,
    private readonly getProductQuery: GetProductQuery,
    private readonly getProductsQuery: GetProductsQuery,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @CurrentUser() user: any,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.createProductCommand.execute(createProductDto, String(user.id));
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async findAll(
    @Query() filter: ProductFilterDto,
    @Query() pagination: PaginationDto,
    @Query() sort: SortDto,
  ) {
    return this.getProductsQuery.execute(filter, pagination, sort);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    return this.getProductQuery.execute({ id });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.updateProductCommand.execute(id, updateProductDto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish product' })
  @ApiResponse({ status: 200, description: 'Product published successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async publish(@Param('id') id: string) {
    return this.publishProductCommand.execute(id);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish product' })
  @ApiResponse({ status: 200, description: 'Product unpublished successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async unpublish(@Param('id') id: string) {
    return this.unpublishProductCommand.execute(id);
  }

  @Post(':id/revert-to-draft')
  @ApiOperation({ summary: 'Revert product to draft' })
  @ApiResponse({ status: 200, description: 'Product reverted to draft successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async revertToDraft(@Param('id') id: string) {
    return this.revertToDraftProductCommand.execute(id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to product' })
  @ApiResponse({ status: 201, description: 'Item added to product successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async addItem(@Param('id') id: string, @Body() addProductItemDto: AddProductItemDto) {
    return this.addProductItemCommand.execute(id, addProductItemDto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove item from product' })
  @ApiResponse({ status: 204, description: 'Item removed from product successfully' })
  @ApiResponse({ status: 404, description: 'Product or item not found' })
  async removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.removeProductItemCommand.execute(id, itemId);
  }

  @Patch(':id/items/sort')
  @ApiOperation({ summary: 'Update product item sort order' })
  @ApiResponse({ status: 200, description: 'Product item sort order updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateItemSortOrder(
    @Param('id') id: string,
    @Body() items: Array<{ itemId: string; sortOrder: number }>
  ) {
    return this.updateProductItemSortOrderCommand.execute(id, items);
  }

  @Get(':id/snapshot')
  @ApiOperation({ summary: 'Create product snapshot' })
  @ApiResponse({ status: 200, description: 'Product snapshot created successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async createSnapshot(@Param('id') id: string) {
    return this.createProductSnapshotCommand.execute(id);
  }
}
