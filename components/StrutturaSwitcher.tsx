'use client';
import { useState } from 'react';
import { useStruttura } from '@/hooks/useStruttura';
import { Building2, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function StrutturaSwitcher() {
  const { struttura, strutture, setStruttura } = useStruttura();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (strutture.length <= 1 && !struttura) return null;

  function seleziona(id: string) {
    setStruttura(id);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
      >
        <Building2 size={12} />
        <span className="max-w-[100px] truncate">{struttura?.nome ?? '—'}</span>
        {strutture.length > 1 && <ChevronDown size={11} />}
      </button>
      {open && strutture.length > 1 && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 z-50 min-w-[160px]">
          {strutture.map(s => (
            <button
              key={s.id}
              onClick={() => seleziona(s.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                s.id === struttura?.id ? 'font-semibold text-blue-700' : 'text-gray-700'
              }`}
            >
              <Building2 size={13} />
              {s.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
