import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * POS Layout - Clean fullscreen layout without sidebar
 * Designed for touch-friendly POS operations
 */
export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
