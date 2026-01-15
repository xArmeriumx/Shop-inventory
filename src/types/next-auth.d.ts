import 'next-auth';
import type { Permission } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      // RBAC fields
      shopId?: string;
      roleId?: string;
      permissions?: Permission[];
      isOwner?: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    // RBAC fields
    shopId?: string;
    roleId?: string;
    permissions?: Permission[];
    isOwner?: boolean;
  }
}
