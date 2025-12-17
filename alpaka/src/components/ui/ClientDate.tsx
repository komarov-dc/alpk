'use client';

import { useEffect, useState } from 'react';

interface ClientDateProps {
  date: string | Date;
  format?: 'time' | 'date' | 'datetime';
  className?: string;
}

export const ClientDate = ({ date, format = 'datetime', className = '' }: ClientDateProps) => {
  const [formattedDate, setFormattedDate] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    switch (format) {
      case 'time':
        setFormattedDate(dateObj.toLocaleTimeString());
        break;
      case 'date':
        setFormattedDate(dateObj.toLocaleDateString());
        break;
      case 'datetime':
        setFormattedDate(dateObj.toLocaleString());
        break;
    }
  }, [date, format]);

  if (!isClient) {
    return <span className={className}>Loading...</span>;
  }

  return <span className={className}>{formattedDate}</span>;
};
