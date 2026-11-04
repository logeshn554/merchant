import type { SellerVertical } from '../domain/merchant';
import type { GroceryProduct, MenuItem } from '../types';

function safeImage(value: string | undefined) {
  if (!value) return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : ''; }
  catch { return ''; }
}

export default function MerchantStorefrontPreview({ business, type, items }: {
  business: { name: string; address: string; acceptingOrders: boolean };
  type: SellerVertical;
  items: (MenuItem | GroceryProduct)[];
}) {
  const categories = [...new Set(items.map(item => item.category || 'Other'))].sort((a, b) => a.localeCompare(b));
  const available = (item: MenuItem | GroceryProduct) => type === 'restaurant'
    ? (item as MenuItem).available !== false
    : Number.isSafeInteger((item as GroceryProduct).stock) && (item as GroceryProduct).stock > 0;
  return <section data-panel="storefront-preview" data-screen="merchant-storefront-preview" aria-label="Customer storefront preview" className="space-y-4 rounded-2xl bg-slate-100 p-4 text-slate-900">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm"><div><span className="text-xs font-bold uppercase tracking-wide text-indigo-700">Customer preview · {type === 'restaurant' ? 'Restaurant' : 'Grocery'}</span><h2 className="mt-1 text-xl font-black">{business.name || 'Your store'}</h2><p className="mt-1 text-sm text-slate-600">{business.address || 'Store address not published'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${business.acceptingOrders ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{business.acceptingOrders ? 'Accepting orders' : 'Not accepting orders'}</span></div>
    <p className="text-xs text-slate-600">This preview uses the catalog and availability currently published for this store. Customer delivery coverage, distance fees, taxes and checkout totals are calculated for the customer’s address.</p>
    {!items.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"><h3 className="font-bold">Your storefront is empty</h3><p className="mt-1 text-sm text-slate-600">Add and publish catalog items to preview how customers will see your store.</p></div> : categories.map(category => <section key={category} className="space-y-2" aria-label={`${category} category`}><h3 className="text-sm font-extrabold">{category}</h3><div className="grid gap-3 sm:grid-cols-2">{items.filter(item => (item.category || 'Other') === category).map(item => {
      const image = safeImage(item.image), isAvailable = available(item);
      return <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex gap-3 p-3">{image ? <img src={image} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover"/> : <div aria-hidden="true" className="h-20 w-20 shrink-0 rounded-lg bg-slate-100"/>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h4 className="font-bold">{item.name}</h4><strong className="whitespace-nowrap">₹{Number.isFinite(item.price) ? item.price.toFixed(2) : '—'}</strong></div>{item.description && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.description}</p>}{type === 'restaurant' ? <p className="mt-1 text-xs text-slate-500">{(item as MenuItem).isVeg ? 'Vegetarian' : 'Menu item'}{(item as MenuItem).servingSize ? ` · ${(item as MenuItem).servingSize}` : ''}{(item as MenuItem).variants?.length ? ` · ${(item as MenuItem).variants?.length} options` : ''}{(item as MenuItem).addOnGroups?.length ? ` · ${(item as MenuItem).addOnGroups?.length} add-on groups` : ''}</p> : <p className="mt-1 text-xs text-slate-500">{(item as GroceryProduct).unit || 'Unit unavailable'} · {Number.isSafeInteger((item as GroceryProduct).stock) ? `${(item as GroceryProduct).stock} in stock` : 'Stock unavailable'}</p>}<p className={`mt-2 text-xs font-bold ${isAvailable ? 'text-emerald-700' : 'text-rose-700'}`}>{isAvailable ? 'Available' : 'Unavailable'}</p></div></div></article>;
    })}</div></section>)}
  </section>;
}
