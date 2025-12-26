import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | 10 Catch` : '10 Catch - Classic Indian Card Game';
    
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
