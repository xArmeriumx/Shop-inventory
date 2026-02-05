/**
 * Optimistic Locking Helper
 * 
 * ป้องกันปัญหา "Lost Update" เมื่อ 2 คนแก้ไขข้อมูลพร้อมกัน
 * 
 * @example
 * // ใน server action
 * const result = await optimisticUpdate(db.product, id, version, data, { shopId });
 * 
 * if (!result.success) {
 *   return { error: 'VERSION_CONFLICT', message: 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น' };
 * }
 */

import { Prisma } from '@prisma/client';

export const VERSION_CONFLICT_ERROR = 'VERSION_CONFLICT' as const;

export type OptimisticLockResult<T> = 
  | { success: true; data: T }
  | { success: false; error: typeof VERSION_CONFLICT_ERROR; currentVersion: number };

interface OptimisticUpdateOptions {
  shopId?: string;
  deletedAt?: null;
}

/**
 * Perform an optimistic update on a model with version checking
 * 
 * @param model - Prisma model delegate (e.g., db.product)
 * @param id - Record ID to update
 * @param expectedVersion - Version the client expects (from form)
 * @param data - Update data (will auto-increment version)
 * @param options - Additional where conditions (e.g., shopId)
 * @returns Success with data, or failure with current version
 */
export async function optimisticUpdate<T extends { version: number }>(
  model: any,
  id: string,
  expectedVersion: number,
  data: Omit<Partial<T>, 'id' | 'version'>,
  options: OptimisticUpdateOptions = {}
): Promise<OptimisticLockResult<T>> {
  try {
    // Build where clause
    const whereClause: Record<string, unknown> = {
      id,
      version: expectedVersion,  // Core: only update if version matches
    };
    
    if (options.shopId) {
      whereClause.shopId = options.shopId;
    }
    
    if (options.deletedAt === null) {
      whereClause.deletedAt = null;
    }

    // Atomic: Check version AND increment in single query
    const updated = await model.update({
      where: whereClause,
      data: {
        ...data,
        version: { increment: 1 },  // Auto-increment version
      },
    });

    return { success: true, data: updated as T };
  } catch (error) {
    // Handle Prisma P2025: Record not found (version mismatch or doesn't exist)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Check if record exists with different version
        const current = await model.findUnique({
          where: { id },
          select: { version: true },
        });

        if (current) {
          // Record exists but version didn't match
          return {
            success: false,
            error: VERSION_CONFLICT_ERROR,
            currentVersion: current.version,
          };
        }
        // Record truly doesn't exist - re-throw
      }
    }
    throw error;  // Re-throw unexpected errors
  }
}

/**
 * Wrap existing update logic with optimistic locking
 * 
 * Alternative pattern for more complex updates that need transaction control
 * 
 * @example
 * const result = await withOptimisticLock(db.product, id, version, { shopId }, async () => {
 *   // Your existing update logic here
 *   return await db.product.update({ ... });
 * });
 */
export async function withOptimisticLock<T>(
  model: any,
  id: string,
  expectedVersion: number,
  options: OptimisticUpdateOptions,
  updateFn: () => Promise<T>
): Promise<OptimisticLockResult<T>> {
  // Pre-check version before running update function
  const whereClause: Record<string, unknown> = { id };
  
  if (options.shopId) {
    whereClause.shopId = options.shopId;
  }
  if (options.deletedAt === null) {
    whereClause.deletedAt = null;
  }

  const current = await model.findFirst({
    where: whereClause,
    select: { version: true },
  });

  if (!current) {
    throw new Error('Record not found');
  }

  if (current.version !== expectedVersion) {
    return {
      success: false,
      error: VERSION_CONFLICT_ERROR,
      currentVersion: current.version,
    };
  }

  // Version matches, proceed with update
  const result = await updateFn();
  return { success: true, data: result };
}
