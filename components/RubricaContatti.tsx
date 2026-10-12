'use client';

import { useEffect, useState } from 'react';
import { BookUser, Plus, Pencil, Trash2, Phone, Mail, MessageCircle, Search, X, Loader2 } from 'lucide-react';
import { Contatto, CATEGORIE_CONTATTO, CategoriaContatto } from '@/lib/types';
import { numeroWhatsApp } from '@/lib/utils';

type Campi = Omit<Contatto, 'id' | 'struttura_id' | 'created_at'>;
const VUOTO: Campi = { categoria: 'Idraulico', nome: '', azienda: '', cellulare: '', telefono: '', email: '', note: '' };

/** Rubrica di fornitori e tecnici della struttura attiva (idraulico, elettricista, pulizie, lavanderia…) */
export default function RubricaContatti({ strutturaId, nomeStruttura }: { strutturaId: string; nomeStruttura: string }) {
  const [contatti, setContatti] = useState<Contatto[] | null>(null);
  const [form, setForm] = useState<{ id: string | null; campi: Campi } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const [cerca, setCerca] = useState('');

  useEffect(() => {
    setContatti(null);
    fetch('/api/contatti').then(r => r.json()).then((d: unknown) => {
      setContatti(Array.isArray(d) ? d as Contatto[] : []);
    }).catch(() => setContatti([]));
  }, [strutturaId]);

  const set = <K extends keyof Campi>(k: K, v: Campi[K]) =>
    setForm(f => f && { ...f, campi: { ...f.campi, [k]: v } });

  async function salva(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErrore('');
    try {
      const res = await fetch(form.id ? `/api/contatti/${form.id}` : '/api/contatti', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.campi),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Salvataggio non riuscito');
      const c = d as Contatto;
      setContatti(prev => {
        const altri = (prev ?? []).filter(x => x.id !== c.id);
        return [...altri, c].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
      });
      setForm(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function elimina(c: Contatto) {
    if (!confirm(`Eliminare ${c.nome} dalla rubrica?`)) return;
    setContatti(prev => (prev ?? []).filter(x => x.id !== c.id));
    fetch(`/api/contatti/${c.id}`, { method: 'DELETE' });
  }

  const q = cerca.trim().toLowerCase();
  const visibili = (contatti ?? []).filter(c => !q ||
    [c.nome, c.azienda, c.categoria, c.cellulare, c.telefono, c.email, c.note].some(v => v.toLowerCase().includes(q)));
  const gruppi = CATEGORIE_CONTATTO
    .map(cat => ({ cat, voci: visibili.filter(c => c.categoria === cat) }))
    .filter(g => g.voci.length > 0);
  const input = 'w-full border rounded px-3 py-2 text-sm';

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BookUser size={18} className="text-rose-600" />
            <h2 className="font-semibold text-gray-700">Rubrica contatti</h2>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Fornitori e tecnici di {nomeStruttura}.</p>
        </div>
        {!form && (
          <button onClick={() => { setErrore(''); setForm({ id: null, campi: { ...VUOTO } }); }}
            className="flex items-center gap-1.5 bg-rose-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-rose-700 shrink-0">
            <Plus size={15} /> Contatto
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={salva} className="border border-rose-200 bg-rose-50/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{form.id ? 'Modifica contatto' : 'Nuovo contatto'}</h3>
            <button type="button" onClick={() => setForm(null)}><X size={16} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoria</label>
              <select className={input} value={form.campi.categoria} onChange={e => set('categoria', e.target.value as CategoriaContatto)}>
                {CATEGORIE_CONTATTO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome e cognome *</label>
              <input className={input} value={form.campi.nome} onChange={e => set('nome', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ditta</label>
              <input className={input} value={form.campi.azienda} onChange={e => set('azienda', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cellulare</label>
              <input type="tel" className={input} value={form.campi.cellulare} onChange={e => set('cellulare', e.target.value)} placeholder="333 1234567" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Telefono fisso</label>
              <input type="tel" className={input} value={form.campi.telefono} onChange={e => set('telefono', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" className={input} value={form.campi.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <textarea className={input} rows={2} value={form.campi.note} onChange={e => set('note', e.target.value)}
              placeholder="Orari, reperibilità, tariffe, IBAN…" />
          </div>
          {errore && <p className="text-sm text-red-600">{errore}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50 bg-white">Annulla</button>
            <button type="submit" disabled={salvando}
              className="px-4 py-2 text-sm bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-60 flex items-center gap-1.5">
              {salvando && <Loader2 size={14} className="animate-spin" />} Salva
            </button>
          </div>
        </form>
      )}

      {(contatti?.length ?? 0) > 3 && (
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input className="w-full border rounded pl-8 pr-3 py-2 text-sm" placeholder="Cerca nome, ditta, categoria…"
            value={cerca} onChange={e => setCerca(e.target.value)} />
        </div>
      )}

      {contatti === null ? (
        <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Caricamento…</div>
      ) : contatti.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nessun contatto. Aggiungi idraulico, elettricista, impresa di pulizie, lavanderia…</p>
      ) : gruppi.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Nessun contatto trovato.</p>
      ) : (
        <div className="space-y-4">
          {gruppi.map(g => (
            <div key={g.cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{g.cat}</h3>
              <div className="space-y-2">
                {g.voci.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">
                        {c.nome}{c.azienda && <span className="text-gray-500 font-normal"> · {c.azienda}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs">
                        {c.cellulare && (
                          <>
                            <a href={`tel:${c.cellulare.replace(/\s+/g, '')}`} className="flex items-center gap-1 text-blue-700 hover:underline">
                              <Phone size={11} />{c.cellulare}
                            </a>
                            <a href={`https://wa.me/${numeroWhatsApp(c.cellulare)}`} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-green-700 hover:underline">
                              <MessageCircle size={11} />WhatsApp
                            </a>
                          </>
                        )}
                        {c.telefono && (
                          <a href={`tel:${c.telefono.replace(/\s+/g, '')}`} className="flex items-center gap-1 text-blue-700 hover:underline">
                            <Phone size={11} />{c.telefono}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-700 hover:underline break-all">
                            <Mail size={11} />{c.email}
                          </a>
                        )}
                      </div>
                      {c.note && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{c.note}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setErrore(''); setForm({ id: c.id, campi: { ...c } }); }} title="Modifica"
                        className="text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => elimina(c)} title="Elimina" className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
