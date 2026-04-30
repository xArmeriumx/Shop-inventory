'use client';

import { useEffect } from 'react';

export function PrintActions() {
  useEffect(() => {
    if (window.location.search.includes('autoprint=true')) {
      window.print();
    }
  }, []);

  return (
    <div className="fixed bottom-8 right-8 print:hidden">
      <button
        onClick={() => window.print()}
        className="bg-black text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2"
      >
        Print Now
      </button>
    </div>
  );
}
