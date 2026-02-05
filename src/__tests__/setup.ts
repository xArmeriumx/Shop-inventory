import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js cache function
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn((fn: Function) => fn),
}));

// Global test utilities
export {};
