'use client';

import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export function ClientDate({ date }: { date: Date | string }) {
  // This runs on client, so it uses the browser's timezone (Bangkok +7)
  return <>{format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: th })}</>;
}
