import { useState, type ReactNode } from 'react';
import type { Booking } from '../types';

interface OrderColumn {
  id: string;
  label: string;
  statuses: readonly string[];
}

const ORDER_COLUMNS: readonly OrderColumn[] = [
  { id: 'new', label: 'New', statuses: ['pending'] },
  { id: 'preparing', label: 'Preparing', statuses: ['accepted', 'preparing'] },
  { id: 'ready', label: 'Ready', statuses: ['ready'] },
  { id: 'out-for-delivery', label: 'Out for delivery', statuses: ['transit'] },
];

export default function MerchantOrderBoard({ orders, renderOrder }: { orders: readonly Booking[]; renderOrder: (order: Booking) => ReactNode }) {
  const [mobileColumn, setMobileColumn] = useState('new');
  const counts = ORDER_COLUMNS.map(column => ({ ...column, count: orders.filter(order => column.statuses.includes(order.status)).length }));

  return (
    <div className="merchant-order-board">
      <div className="merchant-order-board-tabs" role="tablist" aria-label="Order status">
        {counts.map(column => <button key={column.id} type="button" role="tab" aria-selected={mobileColumn === column.id} onClick={() => setMobileColumn(column.id)}><span>{column.label}</span><b>{column.count}</b></button>)}
      </div>
      <div className="merchant-order-board-columns">
        {counts.map(column => {
          const columnOrders = orders.filter(order => column.statuses.includes(order.status));
          return <section key={column.id} className={`merchant-order-column merchant-order-column-${column.id} ${mobileColumn === column.id ? 'is-mobile-active' : ''}`} aria-label={`${column.label} orders`}><header><h3>{column.label}</h3><span>{column.count}</span></header>{columnOrders.length ? columnOrders.map(order => <div key={order.bookingId}>{renderOrder(order)}</div>) : <p className="merchant-order-column-empty">No {column.label.toLowerCase()} orders</p>}</section>;
        })}
      </div>
    </div>
  );
}
