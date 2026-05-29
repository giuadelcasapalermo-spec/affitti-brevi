'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Clock, Loader2, X, Euro, Users, BedDouble, Receipt, Pencil } from 'lucide-react';
import { useCamere } from '@/hooks/useCamere';

const TRIMESTRI = ['Q1 Gen–Mar', 'Q2 Apr–Giu', 'Q3 Lug–Set', 'Q4 Ott–Dic'];

type Prenotazione = {
  id: string;
  ospite_nome: string;
  camera_id: number;
  check_in: string;
  check_out: string;
  notti: number;
  notti_tassabili: number;
  n_ospiti: number;
  tassa_riscossa: number;
};

type Dichiarazione = {
  importo_versato: number;
  data_dichiarazione: string | null;
  note: string;
};

type DatiTrimestre = {
  prenotazioni: Prenotazione[];
  totale_riscosso: number;
  notti_totali: number;
  ospiti_totali: number;
  dichiarazione: Dichiarazione | null;
};

function trimestreCorrente(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

export default function TassaSoggiorno() {
  const camere = useCamere();
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [trim, setTrim] = useState(trimestreCorrente());
  const [dati, setDati] = useState<DatiTrimestre | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formImporto, setFormImporto] = useState('');
  const [formData, setFormData] = useState('');
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');

  const carica = useCallback(async (a: number, t: number) => {
    setLoading(true);
    const res = await fetch(`/api/tassa-soggiorno?anno=${a}&trimestre=${t}`);
    setDati(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { carica(anno, trim); }, [anno, trim, carica]);

  function nomeCamera(id: number) {
    return camere.find(c => c.id === id)?.nome ?? `Cam ${id}`;
  }

  function formatData(d: string) {
    try { return format(parseISO(d), 'd MMM', { locale: it }); } catch { return d; }
  }

  async function salvaDichiarazione() {
    setSaving(true);
    await fetch('/api/tassa-soggiorno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anno, trimestre: trim,
        importo_versato: parseFloat(formImporto) || 0,
        data_dichiarazione: formData || null,
        note: formNote,
      }),
    });
    setSaving(false);
    setShowForm(false);
    carica(anno, trim);
  }

  async function salvaTassaRiga(id: string, valore: number) {
    setEditingId(null);
    await fetch('/api/tassa-soggiorno', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenotazione_id: id, tassa_soggiorno: valore }),
    });
    carica(anno, trim);
  }

  async function annullaDichiarazione() {
    if (!confirm('Annullare la dichiarazione per questo trimestre?')) return;
    await fetch(`/api/tassa-soggiorno?anno=${anno}&trimestre=${trim}`, { method: 'DELETE' });
    carica(anno, trim);
  }

  function apriFormDichiarazione() {
    setFormImporto(dati?.totale_riscosso.toFixed(2) ?? '');
    setFormData(new Date().toISOString().split('T')[0]);
    setFormNote('');
    setShowForm(true);
  }

  function esportaCsv() {
    window.open(`/api/tassa-soggiorno/export?anno=${anno}&trimestre=${trim}`, '_blank');
  }

  const dichiarata = !!dati?.dichiarazione;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnno(a => a - 1)} className="p-1.5 rounded hover:bg-gray-100">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-gray-800 text-sm w-12 text-center">{anno}</span>
          <button onClick={() => setAnno(a => a + 1)} className="p-1.5 rounded hover:bg-gray-100">
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={esportaCsv}
          disabled={!dati || dati.prenotazioni.length === 0}
          className="flex items-center gap-1.5 border border-gray-300 bg-white px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          <Download size={14} />
          <span className="hidden sm:inline">Esporta CSV</span>
        </button>
      </div>

      {/* Quarter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {TRIMESTRI.map((label, i) => (
          <button
            key={i}
            onClick={() => setTrim(i + 1)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              trim === i + 1
                ? 'bg-white shadow-sm text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400">
          <Loader2 size={20} className="animate-spin mx-auto" />
        </div>
      ) : !dati ? null : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: BedDouble, label: 'Prenotazioni', value: dati.prenotazioni.length, color: 'text-blue-600' },
              { icon: Users,     label: 'Ospiti',       value: dati.ospiti_totali,        color: 'text-violet-600' },
              { icon: Clock,     label: 'Notti tassabili', value: dati.notti_totali,      color: 'text-amber-600' },
              { icon: Euro,      label: 'Tassa riscossa', value: `€${dati.totale_riscosso.toFixed(2)}`, color: 'text-green-600' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm px-4 py-3">
                <div className={`flex items-center gap-1.5 ${color} mb-1`}>
                  <Icon size={14} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
                <div className="text-xl font-bold text-gray-800">{value}</div>
              </div>
            ))}
          </div>

          {/* Stato dichiarazione */}
          <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            {dichiarata ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    Dichiarata il {dati.dichiarazione!.data_dichiarazione
                      ? format(parseISO(dati.dichiarazione!.data_dichiarazione), 'd MMMM yyyy', { locale: it })
                      : '—'}
                  </span>
                  {dati.dichiarazione!.importo_versato > 0 && (
                    <span className="text-xs text-gray-500">· versati €{dati.dichiarazione!.importo_versato.toFixed(2)}</span>
                  )}
                  {dati.dichiarazione!.note && (
                    <span className="text-xs text-gray-400 italic">· {dati.dichiarazione!.note}</span>
                  )}
                </div>
                <button
                  onClick={annullaDichiarazione}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 border border-gray-200 px-2 py-1 rounded"
                >
                  <X size={11} /> Annulla
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-500" />
                  <span className="text-sm font-medium text-amber-700">Da dichiarare</span>
                </div>
                {dati.prenotazioni.length > 0 && (
                  <button
                    onClick={apriFormDichiarazione}
                    className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700"
                  >
                    <Receipt size={14} />
                    Segna come dichiarata
                  </button>
                )}
              </>
            )}
          </div>

          {/* Form dichiarazione */}
          {showForm && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-green-800">Registra dichiarazione</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Data dichiarazione</label>
                  <input
                    type="date"
                    value={formData}
                    onChange={e => setFormData(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Importo versato (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formImporto}
                    onChange={e => setFormImporto(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Note (opzionale)</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  placeholder="es. PagoPA n. 123456"
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={salvaDichiarazione}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Salva
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded text-sm border border-gray-300 hover:bg-gray-50">
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Tabella prenotazioni */}
          {dati.prenotazioni.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm py-10 text-center text-gray-400 text-sm">
              Nessuna prenotazione in questo trimestre
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Dettaglio presenze</span>
                <span className="text-xs text-gray-400">max 4 notti tassabili per soggiorno (Palermo)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wide text-[10px] border-b border-gray-100">
                      <th className="text-left px-4 py-2 font-medium">Arrivo</th>
                      <th className="text-left px-4 py-2 font-medium">Partenza</th>
                      <th className="text-left px-4 py-2 font-medium">Ospite</th>
                      <th className="text-left px-4 py-2 font-medium">Camera</th>
                      <th className="text-right px-4 py-2 font-medium">Notti</th>
                      <th className="text-right px-4 py-2 font-medium">Tax notti</th>
                      <th className="text-right px-4 py-2 font-medium">Ospiti</th>
                      <th className="text-right px-4 py-2 font-medium">
                        <span className="flex items-center justify-end gap-1">Tassa <Pencil size={10} className="text-gray-300" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dati.prenotazioni.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{formatData(p.check_in)}</td>
                        <td className="px-4 py-2 text-gray-500">{formatData(p.check_out)}</td>
                        <td className="px-4 py-2 font-medium text-gray-800">{p.ospite_nome}</td>
                        <td className="px-4 py-2 text-gray-500">{nomeCamera(p.camera_id)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{p.notti}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={p.notti_tassabili < p.notti ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                            {p.notti_tassabili}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{p.n_ospiti}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {editingId === p.id ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingVal}
                              onChange={e => setEditingVal(e.target.value)}
                              onBlur={() => salvaTassaRiga(p.id, parseFloat(editingVal) || 0)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="w-20 text-right border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => { setEditingId(p.id); setEditingVal(p.tassa_riscossa > 0 ? p.tassa_riscossa.toFixed(2) : '0.00'); }}
                              className="cursor-pointer group inline-flex items-center justify-end gap-1"
                              title="Clicca per modificare"
                            >
                              {p.tassa_riscossa > 0 ? `€${p.tassa_riscossa.toFixed(2)}` : <span className="text-gray-300">—</span>}
                              <Pencil size={9} className="text-gray-200 group-hover:text-blue-400 transition-colors" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-700">
                      <td colSpan={4} className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">Totali</td>
                      <td className="px-4 py-2 text-right">{dati.prenotazioni.reduce((s, p) => s + p.notti, 0)}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{dati.notti_totali}</td>
                      <td className="px-4 py-2 text-right">{dati.ospiti_totali}</td>
                      <td className="px-4 py-2 text-right text-green-700">€{dati.totale_riscosso.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
