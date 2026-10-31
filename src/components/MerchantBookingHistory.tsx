import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, PackageCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { Booking } from '../types';
import { listMerchantBookingHistory } from '../data/firestoreHelper';

interface MerchantBookingHistoryProps {
  merchantId: string;
}

export default function MerchantBookingHistory({ merchantId }: MerchantBookingHistoryProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchBookingId, setSearchBookingId] = useState('');
  
  // Pagination cursors: stack of previous cursors to allow back-navigation
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchHistory = useCallback(async (targetCursor?: string) => {
    if (!merchantId) return;
    setLoading(true);
    setError('');
    try {
      const res = await listMerchantBookingHistory({
        merchantId,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
        endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
        bookingId: searchBookingId.trim() || undefined,
        cursor: targetCursor
      });
      setBookings(res.bookings || []);
      setNextCursor(res.nextCursor || null);
      setHasMore(Boolean(res.hasMore));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order history.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [merchantId, statusFilter, startDate, endDate, searchBookingId]);

  // Initial load and filter change
  useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
    setCurrentPage(1);
    void fetchHistory(undefined);
  }, [fetchHistory]);

  const handleNextPage = () => {
    if (!nextCursor || !hasMore) return;
    setCursorHistory(prev => (cursor ? [...prev, cursor] : [...prev, '']));
    setCursor(nextCursor);
    setCurrentPage(prev => prev + 1);
    void fetchHistory(nextCursor);
  };

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return;
    const prevCursor = cursorHistory[cursorHistory.length - 1];
    setCursorHistory(prev => prev.slice(0, -1));
    const target = prevCursor === '' ? undefined : prevCursor;
    setCursor(target);
    setCurrentPage(prev => Math.max(1, prev - 1));
    void fetchHistory(target);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCursor(undefined);
    setCursorHistory([]);
    setCurrentPage(1);
    void fetchHistory(undefined);
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchBookingId('');
    setCursor(undefined);
    setCursorHistory([]);
    setCurrentPage(1);
  };

  return (
    <section className="space-y-4" data-panel="merchant-history" aria-label="Order History">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Order History</h2>
          <p className="text-[11px] text-slate-400">Search past orders, filter by status and date, and inspect past fulfillments.</p>
        </div>
        <button
          type="button"
          onClick={() => fetchHistory(cursor)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search exact booking ID (e.g. bk_123)..."
              value={searchBookingId}
              onChange={e => setSearchBookingId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              aria-label="Search booking ID"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-700/60">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="ready">Ready</option>
              <option value="preparing">Preparing</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              aria-label="Start date"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              aria-label="End date"
            />
          </div>
        </div>

        {(statusFilter !== 'all' || startDate || endDate || searchBookingId) && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bookings List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
          <p>Loading order history...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-800">
          <PackageCheck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-semibold">No orders found</p>
          <p className="text-[11px] text-slate-500 mt-1">Try adjusting your filters or date range.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {bookings.map(order => (
            <div
              key={order.bookingId}
              className="bg-slate-800 border border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:border-slate-600 transition"
              data-booking-history-id={order.bookingId}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">{order.bookingId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    order.status === 'completed' || order.status === 'delivered'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : order.status === 'cancelled'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {order.status}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    {order.serviceType}
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  <span>Customer: <strong className="text-white">{order.customerName || 'Anonymous'}</strong></span>
                  {order.cancellationReason && (
                    <span className="text-rose-400 ml-2">Reason: {order.cancellationReason}</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  {new Date(order.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>

              <div className="text-right sm:text-right shrink-0">
                <p className="text-sm font-extrabold text-white">₹{order.price || 0}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  {order.paymentStatus || 'unpaid'}
                </p>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-800 px-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Page {currentPage} {bookings.length > 0 && `(${bookings.length} orders shown)`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 transition"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!hasMore || !nextCursor || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 transition"
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
