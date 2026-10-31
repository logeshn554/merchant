import { Clock, Heart, Minus, Plus, Star, Utensils, Sparkles } from 'lucide-react';
import type { MenuItem, Restaurant } from '../types';
import { CatalogImage } from '../design-system/CatalogImage';
import { CatalogState } from '../design-system/CatalogState';

export default function RestaurantMenu({ restaurant, items, categories, category, onCategory, loading, error, onRetry, onClear, onAbout, favoriteIds, onFavorite, onDetails, quantities, selectedVariants, selectedAddOns = {}, onVariant, onAddOnToggle, onAdd, onRemove }: {
  restaurant: Restaurant; items: MenuItem[]; categories: string[]; category: string; onCategory: (category: string) => void;
  loading: boolean; error: string; onRetry: () => void; onClear: () => void; onAbout: () => void;
  favoriteIds: string[]; onFavorite: (id: string) => void; onDetails: (id: string) => void;
  quantities: (id: string, variantId?: string, addOnIds?: string[]) => number; selectedVariants: Record<string,string>; selectedAddOns?: Record<string,string[]>;
  onVariant: (id: string, variant: string) => void; onAddOnToggle: (id: string, optionId: string) => void; onAdd: (item: MenuItem, variant?: {id:string;label:string}, addOnIds?: string[]) => void; onRemove: (item: MenuItem, variantId?: string, addOnIds?: string[]) => void;
}) {
  return (
    <section className="stitch-menu" data-screen="restaurant-detail-and-menu">
      <div className="stitch-restaurant-hero">
        <CatalogImage src={restaurant.image} alt="" className="stitch-restaurant-cover" fallback={<Utensils size={64}/>} />
        <button type="button" aria-label={`${favoriteIds.includes(`restaurant:${restaurant.id}`) ? 'Unsave' : 'Save'} ${restaurant.name}`} aria-pressed={favoriteIds.includes(`restaurant:${restaurant.id}`)} onClick={()=>onFavorite(`restaurant:${restaurant.id}`)}>
          <Heart size={20} fill={favoriteIds.includes(`restaurant:${restaurant.id}`)?'currentColor':'none'}/>
        </button>
      </div>

      <div className="stitch-restaurant-summary">
        <h2>{restaurant.name}</h2>
        <p>{restaurant.cuisine}</p>
        <div>
          {restaurant.rating > 0 && <span className="stitch-rating"><Star size={14} fill="currentColor"/>{restaurant.rating}</span>}
          {restaurant.deliveryTime && <span><Clock size={15}/>{restaurant.deliveryTime}</span>}
        </div>
        {(restaurant.acceptingOrders === false || restaurant.isBusy) && (
          <p className="stitch-closed" role="status">
            {restaurant.isBusy ? 'Busy, not accepting right now' : 'Not accepting orders right now'}
          </p>
        )}
      </div>

      <div className="stitch-menu-tabs">
        <span aria-current="page">Menu</span>
        <button type="button" onClick={onAbout}>Restaurant info</button>
      </div>

      <div className="stitch-menu-layout">
        <nav className="stitch-menu-rail" aria-label="Menu categories">
          {categories.map(name => (
            <button type="button" key={name} aria-pressed={category===name} onClick={()=>onCategory(name)}>
              {name}
            </button>
          ))}
        </nav>

        <div className="stitch-menu-items">
          {error ? (
            <CatalogState kind="error" title="Menu could not load" description={error} action={<button onClick={onRetry}>Try again</button>}/>
          ) : loading ? (
            <CatalogState kind="loading" title="Loading menu" description="Checking current dishes and availability."/>
          ) : !items.length ? (
            <CatalogState kind="no-results" title="No dishes to show" description="Try another category or clear your filters. Only published available dishes are shown." action={<button onClick={onClear}>Clear filters</button>}/>
          ) : items.map(item => {
            const variants = (item.variants?.filter(v => v.available !== false) || []).map(v => ({
              ...v,
              label: v.label || v.name || 'Option',
            }));
            const variant = variants.find(v => v.id === selectedVariants[item.id]) || variants[0];
            const selectedAddOnIds = selectedAddOns[item.id] || [];
            const quantity = quantities(item.id, variant?.id, selectedAddOnIds);

            // Normalize addOnGroups / modifierGroups
            const rawGroups = item.addOnGroups || (item.modifierGroups as any)?.map((g: any) => ({
              id: g.id,
              label: g.title || g.label,
              required: (g.minSelect ?? 0) > 0,
              maxSelections: g.maxSelect ?? 10,
              options: g.options.map((o: any) => ({
                id: o.id,
                label: o.name || o.label,
                price: o.price,
                available: o.available !== false,
              })),
            })) || [];

            const missingRequiredAddOn = rawGroups.some((group: any) =>
              group.required && !group.options.some((opt: any) => selectedAddOnIds.includes(opt.id) && opt.available !== false)
            );
            const blocked = restaurant.acceptingOrders === false || restaurant.isBusy || item.available === false || Boolean(item.variants?.length && !variant) || Boolean(missingRequiredAddOn);
            const saved = favoriteIds.includes(`dish:${item.id}`);

            const dietaryType = item.dietary || (item.isVeg ? 'veg' : 'non_veg');

            return (
              <article className={`stitch-dish ${item.available === false ? 'opacity-60' : ''}`} key={item.id}>
                <div className="stitch-dish-copy">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Dietary indicator icon */}
                    <span
                      role="img"
                      className={`stitch-diet ${item.isVeg || dietaryType === 'veg' || dietaryType === 'vegan' ? 'vegetarian' : 'nonvegetarian'}`}
                      aria-label={dietaryType === 'vegan' ? 'Vegan' : dietaryType === 'egg' ? 'Contains Egg' : item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                    >
                      <i aria-hidden="true"/>
                    </span>

                    {dietaryType === 'vegan' && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        VEGAN
                      </span>
                    )}

                    {dietaryType === 'egg' && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        EGG
                      </span>
                    )}

                    {/* Spiciness Level */}
                    {item.spiciness ? (
                      <span className="text-[11px]" title={`Spiciness Level ${item.spiciness}`}>
                        {'🌶️'.repeat(item.spiciness)}
                      </span>
                    ) : null}

                    {(variants.length > 0 || rawGroups.length > 0) && (
                      <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                        <Sparkles size={9} /> Customisable
                      </span>
                    )}
                  </div>

                  <button type="button" className="stitch-dish-title text-left font-bold mt-1" onClick={()=>onDetails(item.id)}>
                    {item.name}
                  </button>

                  <strong className="text-sm font-black text-slate-900 mt-0.5 block">
                    ₹{variant?.price ?? item.price}
                  </strong>

                  {item.description && <p className="text-xs text-slate-500 mt-1">{item.description}</p>}

                  {/* Allergen Information */}
                  {item.allergens && item.allergens.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.allergens.map(allergen => (
                        <span key={allergen} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          Contains: {allergen}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Variants selection */}
                  {variants.length > 0 && (
                    <fieldset className="stitch-variant-options mt-2">
                      <legend className="text-[11px] font-bold text-slate-600">Choose Size / Variant</legend>
                      {variants.map(option => (
                        <label className="stitch-variant-option" key={option.id}>
                          <input
                            type="radio"
                            name={`variant-${item.id}`}
                            aria-label={`${item.name}: ${option.label}, ₹${option.price}`}
                            value={option.id}
                            checked={variant?.id === option.id}
                            onChange={() => onVariant(item.id, option.id)}
                          />
                          <span>{option.label}</span>
                          <strong>₹{option.price}</strong>
                        </label>
                      ))}
                    </fieldset>
                  )}

                  {/* Modifiers & Add-ons selection */}
                  {rawGroups.map((group: any) => {
                    const chosen = group.options.filter((opt: any) => selectedAddOnIds.includes(opt.id));
                    return (
                      <fieldset key={group.id} className="stitch-variant-options mt-2">
                        <legend className="text-[11px] font-bold text-slate-600">
                          {group.label} {group.required ? '· Required' : '· Optional'} <small className="text-slate-400 font-normal">(choose up to {group.maxSelections})</small>
                        </legend>
                        {group.options.map((option: any) => (
                          <label className="stitch-variant-option" key={option.id}>
                            <input
                              type="checkbox"
                              aria-label={`${group.label}: ${option.label}, ${option.price ? `add ₹${option.price}` : 'no extra charge'}`}
                              checked={selectedAddOnIds.includes(option.id)}
                              disabled={option.available === false || (!selectedAddOnIds.includes(option.id) && chosen.length >= group.maxSelections)}
                              onChange={() => onAddOnToggle(item.id, option.id)}
                            />
                            <span>{option.label}{option.available === false ? ' · Unavailable' : ''}</span>
                            <strong>{option.price ? `+₹${option.price}` : 'Free'}</strong>
                          </label>
                        ))}
                      </fieldset>
                    );
                  })}
                </div>

                <div className="stitch-dish-end">
                  <button type="button" className="stitch-dish-image" aria-label={`Details for ${item.name}`} onClick={()=>onDetails(item.id)}>
                    <CatalogImage src={item.image} alt="" className="stitch-dish-image-inner" fallback={<Utensils size={24}/>}/>
                  </button>

                  {item.available === false ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                      Sold Out
                    </span>
                  ) : quantity === 0 ? (
                    <button
                      type="button"
                      className="stitch-add"
                      disabled={blocked}
                      onClick={() => onAdd(item, variant ? { id: variant.id, label: variant.label } : undefined, selectedAddOnIds)}
                    >
                      <Plus size={14}/>Add
                    </button>
                  ) : (
                    <div className="stitch-stepper">
                      <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => onRemove(item, variant?.id, selectedAddOnIds)}>
                        <Minus size={14}/>
                      </button>
                      <output aria-label={`Quantity of ${item.name}`}>{quantity}</output>
                      <button type="button" aria-label={`Add one ${item.name}`} disabled={blocked} onClick={() => onAdd(item, variant ? { id: variant.id, label: variant.label } : undefined, selectedAddOnIds)}>
                        <Plus size={14}/>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="stitch-dish-save"
                    aria-label={`${saved ? 'Unsave' : 'Save'} ${item.name}`}
                    aria-pressed={saved}
                    onClick={() => onFavorite(`dish:${item.id}`)}
                  >
                    <Heart size={15} fill={saved ? 'currentColor' : 'none'}/>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
