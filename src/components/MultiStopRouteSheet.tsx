import { Layers, Route, MapPin, Navigation, CheckCircle2, Clock } from 'lucide-react';
import type { Booking } from '../types';

interface MultiStopRouteSheetProps {
  jobs: Booking[];
  activeJobId: string;
  onSelectJob: (jobId: string) => void;
}

interface DeliveryStop {
  id: string;
  jobId: string;
  serviceType: Booking['serviceType'];
  type: 'pickup' | 'drop';
  title: string;
  address: string;
  status: 'completed' | 'active' | 'upcoming';
  customerName: string;
}

export default function MultiStopRouteSheet({ jobs, activeJobId, onSelectJob }: MultiStopRouteSheetProps) {
  if (jobs.length === 0) return null;

  const totalPayout = jobs.reduce((sum, b) => sum + (b.driverPayout ?? 0), 0);
  const isBatched = jobs.length > 1;

  // Build the chronological multi-stop list
  const stops: DeliveryStop[] = [];

  jobs.forEach(job => {
    // 1. Pickup stop
    const pickupDone = ['transit', 'arrived_at_destination', 'delivered', 'completed'].includes(job.status);
    const pickupActive = ['accepted', 'preparing', 'ready'].includes(job.status);
    
    stops.push({
      id: `${job.bookingId}-pickup`,
      jobId: job.bookingId,
      serviceType: job.serviceType,
      type: 'pickup',
      title: job.serviceType === 'food' 
        ? (job.details?.restaurantName || 'Restaurant Pickup') 
        : job.serviceType === 'grocery' 
        ? 'Grocery Store' 
        : 'Sender Pickup',
      address: job.pickupAddress || 'Pickup address not specified',
      status: pickupDone ? 'completed' : pickupActive ? 'active' : 'upcoming',
      customerName: job.customerName || 'Customer'
    });

    // 2. Drop-off stop
    const dropDone = ['delivered', 'completed'].includes(job.status);
    const dropActive = job.status === 'transit' || job.status === 'arrived_at_destination';

    stops.push({
      id: `${job.bookingId}-drop`,
      jobId: job.bookingId,
      serviceType: job.serviceType,
      type: 'drop',
      title: `Deliver to ${job.customerName || 'Customer'}`,
      address: job.dropAddress || 'Delivery destination not specified',
      status: dropDone ? 'completed' : dropActive ? 'active' : 'upcoming',
      customerName: job.customerName || 'Customer'
    });
  });

  // Sort stops: completed first, then active pickups, then active drops, then upcoming
  const statusWeight = (s: DeliveryStop['status']) => (s === 'completed' ? 0 : s === 'active' ? 1 : 2);
  stops.sort((a, b) => {
    const sw = statusWeight(a.status) - statusWeight(b.status);
    if (sw !== 0) return sw;
    if (a.type === 'pickup' && b.type === 'drop') return -1;
    if (a.type === 'drop' && b.type === 'pickup') return 1;
    return 0;
  });

  return (
    <section className="space-y-3" aria-label="Delivery route and batched orders" data-section="multi-stop-route" data-screen="multi-stop-route-sheet">
      {/* 1. BATCHED / STACKED ORDERS BANNER (D29) */}
      {isBatched && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 to-purple-50/90 p-3.5 shadow-xs" data-screen="batched-orders-run">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <Layers className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Batched Orders Run</h3>
                <p className="text-[10px] text-slate-500">
                  {jobs.length} active delivery jobs batched for this trip
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total batch pay</span>
              <p className="text-sm font-black text-emerald-600">₹{Math.round(totalPayout)}</p>
            </div>
          </div>

          {/* Stacked Orders Selector Tabs */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Select active batch order">
            {jobs.map((job, idx) => {
              const isSelected = job.bookingId === activeJobId;
              return (
                <button
                  key={job.bookingId}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectJob(job.bookingId)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-white font-bold text-indigo-950 shadow-sm ring-1 ring-indigo-500/30'
                      : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold uppercase text-[10px] text-indigo-700">{job.serviceType}</span>
                      <span className="text-slate-400">·</span>
                      <span className="truncate max-w-[100px]">{job.customerName || 'Customer'}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono capitalize">{job.status.replace(/_/g, ' ')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. MULTI-STOP ROUTE SEQUENCE (D28) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-purple-600" aria-hidden="true" />
            <h3 className="text-xs font-bold text-slate-900">Multi-Stop Delivery Route</h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500">
            {stops.filter(s => s.status === 'completed').length} / {stops.length} stops complete
          </span>
        </div>

        <ol className="mt-3 space-y-3" aria-label="Route itinerary stops">
          {stops.map((stop, index) => {
            const isCurrentJob = stop.jobId === activeJobId;
            return (
              <li key={stop.id} className="relative flex items-start gap-3">
                {/* Connecting line between stops */}
                {index < stops.length - 1 && (
                  <span 
                    className="absolute left-3.5 top-7 -bottom-3.5 w-0.5 bg-slate-200" 
                    aria-hidden="true"
                  />
                )}

                {/* Stop Indicator Icon */}
                <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  stop.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : stop.status === 'active'
                    ? 'bg-purple-600 text-white ring-4 ring-purple-100'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {stop.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Stop Details */}
                <div className={`flex-1 min-w-0 rounded-xl border p-2.5 text-xs transition-colors ${
                  isCurrentJob 
                    ? 'border-purple-200 bg-purple-50/30' 
                    : 'border-slate-100 bg-slate-50/50'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      stop.type === 'pickup'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {stop.type === 'pickup' ? 'Pickup' : 'Drop-off'}
                    </span>

                    <span className={`text-[10px] font-semibold ${
                      stop.status === 'completed'
                        ? 'text-emerald-700'
                        : stop.status === 'active'
                        ? 'text-purple-700 font-bold'
                        : 'text-slate-400'
                    }`}>
                      {stop.status === 'completed' ? 'Completed' : stop.status === 'active' ? 'Next stop' : 'Pending'}
                    </span>
                  </div>

                  <p className="mt-1 font-bold text-slate-900 truncate">{stop.title}</p>
                  
                  <div className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" aria-hidden="true" />
                    <span className="line-clamp-2">{stop.address}</span>
                  </div>

                  {/* Actions for this stop */}
                  <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-100">
                    {stop.address && stop.status !== 'completed' ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-700 border border-slate-200 shadow-2xs hover:bg-slate-50"
                      >
                        <Navigation className="h-3 w-3 text-purple-600" aria-hidden="true" />
                        <span>Navigate</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400">Stop completed</span>
                    )}

                    {!isCurrentJob && (
                      <button
                        type="button"
                        onClick={() => onSelectJob(stop.jobId)}
                        className="text-[10px] font-semibold text-purple-700 hover:underline"
                      >
                        Switch to order
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
