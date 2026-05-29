'use client';

import { useState, useEffect } from 'react';
import { Camera } from '@/lib/types';

export function useCamere(): Camera[] {
  const [camere, setCamere] = useState<Camera[]>([]);

  useEffect(() => {
    fetch('/api/camere')
      .then((r) => r.json())
      .then(setCamere);
  }, []);

  return camere;
}
