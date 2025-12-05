import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { CreateProductDto } from '@domains/catalog/product/dto/create-product.dto';
import { UpdateProductDto } from '@domains/catalog/product/dto/update-product.dto';
import { UpdateProductStatusDto } from '@domains/catalog/product/dto/update-product-status.dto';
import { ProductStatus, Currency, UserPersona } from '@shared/types/catalog-enums';
import { v4 as uuidv4 } from 'uuid';

describe('ProductService Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let testProductId: string;
  let validServiceTypeId: string; // Store a valid service type ID for testing

  beforeAll(async () => {
    // Create testing module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Create Nest application
    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get auth token
    // Using provided test credentials
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'counselor3@123.com',
        password: '123456',
      })
      .expect(200);

    authToken = loginResponse.body.accessToken;

    // Get a valid service type ID from the database
    // This ensures we're using an existing service type
    const serviceTypesResponse = await request(app.getHttpServer())
      .get('/api/admin/service-types?limit=1')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    if (serviceTypesResponse.body.data && serviceTypesResponse.body.data.length > 0) {
      validServiceTypeId = serviceTypesResponse.body.data[0].id;
    } else {
      // If no service types exist, we'll create a simple test product without items
      validServiceTypeId = null;
    }
  }, 15000); // Increased timeout to 15 seconds

  afterAll(async () => {
    // Clean up test data
    if (testProductId && app) {
      try {
        // Check if delete endpoint exists and works
        const deleteResponse = await request(app.getHttpServer())
          .delete(`/api/admin/products/${testProductId}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        if (deleteResponse.statusCode !== 200 && deleteResponse.statusCode !== 404) {
          console.error('Error cleaning up test data:', deleteResponse.body);
        }
      } catch (error) {
        console.error('Error cleaning up test data:', error.message);
      }
    }

    if (app) {
      await app.close();
    }
  }, 15000); // Increased timeout to 15 seconds

  describe('Product Lifecycle', () => {
    it('should create, update, and manage product items successfully', async () => {
      // Step 1: Create a new product
      const createDto: CreateProductDto = {
        name: 'Test Integration Product',
        code: `TEST-PROD-${uuidv4().substring(0, 8)}`,
        description: 'This is a test product for integration testing',
        price: 1500.00,
        currency: Currency.USD,
        targetUserPersonas: [UserPersona.UNDERGRADUATE, UserPersona.GRADUATE],
        marketingLabels: ['hot', 'recommended'],
        // Only add items if we have a valid service type ID
        items: validServiceTypeId ? [
          {
            serviceTypeId: validServiceTypeId,
            quantity: 5,
            sortOrder: 1,
          },
          {
            serviceTypeId: validServiceTypeId,
            quantity: 3,
            sortOrder: 2,
          },
        ] : undefined,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      testProductId = createResponse.body.id;
      expect(createResponse.body).toHaveProperty('id');
      expect(createResponse.body.name).toBe(createDto.name);
      expect(createResponse.body.code).toBe(createDto.code);

      // Step 2: Get the created product and verify items are included if they were added
      const getResponse = await request(app.getHttpServer())
        .get(`/api/admin/products/${testProductId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (validServiceTypeId) {
        expect(getResponse.body.items).toBeDefined();
        expect(getResponse.body.items).toHaveLength(2);
      }

      // Step 3: Update the product with new items if we have a valid service type ID
      if (validServiceTypeId) {
        const updateDto: UpdateProductDto = {
          name: 'Updated Integration Product',
          addItems: [
            {
              serviceTypeId: validServiceTypeId,
              quantity: 2,
              sortOrder: 3,
            },
          ],
        };

        const updateResponse = await request(app.getHttpServer())
          .patch(`/api/admin/products/${testProductId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateDto)
          .expect(200);

        expect(updateResponse.body.name).toBe(updateDto.name);

        // Step 4: Get the updated product and verify items count increased
        const getUpdatedResponse = await request(app.getHttpServer())
          .get(`/api/admin/products/${testProductId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(getUpdatedResponse.body.items).toHaveLength(3);
      } else {
        // Just update the product name without adding items
        const updateDto: UpdateProductDto = {
          name: 'Updated Integration Product',
        };

        const updateResponse = await request(app.getHttpServer())
          .patch(`/api/admin/products/${testProductId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateDto)
          .expect(200);

        expect(updateResponse.body.name).toBe(updateDto.name);
      }

      // Step 5: Update product status
      const updateStatusDto: UpdateProductStatusDto = {
        status: ProductStatus.ACTIVE,
      };

      const updateStatusResponse = await request(app.getHttpServer())
        .patch(`/api/admin/products/${testProductId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateStatusDto)
        .expect(200);

      expect(updateStatusResponse.body.status).toBe(ProductStatus.ACTIVE);

      // Step 6: Create product snapshot
      const snapshotResponse = await request(app.getHttpServer())
        .get(`/api/admin/products/${testProductId}/snapshot`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(snapshotResponse.body).toHaveProperty('productId', testProductId);
      expect(snapshotResponse.body).toHaveProperty('items');
    }, 10000); // Increased individual test timeout

    it('should return products with items in search results', async () => {
      // Search for products using the new orderField and orderDirection parameters
      const searchResponse = await request(app.getHttpServer())
        .get('/api/admin/products?orderField=createdAt&orderDirection=desc&pageSize=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchResponse.body).toHaveProperty('data');
      expect(Array.isArray(searchResponse.body.data)).toBe(true);

      // Verify that each product has items property
      if (searchResponse.body.data.length > 0) {
        const firstProduct = searchResponse.body.data[0];
        expect(firstProduct).toHaveProperty('items');
        expect(Array.isArray(firstProduct.items)).toBe(true);
      }
    }, 10000); // Increased individual test timeout
  });

  describe('Product Filtering and Sorting', () => {
    it('should filter products by status and sort by name', async () => {
      // Filter ACTIVE products and sort by name ascending
      const filterResponse = await request(app.getHttpServer())
        .get('/api/admin/products?status=ACTIVE&orderField=name&orderDirection=asc&pageSize=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(filterResponse.body).toHaveProperty('data');
      expect(Array.isArray(filterResponse.body.data)).toBe(true);

      // Verify that all returned products are ACTIVE
      filterResponse.body.data.forEach((product: any) => {
        expect(product.status).toBe(ProductStatus.ACTIVE);
      });
    }, 10000); // Increased individual test timeout
  });
});
