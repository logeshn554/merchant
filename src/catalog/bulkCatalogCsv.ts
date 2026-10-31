import type { GroceryProduct, MenuItem } from '../types';

export type CatalogType = 'restaurant' | 'grocery';
export type BulkCatalogRow = { itemId: string; item: Record<string, unknown>; expectedStock?: number; line: number };
export type BulkCatalogParseResult = { rows: BulkCatalogRow[]; errors: string[] };

const commonHeaders = ['id', 'name', 'category', 'price', 'description', 'image', 'ingredients', 'allergens'];
const headersByType: Record<CatalogType, string[]> = {
  restaurant: [...commonHeaders, 'available', 'isVeg', 'servingSize'],
  grocery: [...commonHeaders, 'stock', 'expectedStock', 'unit', 'brand', 'storageInstructions', 'countryOfOrigin', 'expiresAt'],
};
const requiredHeaders: Record<CatalogType, string[]> = {
  restaurant: ['name', 'category', 'price'],
  grocery: ['name', 'category', 'price', 'stock'],
};

export function parseCsvTable(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, afterQuote = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else cell += char;
      continue;
    }
    if (afterQuote && char !== ',' && char !== '\r' && char !== '\n' && char !== ' ' && char !== '\t') throw new Error(`Unexpected character after a quoted value at character ${index + 1}.`);
    if (char === '"' && !cell && !afterQuote) quoted = true;
    else if (char === ',' ) { row.push(cell.trim()); cell = ''; afterQuote = false; }
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = []; cell = ''; afterQuote = false;
    } else if (!afterQuote || char !== ' ' && char !== '\t') cell += char;
  }
  if (quoted) throw new Error('The CSV file ends inside a quoted value.');
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

function parseBoolean(value: string, fallback: boolean, label: string, line: number, errors: string[]) {
  if (!value) return fallback;
  if (/^(true|yes|1)$/i.test(value)) return true;
  if (/^(false|no|0)$/i.test(value)) return false;
  errors.push(`Line ${line}: ${label} must be true or false.`);
  return fallback;
}

function parsePrice(value: string, line: number, errors: string[]) {
  const price = Number(value);
  if (!value || !Number.isFinite(price) || price <= 0 || price > 100000 || Math.round(price * 100) !== price * 100) errors.push(`Line ${line}: price must be greater than ₹0 and have at most two decimal places.`);
  return Math.round(price * 100) / 100;
}

export function parseBulkCatalogCsv(source: string, type: CatalogType, existingItems: (MenuItem | GroceryProduct)[]): BulkCatalogParseResult {
  if (source.length > 1024 * 1024) return { rows: [], errors: ['CSV files must be 1 MB or smaller.'] };
  let table: string[][];
  try { table = parseCsvTable(source.replace(/^\uFEFF/, '')); }
  catch (error) { return { rows: [], errors: [error instanceof Error ? error.message : 'CSV could not be parsed.'] }; }
  if (!table.length) return { rows: [], errors: ['Choose a CSV file with a header row and at least one item.'] };
  const headers = table[0].map(value => value.trim());
  const normalizedHeaders = headers.map(value => value.toLowerCase());
  const errors: string[] = [];
  if (new Set(normalizedHeaders).size !== headers.length) errors.push('CSV headers must be unique.');
  const unknown = normalizedHeaders.filter(header => !headersByType[type].some(allowed => allowed.toLowerCase() === header));
  if (unknown.length) errors.push(`Unsupported ${type} columns: ${unknown.join(', ')}.`);
  const missing = requiredHeaders[type].filter(header => !normalizedHeaders.includes(header.toLowerCase()));
  if (missing.length) errors.push(`Required columns are missing: ${missing.join(', ')}.`);
  if (errors.length) return { rows: [], errors };
  if (table.length - 1 > 100) return { rows: [], errors: ['Import up to 100 catalog items per batch.'] };
  const existingById = new Map(existingItems.map(item => [item.id, item]));
  const seen = new Set<string>(), rows: BulkCatalogRow[] = [];
  const cellsToObject = (cells: string[]) => Object.fromEntries(headersByType[type].map(header => [header, normalizedHeaders.includes(header.toLowerCase()) ? cells[normalizedHeaders.indexOf(header.toLowerCase())] ?? '' : '']));
  for (const [offset, cells] of table.slice(1).entries()) {
    const line = offset + 2;
    if (cells.length !== headers.length) { errors.push(`Line ${line}: expected ${headers.length} columns but found ${cells.length}.`); continue; }
    const value = cellsToObject(cells);
    const sourceId = value.id.trim(), itemId = sourceId || crypto.randomUUID();
    if (itemId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(itemId)) errors.push(`Line ${line}: id may contain only letters, numbers, underscores and hyphens.`);
    if (seen.has(itemId)) errors.push(`Line ${line}: id ${itemId} appears more than once.`);
    seen.add(itemId);
    const current = (sourceId ? existingById.get(sourceId) : undefined) as (MenuItem | GroceryProduct | undefined);
    if (sourceId && !current) errors.push(`Line ${line}: id ${sourceId} is not in the current catalog. Clear the id to add a new item, or refresh and download the catalog again.`);
    const name = value.name.trim(), category = value.category.trim();
    if (!name || name.length > 120) errors.push(`Line ${line}: name is required and must be at most 120 characters.`);
    if (!category || category.length > 80) errors.push(`Line ${line}: category is required and must be at most 80 characters.`);
    const price = parsePrice(value.price, line, errors);
    const image = value.image.trim();
    if (image) { try { const url = new URL(image); if (url.protocol !== 'https:' || url.username || url.password || image.length > 2048) throw new Error(); } catch { errors.push(`Line ${line}: image must be an HTTPS URL without embedded credentials.`); } }
    const allergens = value.allergens ? value.allergens.split('|').map(allergen => allergen.trim()).filter(Boolean) : [];
    if (allergens.length > 30 || allergens.some(allergen => allergen.length > 80)) errors.push(`Line ${line}: provide at most 30 allergen names, each at most 80 characters, separated by |.`);
    const item: Record<string, unknown> = {
      name, category, price, description: normalizedHeaders.includes('description') ? value.description.trim() : current?.description || '', image: normalizedHeaders.includes('image') ? image : current?.image || '',
      ingredients: normalizedHeaders.includes('ingredients') ? value.ingredients.trim() : current?.ingredients || '', allergens: normalizedHeaders.includes('allergens') ? allergens : current?.allergens || [],
    };
    let expectedStock: number | undefined;
    if (type === 'restaurant') {
      const old = current as MenuItem | undefined;
      item.available = parseBoolean(value.available, old?.available !== false, 'available', line, errors);
      item.isVeg = parseBoolean(value.isVeg, old?.isVeg === true, 'isVeg', line, errors);
      item.servingSize = normalizedHeaders.includes('servingsize') ? value.servingSize.trim() : old?.servingSize || '';
    } else {
      const old = current as GroceryProduct | undefined, stock = Number(value.stock);
      if (!/^\d+$/.test(value.stock) || !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) errors.push(`Line ${line}: stock must be a whole number from 0 to 1,000,000.`);
      item.stock = stock;
      item.unit = normalizedHeaders.includes('unit') ? value.unit.trim() || '1 item' : old?.unit || '1 item';
      item.brand = normalizedHeaders.includes('brand') ? value.brand.trim() : old?.brand || '';
      item.storageInstructions = normalizedHeaders.includes('storageinstructions') ? value.storageInstructions.trim() : old?.storageInstructions || '';
      item.countryOfOrigin = normalizedHeaders.includes('countryoforigin') ? value.countryOfOrigin.trim() : old?.countryOfOrigin || 'India';
      item.expiresAt = normalizedHeaders.includes('expiresat') ? value.expiresAt.trim() || null : old?.expiresAt || null;
      if (old) {
        expectedStock = value.expectedStock !== '' ? Number(value.expectedStock) : old.stock;
        if (!Number.isSafeInteger(expectedStock) || expectedStock !== old.stock) errors.push(`Line ${line}: expectedStock must match the current stock (${old.stock}); refresh the catalog and re-import.`);
      }
    }
    rows.push({ itemId, item, ...(expectedStock !== undefined ? { expectedStock } : {}), line });
  }
  return { rows, errors };
}

function csvCell(value: unknown) {
  const string = value == null ? '' : String(value);
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

export function serializeCatalogCsv(items: (MenuItem | GroceryProduct)[], type: CatalogType) {
  const headers = headersByType[type];
  return [headers, ...items.map(item => type === 'restaurant'
    ? [item.id, item.name, item.category, item.price, item.description || '', item.image || '', item.ingredients || '', item.allergens?.join('|') || '', (item as MenuItem).available !== false, (item as MenuItem).isVeg === true, (item as MenuItem).servingSize || '']
    : [item.id, item.name, item.category, item.price, item.description || '', item.image || '', item.ingredients || '', item.allergens?.join('|') || '', (item as GroceryProduct).stock, (item as GroceryProduct).stock, (item as GroceryProduct).unit, (item as GroceryProduct).brand || '', (item as GroceryProduct).storageInstructions || '', (item as GroceryProduct).countryOfOrigin || '', (item as GroceryProduct).expiresAt || ''])]
    .map(row => row.map(csvCell).join(',')).join('\r\n');
}
