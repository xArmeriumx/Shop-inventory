import { describe, it, expect } from 'vitest';
import { productSchema } from '@/schemas/inventory/product.schema';
import { customerSchema } from '@/schemas/sales/customer.schema';

describe('Validation Semantics (Clean then Validate)', () => {
    describe('Product Schema', () => {
        it('should fail name validation if it only contains spaces', () => {
            const result = productSchema.safeParse({
                name: '   ',
                category: 'Test',
                costPrice: 10,
                salePrice: 20,
                stock: 0,
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('กรุณากรอกชื่อสินค้า');
            }
        });

        it('should normalize SKU to uppercase before regex validation', () => {
            const result = productSchema.safeParse({
                name: 'Test Product',
                sku: 'abc-123 ', // has lowercase and trailing space
                category: 'Test',
                costPrice: 10,
                salePrice: 20,
                stock: 0,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.sku).toBe('ABC-123');
            }
        });
    });

    describe('Customer Schema', () => {
        it('should normalize phone then check length', () => {
            // User enters "081-234-5678" (12 characters)
            // It should be normalized to "0812345678" (10 characters) and pass.
            const result = customerSchema.safeParse({
                name: 'Test Customer',
                phone: '081-234-5678',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.phone).toBe('0812345678');
            }
        });

        it('should fail phone if less than 9 digits after normalization', () => {
            const result = customerSchema.safeParse({
                name: 'Test Customer',
                phone: '081-23-45', // 7 digits
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('เบอร์โทรต้องมี 9-10 หลัก');
            }
        });

        it('should normalize taxId then check length', () => {
            const result = customerSchema.safeParse({
                name: 'Test Customer',
                taxId: '1-2345-67890-12-3 ', // has hyphens and space
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.taxId).toBe('1234567890123');
            }
        });
    });
});
