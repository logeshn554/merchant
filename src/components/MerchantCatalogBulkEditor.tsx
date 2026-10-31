import { useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import type { GroceryProduct, MenuItem } from '../types';
import { bulkSaveCatalogItems } from '../data/firestoreHelper';
import { parseBulkCatalogCsv, serializeCatalogCsv, type CatalogType } from '../catalog/bulkCatalogCsv';

export default function MerchantCatalogBulkEditor({ merchantId, type, items, onClose }: {
  merchantId: string;
  type: CatalogType;
  items: (MenuItem | GroceryProduct)[];
  onClose: () => void;
}) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof parseBulkCatalogCsv> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const downloadCatalog = () => {
    const contents = serializeCatalogCsv(items, type);
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `allgo-${type}-catalog.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const loadFile = async (file?: File) => {
    setPreview(null); setMessage(''); setFileName(file?.name || '');
    if (!file) return;
    if (file.size > 1024 * 1024) { setMessage('Choose a CSV file no larger than 1 MB.'); return; }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') { setMessage('Choose a .csv file.'); return; }
    try { setPreview(parseBulkCatalogCsv(await file.text(), type, items)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The CSV could not be read.'); }
  };
  const submit = async () => {
    if (busy || !preview || preview.errors.length || !preview.rows.length) return;
    setBusy(true); setMessage('');
    try {
      const result = await bulkSaveCatalogItems({
        merchantId,
        merchantType: type,
        requestId: crypto.randomUUID(),
        items: preview.rows.map(({ itemId, item, expectedStock }) => ({ itemId, item, ...(expectedStock !== undefined ? { expectedStock } : {}) })),
      });
      setMessage(`Saved ${result.saved} rows: ${result.created} added and ${result.updated} updated. Catalog changes are syncing.`);
      setPreview(null); setFileName('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The catalog import failed. Refresh the catalog before retrying.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4" aria-label="Bulk catalog import and editing">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold text-white"><FileSpreadsheet size={17}/>Bulk catalog import and editing</h3><p className="mt-1 text-xs text-slate-300">Download the current CSV, edit it, then preview and save up to 100 rows in one validated batch. Existing dish variants and add-on groups are preserved.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close bulk catalog editor" className="rounded p-2 text-slate-300 hover:bg-slate-800"><X size={17}/></button></div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={downloadCatalog} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-3 text-xs font-bold text-white disabled:opacity-50"><Download size={16}/>Download current catalog CSV</button><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-500"><Upload size={16}/>Choose CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { void loadFile(event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only"/></label>{fileName && <span className="self-center text-xs text-slate-300">{fileName}</span>}</div>
    <p className="text-xs text-slate-400">Required: name, category and price{type === 'grocery' ? ', stock' : ''}. Keep the exported id to edit an item; leave it blank to add a new one. Separate allergens with |. Grocery edits use the current expected stock to prevent overwriting concurrent inventory changes.</p>
    {preview && <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><strong className="text-white">Preview · {preview.rows.length} row(s)</strong><span className={preview.errors.length ? 'text-rose-300' : 'text-emerald-300'}>{preview.errors.length ? `${preview.errors.length} issue(s)` : 'Ready to save'}</span></div>{preview.errors.length > 0 && <ul className="max-h-36 list-inside list-disc overflow-auto text-xs text-rose-300">{preview.errors.map((error,index)=><li key={`${index}:${error}`}>{error}</li>)}</ul>}{preview.rows.length > 0 && <div className="max-h-48 overflow-auto"><table className="w-full text-left text-xs text-slate-200"><thead><tr><th className="p-2">Line</th><th className="p-2">Action</th><th className="p-2">Item</th><th className="p-2">Price</th>{type === 'grocery' && <th className="p-2">Stock</th>}</tr></thead><tbody>{preview.rows.map(row=><tr key={row.itemId} className="border-t border-slate-800"><td className="p-2">{row.line}</td><td className="p-2">{items.some(item=>item.id===row.itemId)?'Update':'Add'}</td><td className="p-2">{String(row.item.name)}</td><td className="p-2">₹{String(row.item.price)}</td>{type === 'grocery' && <td className="p-2">{String(row.item.stock)}</td>}</tr>)}</tbody></table></div>}<button type="button" onClick={()=>void submit()} disabled={busy || !preview.rows.length || Boolean(preview.errors.length)} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Saving validated catalog…' : `Save ${preview.rows.length} catalog row(s)`}</button></div>}
    {message && <p role="status" className="text-xs text-slate-200">{message}</p>}
  </section>;
}
