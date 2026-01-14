import { db } from '@/lib/db';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export async function paginatedQuery<T>(
  model: {
    findMany: (args: any) => Promise<T[]>;
    count: (args: any) => Promise<number>;
  },
  options: {
    where?: object;
    include?: object;
    orderBy?: object;
    page?: number;
    limit?: number;
  }
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      where: options.where,
      include: options.include,
      orderBy: options.orderBy || { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    model.count({ where: options.where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Build search filter for Prisma
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: string[]
): object | undefined {
  if (!search || search.trim() === '') return undefined;

  const searchTerm = search.trim();

  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive',
      },
    })),
  };
}

/**
 * Build date range filter for Prisma
 */
export function buildDateRangeFilter(
  startDate?: Date | string,
  endDate?: Date | string
): object | undefined {
  if (!startDate && !endDate) return undefined;

  const filter: { gte?: Date; lte?: Date } = {};

  if (startDate) {
    filter.gte = new Date(startDate);
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }

  return filter;
}
