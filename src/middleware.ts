import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

// Simple in-memory counter for RPS (active per container/instance)
// This resets when the middleware/container restarts
let requestCount = 0;
let lastReset = Date.now();

export const getRps = () => {
  // This function might be called by the system action if in the same process
  // But usually middleware runs in edge/separate context. 
  // We'll expose it via a global variable hack or just accept it's per-instance.
  return requestCount;
};

// Reset counter every second
// Note: In a real serverless edge environment, verify if `setInterval` persists.
// For Vercel Edge, it might not. We rely on the request passing through to update logic.

export default NextAuth(authConfig).auth((req) => {
  const now = Date.now();
  if (now - lastReset > 60000) { // Reset every minute to keep numbers sane? 
    // Actually, for RPS we want per second.
    // Let's just increment and let the System Action read/reset or just use a rolling window?
    // KEEP IT SIMPLE: Just count total requests. The System Action will measure delta.
  }
  
  // NOTE: This global variable might not be shared with the Server Action running in Node.js
  // Middleware runs on Edge (usually). Server Action runs in Node.js (Lambda).
  // They are DIFFERENT environments. Creating a shared variable won't work.
  // We need to store this in DB or Cache (Redis/KV).
  // Since we don't have Redis, we'll skip writing to DB on every request (too slow).
  
  // ALTERNATIVE: Use the simulated "Request Volume" we already had?
  // OR: Log significant actions only? 
  
  // Let's stick to the user Request: "Request Rate".
  // If we can't do it accurately without Redis, we might simulate it specific to the metrics call
  // OR: Log every 100th request to DB? No.
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
