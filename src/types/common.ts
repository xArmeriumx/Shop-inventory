import type { Permission } from '@prisma/client';

export interface RequestContext {
    userId: string;
    memberId?: string;
    userName?: string;
    userEmail?: string;
    shopId: string;
    permissions: Permission[];
    isOwner: boolean;
    sessionVersion?: number;
    employeeDepartment?: string;
}

export type ActionResponse<T = unknown> = {
    success: boolean;
    message?: string;
    data?: T;
    errors?: Record<string, string[]> | string;
    action?: ErrorAction;
};

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export interface ErrorAction {
    label: string;
    href: string;
}

export class ServiceError extends Error {
    constructor(
        message: string,
        public errors?: Record<string, string[]>,
        public action?: ErrorAction
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}

export interface BaseQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
