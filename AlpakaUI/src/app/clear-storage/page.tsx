'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClearStoragePage() {
  const router = useRouter();

  useEffect(() => {
    // Clear all localStorage items
    localStorage.clear();
    
    // Clear sessionStorage as well
    sessionStorage.clear();
    
    // Show confirmation
    alert('Storage cleared! Redirecting to home...');
    
    // Redirect to home
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Clearing Storage...</h1>
        <p className="text-gray-600">Please wait...</p>
      </div>
    </div>
  );
}