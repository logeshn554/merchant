import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingBag, CheckCircle2, Clock, Store, Utensils, DollarSign, LifeBuoy,
  PackageCheck, Bike, ChevronRight, Star, Ticket, History, MessageSquare,
  BarChart3, TrendingUp, Settings, Award, MoreHorizontal
} from 'lucide-react';
import { Booking, MenuItem, GroceryProduct } from '../types';
import { formatRupees } from '../utils/moneyFormatter';

import { playOrderChime, startRepeatingAlert, stopRepeatingAlert } from '../utils/merchantAlertChime';

import MerchantHoursEditor from './MerchantHoursEditor';
import MerchantSettlements from './MerchantSettlements';
import BookingNotificationNotice from './BookingNotificationNotice';
import { useBookingNotification } from '../app/useBookingNotification';
import { finishedBooking } from '../app/bookingNotification';
import MerchantClosuresEditor from './MerchantClosuresEditor';
import MerchantCapacityEditor from './MerchantCapacityEditor';
import MerchantCatalogEditor from './MerchantCatalogEditor';
import MerchantThermalPrint, { MerchantPrinterSettings } from './MerchantThermalPrint';
import MerchantStaffManager from './MerchantStaffManager';
import MerchantSupport from './MerchantSupport';
import MerchantReviews from './MerchantReviews';
import MerchantBusinessProfileEditor from './MerchantBusinessProfileEditor';
import PartnerEvidencePanel from './PartnerEvidencePanel';
import MerchantPreparationEditor from './MerchantPreparationEditor';
import BookingExceptionPanel from './BookingExceptionPanel';
import MerchantRejection from './MerchantRejection';
import MerchantOrderPriceBreakdown from './MerchantOrderPriceBreakdown';
import MerchantOffersPanel from './MerchantOffersPanel';
import MerchantStorefrontPreview from './MerchantStorefrontPreview';
import GroceryPickingEditor from './GroceryPickingEditor';
import MerchantOrderCountdown from './MerchantOrderCountdown';
import MerchantPauseControl from './MerchantPauseControl';
import MerchantBookingHistory from './MerchantBookingHistory';
import MerchantCancelAfterAccept from './MerchantCancelAfterAccept';
import MerchantItemRemover from './MerchantItemRemover';
import MerchantOrderChat from './MerchantOrderChat';
import MaskedCallButton from './MaskedCallButton';
import MerchantAppShell from './MerchantAppShell';
import { type MerchantPanel } from './merchantNavigation';
import { isGroceryOrderFullyPicked } from '../design-system/groceryTracking';
import { 
  advanceMerchantBooking,
  confirmMerchantPickup,
  listenToMenuItems, 
  listenToGroceryProducts, 
  updateMerchantCatalog,
  listMerchantBusinesses,
  listenToMerchantHours,
  setMerchantPause,
  listenToMerchantTodaySummary,
  getMerchantDailySummary,
  listenToMerchantScorecard,
  type MerchantBusinessSummary
} from '../data/firestoreHelper';

export type { MerchantPanel } from './merchantNavigation';

interface MerchantPortalProps {
  activeBookings: Booking[];
  userId: string;
  merchantId?: string;
  merchantType?: 'restaurant' | 'grocery';
}

export default function MerchantPortal({ activeBookings, userId, merchantId, merchantType }: MerchantPortalProps) {
  const [panel, setPanel] = useState<MerchantPanel>('orders');
  const [activeMenu, setActiveMenu] = useState<MenuItem[]>([]);
  const [activeStock, setActiveStock] = useState<GroceryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyOrders, setBusyOrders] = useState<Record<string, boolean>>({});
  const [selectedPrepTimes, setSelectedPrepTimes] = useState<Record<string, number>>({});
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  const isOrderBusy = (id: string) => Boolean(busyOrders[id]);
  const [businesses, setBusinesses] = useState<MerchantBusinessSummary[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState(merchantId && merchantType ? `${merchantType}:${merchantId}` : '');
  const outletOptions = businesses.length ? businesses : merchantId && merchantType ? [{ id: merchantId, merchantType, name: merchantId, address: '', acceptingOrders: false }] : [];
  const activeOutlet = outletOptions.find(outlet => `${outlet.merchantType}:${outlet.id}` === selectedOutlet) || outletOptions[0];
  const activeMerchantId = activeOutlet?.id;
  const activeMerchantType = activeOutlet?.merchantType;
  const activePermissions = activeOutlet?.permissions || ['orders', 'catalog', 'business'];
  const canManageOrders = activePermissions.includes('orders');
  const canManageCatalog = activePermissions.includes('catalog');
  const canManageBusiness = activePermissions.includes('business');
  const canManageSettlements = !activeOutlet?.permissions;

  useEffect(() => {
    let active = true;
    void listMerchantBusinesses().then(value => { if (active) { setBusinesses(value); setError(''); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Business locations could not be loaded.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (activeOutlet && `${activeOutlet.merchantType}:${activeOutlet.id}` !== selectedOutlet) setSelectedOutlet(`${activeOutlet.merchantType}:${activeOutlet.id}`);
  }, [activeOutlet?.id, activeOutlet?.merchantType, selectedOutlet]);
  useEffect(() => { setPanel('orders'); }, [selectedOutlet]);

  // Sync outlet pause status and business hours in real-time
  useEffect(() => {
    if (!activeMerchantId || !activeMerchantType) return;
    return listenToMerchantHours(activeMerchantId, activeMerchantType, outletData => {
      setBusinesses(prev => prev.map(b => {
        if (b.id === activeMerchantId && b.merchantType === activeMerchantType) {
          return {
            ...b,
            acceptingOrders: outletData.acceptingOrders !== false,
            pausedUntil: outletData.pausedUntil ?? null,
            pausedAt: outletData.pausedAt ?? null,
            pausedReason: outletData.pausedReason ?? null
          };
        }
        return b;
      }));
    }, () => {});
  }, [activeMerchantId, activeMerchantType]);

  // Sync catalog dynamically from Firestore in real-time
  useEffect(() => {
    setActiveMenu([]); setActiveStock([]); setLoading(Boolean(activeMerchantId));
    setError('');
    if (!activeMerchantId || !activeMerchantType || !canManageCatalog) return;
    const failed = () => { setError('Your catalog could not be loaded. Check the business assignment and connection.'); setLoading(false); };
    return activeMerchantType === 'restaurant'
      ? listenToMenuItems(activeMerchantId, items => { setActiveMenu(items.sort((a, b) => a.name.localeCompare(b.name))); setLoading(false); }, failed)
      : listenToGroceryProducts(activeMerchantId, items => { setActiveStock(items.sort((a, b) => a.name.localeCompare(b.name))); setLoading(false); }, failed);
  }, [activeMerchantId, activeMerchantType, canManageCatalog]);

  // Filter relevant orders
  const notification = useBookingNotification(activeBookings, { audience: 'merchant', merchantId: activeMerchantId, merchantType: activeMerchantType });
  useEffect(() => { if (notification.booking) setPanel('orders'); }, [notification.booking?.bookingId]);
  const merchantBookings = activeBookings.filter(b => b.merchantId === activeMerchantId && (activeMerchantType === 'restaurant' ? b.serviceType === 'food' : b.serviceType === 'grocery'));
  const foodOrders = merchantBookings.filter(b => b.serviceType === 'food' && !['completed', 'delivered', 'cancelled'].includes(b.status));
  const groceryOrders = merchantBookings.filter(b => b.serviceType === 'grocery' && !['completed', 'delivered', 'cancelled'].includes(b.status));
  const displayedOrders = (activeMerchantType === 'restaurant' ? foodOrders : groceryOrders).filter(booking => !notification.booking || finishedBooking(notification.booking) || booking.bookingId === notification.booking.bookingId);

  // Repeating audio notification for incoming unaccepted orders
  useEffect(() => {
    const currentOrders = activeMerchantType === 'restaurant' ? foodOrders : groceryOrders;
    const hasPending = currentOrders.some(o => o.status === 'pending');
    if (hasPending) {
      startRepeatingAlert();
    } else {
      stopRepeatingAlert();
    }
    return () => {
      stopRepeatingAlert();
    };
  }, [foodOrders, groceryOrders, activeMerchantType]);

  // Daily Summary (Server-aggregated bounded data)
  const [dailySummary, setDailySummary] = useState<{ completedToday: number; grossRevenueToday: number }>({
    completedToday: 0,
    grossRevenueToday: 0
  });

  useEffect(() => {
    if (!activeMerchantId) return;
    return listenToMerchantTodaySummary(activeMerchantId, summary => {
      setDailySummary(summary);
    }, () => {
      void getMerchantDailySummary(activeMerchantId).then(setDailySummary).catch(() => {});
    });
  }, [activeMerchantId]);

  const grossRevenueToday = dailySummary.grossRevenueToday;
  const completedToday = dailySummary.completedToday;
  const avgOrderValue = completedToday > 0 ? Math.round(grossRevenueToday / completedToday) : 0;

  // Merchant Scorecard (WP6)
  const [scorecard, setScorecard] = useState<{ missedOrders?: number; cancelledAfterAccept?: number; itemRemovals?: number }>({
    missedOrders: 0,
    cancelledAfterAccept: 0,
    itemRemovals: 0
  });

  useEffect(() => {
    if (!activeMerchantId) return;
    return listenToMerchantScorecard(activeMerchantId, data => {
      setScorecard(data);
    }, () => {});
  }, [activeMerchantId]);

  // Top-selling items aggregation
  const topSellingItems = useMemo(() => {
    const counts = new Map<string, { name: string; category: string; price: number; unitsSold: number; totalRevenue: number }>();
    merchantBookings.forEach(b => {
      b.details?.items?.forEach((it: { name: string; category?: string; price?: number; quantity?: number; removed?: boolean }) => {
        if (!it.removed) {
          const key = it.name;
          const current = counts.get(key) || { 
            name: it.name, 
            category: it.category || (activeMerchantType === 'restaurant' ? 'Dishes' : 'Groceries'), 
            price: it.price || 0, 
            unitsSold: 0, 
            totalRevenue: 0 
          };
          const qty = it.quantity || 1;
          current.unitsSold += qty;
          current.totalRevenue += (it.price || 0) * qty;
          counts.set(key, current);
        }
      });
    });

    return Array.from(counts.values()).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
  }, [merchantBookings, activeMenu, activeStock, activeMerchantType]);

  // Weekly order volume and revenue trend (7-day bar chart)
  const weeklyTrendData = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const result = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const isToday = i === 0;
      const dayName = isToday ? 'Today' : dayNames[d.getDay()];
      
      result.push({
        day: dayName,
        date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        orders: isToday ? completedToday : 0,
        revenue: isToday ? grossRevenueToday : 0,
        isToday
      });
    }
    return result;
  }, [completedToday, grossRevenueToday]);

  const maxTrendRevenue = Math.max(100, ...weeklyTrendData.map(d => d.revenue));

  const performAction = async (id: string, action: () => Promise<unknown>) => {
    if (busyOrders[id]) return;
    setBusyOrders(prev => ({ ...prev, [id]: true }));
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The merchant action could not be completed.');
    } finally {
      setBusyOrders(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // State changes triggered from merchant portal
  const handleAcceptMerchantOrder = async (bookingId: string, prepMinutes?: number) => {
    const minutes = prepMinutes ?? selectedPrepTimes[bookingId] ?? 15;
    await performAction(bookingId, () => advanceMerchantBooking(bookingId, 'preparing', minutes));
  };

  const handleMarkOrderReady = async (bookingId: string) => {
    await performAction(bookingId, () => advanceMerchantBooking(bookingId, 'ready'));
  };

  const handleConfirmMerchantPickup = async (bookingId: string) => {
    await performAction(bookingId, () => confirmMerchantPickup(bookingId));
  };

  if (!activeMerchantId || !activeMerchantType) return (
    <section className="p-6">
      <h1 className="text-lg font-bold">Connect your business</h1>
      <p className="mt-3 text-sm">AllGo operations must assign your restaurant or grocery catalog before orders and stock controls can be opened.</p>
    </section>
  );

  // Subtab definition for Orders and History
  const ORDER_TABS = [
    { id: 'orders', label: 'Orders' },
    { id: 'history', label: 'History', Icon: History }
  ] as const;

  // Subtab definition for Insights and Reviews
  const INSIGHTS_TABS = [
    { id: 'insights', label: 'Overview' },
    { id: 'reviews', label: 'Reviews', Icon: Star }
  ] as const;

  // Subtab definition for Catalog, Preview, and Offers
  const CATALOG_TABS = [
    { id: 'catalog', label: 'Catalog Items', allowed: canManageCatalog },
    { id: 'preview', label: 'Preview', allowed: canManageCatalog },
    { id: 'offers', label: 'Offers', allowed: canManageBusiness }
  ] as const;

  // Subtab definition for More panel (Reviews, Offers, Preview, Documents, Support, Business)
  interface MoreTabItem {
    id: MerchantPanel;
    label: string;
    Icon?: React.ComponentType<{ className?: string }>;
    allowed?: boolean;
  }

  const MORE_TABS: readonly MoreTabItem[] = [
    { id: 'business', label: 'Business', allowed: canManageBusiness || true },
    { id: 'reviews', label: 'Reviews', Icon: Star, allowed: canManageOrders },
    { id: 'offers', label: 'Offers', Icon: Ticket, allowed: canManageBusiness },
    { id: 'preview', label: 'Preview', allowed: canManageCatalog },
    { id: 'compliance', label: 'Documents', allowed: true },
    { id: 'support', label: 'Support', Icon: LifeBuoy, allowed: true }
  ];

  return (
    <MerchantAppShell
      panel={panel}
      onPanelChange={setPanel}
      outlet={activeOutlet}
      outlets={outletOptions}
      selectedOutlet={selectedOutlet}
      onOutletChange={setSelectedOutlet}
      userId={userId}
      online={activeOutlet.acceptingOrders !== false}
      connected={!error}
      pendingOrders={(activeMerchantType === 'restaurant' ? foodOrders : groceryOrders).filter(order => order.status === 'pending').length}
    >
      {/* role-navigation / Merchant navigation is rendered by MerchantAppShell. */}
      <div className="allgo-merchant bg-slate-900 text-slate-100 h-full flex flex-col font-sans">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <header className="allgo-heading">
          <div>
            <h1>
              {{
                orders: 'Manage orders',
                history: 'Order history & archive',
                catalog: 'Catalog & inventory',
                preview: 'Storefront preview',
                offers: 'Offers & discounts',
                stock: 'Stock movement journal',
                insights: 'Business insights',
                overview: 'Business insights',
                reviews: 'Customer ratings & feedback',
                settlements: 'Settlements & payouts',
                settings: 'Business settings',
                more: 'Business settings & more',
                business: 'Business settings',
                support: 'Partner support',
                compliance: 'Compliance & documents'
              }[panel] || 'Merchant Hub'}
            </h1>
            <p>
              {panel === 'orders' ? 'Prepare paid orders and keep customers updated.' :
               panel === 'history' ? 'Inspect past orders, search by ID, and filter by status and date.' :
               panel === 'catalog' ? 'Add, edit and manage availability for your dishes and products.' :
               panel === 'preview' ? 'Preview your customer-facing storefront and current catalog.' :
               panel === 'offers' ? 'Create and disable store-specific discounts with redemption limits.' :
               panel === 'stock' ? 'Recorded movements since journaling was enabled.' :
               panel === 'insights' || panel === 'overview' ? 'Real-time sales performance, volume trends, and reliability scorecard.' :
               panel === 'reviews' ? 'Read ratings and feedback left for completed orders.' :
               panel === 'settlements' ? 'View completed booking values and settlement availability.' :
               panel === 'settings' || panel === 'business' ? 'Manage opening hours, preparation capacity, and staff permissions.' :
               panel === 'support' ? 'Contact AllGo and follow replies to your support cases.' :
               panel === 'compliance' ? 'Review private business documents and resolve outstanding compliance requests.' :
               'Your live store operations at a glance.'}
            </p>
          </div>
        </header>

        <BookingNotificationNotice {...notification} onDismiss={notification.dismiss}/>
        <div className="merchant-overview">
          <strong>{activeOutlet?.name} · {activeMerchantType === 'restaurant' ? 'Restaurant operations' : 'Grocery operations'}</strong>
          {canManageOrders && <span>{(activeMerchantType === 'restaurant' ? foodOrders : groceryOrders).length} active orders · {completedToday} completed today</span>}
        </div>

        {activeOutlet && (
          <MerchantPauseControl
            outlet={activeOutlet}
            canManageOrders={canManageOrders}
            onSetPause={setMerchantPause}
            onPauseChanged={updated => {
              setBusinesses(prev => prev.map(b => b.id === activeOutlet.id && b.merchantType === activeOutlet.merchantType ? { ...b, ...updated } : b));
            }}
          />
        )}

        {error && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{error}</p>}

        {/* =========================================================================
            TAB 1: ORDERS PANEL (Incoming Orders Queue & Order History)
           ========================================================================= */}
        {canManageOrders && panel === 'orders' && (
          <div className="space-y-3" data-screen="merchant-orders">
            <div className="flex justify-between items-center">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                Incoming Orders ({displayedOrders.length})
              </h3>
              <button
                type="button"
                onClick={() => setPanel('history')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                data-testid="view-history-btn"
              >
                <History className="w-3.5 h-3.5" />
                <span>Order History</span>
              </button>
            </div>

            {displayedOrders.length === 0 ? (
              <div className="text-center py-10 bg-slate-800/40 rounded-xl border border-slate-800">
                <PackageCheck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-semibold">No active customer orders</p>
                <p className="text-xs text-slate-300 mt-1">Paid orders assigned to this business will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedOrders.map(ord => (
                  <div id={`merchant-order-print-${ord.bookingId}`} key={ord.bookingId} data-booking-print-id={ord.bookingId} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                    <BookingExceptionPanel booking={ord}/>
                    {ord.status === 'pending' && <MerchantOrderCountdown createdAt={ord.createdAt} serviceType={ord.serviceType} status={ord.status}/>}
                    {ord.status === 'pending' && !ord.driverId && ['paid', 'pending_cod'].includes(ord.paymentStatus || '') && <MerchantRejection bookingId={ord.bookingId} cashOnDelivery={ord.paymentStatus === 'pending_cod'}/>}
                    <MerchantPreparationEditor booking={ord}/>
                    <div className="flex justify-between items-start pb-2 border-b border-slate-700">
                      <div>
                        <span className="text-[10px] font-bold text-blue-400 font-mono">{ord.bookingId}</span>
                        <h4 className="text-xs font-bold text-white mt-0.5">Client: {ord.customerName}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-white">₹{ord.price}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-bold">{ord.status}</p>
                      </div>
                    </div>

                    {/* Customer & Partner Communication Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-slate-700/60 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setChatBooking(ord)}
                          data-testid={`merchant-open-chat-${ord.bookingId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                        <MaskedCallButton bookingId={ord.bookingId} recipientRole="customer" recipientName={ord.customerName} />
                        {ord.driverId && (
                          <MaskedCallButton bookingId={ord.bookingId} recipientRole="driver" recipientName={ord.driverName} />
                        )}
                      </div>
                    </div>

                    <MerchantThermalPrint booking={ord}/>

                    {/* Order items nested list */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {ord.details?.items?.map((it: { name: string; price: number; quantity: number; removed?: boolean; variantName?: string; addOns?: { id: string; name: string }[] }, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1 py-1 border-b border-slate-800/60 last:border-0">
                          <div className="flex justify-between items-start">
                            <span>
                              {it.removed ? (
                                <span className="text-rose-400 line-through">{it.name} (Removed)</span>
                              ) : (
                                <span>{it.name}{it.variantName && <span className="text-slate-400"> · {it.variantName}</span>}{it.addOns?.map((addOn: { id: string; name: string }) => <span key={addOn.id} className="block pl-2 text-slate-400">+ {addOn.name}</span>)} <span className="text-slate-400">× {it.quantity}</span></span>
                              )}
                            </span>
                            <span>{it.removed ? '₹0' : `₹${it.price * it.quantity}`}</span>
                          </div>
                          <MerchantItemRemover
                            bookingId={ord.bookingId}
                            itemIndex={idx}
                            item={it}
                            canRemove={canManageOrders && ['preparing', 'ready'].includes(ord.status)}
                          />
                        </div>
                      ))}
                    </div>
                    <MerchantOrderPriceBreakdown breakdown={ord.priceBreakdown}/>

                    {/* Actions depending on state */}
                    <GroceryPickingEditor booking={ord} products={activeStock}/>
                    <div className="pt-2 border-t border-slate-700/50 flex flex-col gap-2">
                      {ord.status === 'pending' && (
                        <div className="space-y-2 pt-1" data-testid={`accept-panel-${ord.bookingId}`}>
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span className="font-semibold text-slate-400">Preparation estimate:</span>
                            <span className="font-bold text-amber-400">{selectedPrepTimes[ord.bookingId] || 15} mins</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Preset preparation minutes">
                            {[10, 15, 20, 30, 45].map(mins => (
                              <button
                                key={mins}
                                type="button"
                                data-testid={`prep-chip-${mins}`}
                                disabled={isOrderBusy(ord.bookingId)}
                                onClick={() => setSelectedPrepTimes(prev => ({ ...prev, [ord.bookingId]: mins }))}
                                className={`py-1.5 px-1 rounded text-xs font-bold transition-colors ${
                                  (selectedPrepTimes[ord.bookingId] || 15) === mins
                                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                }`}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>
                          <button 
                            disabled={isOrderBusy(ord.bookingId)}
                            onClick={() => handleAcceptMerchantOrder(ord.bookingId, selectedPrepTimes[ord.bookingId] || 15)}
                            className="merchant-order-action w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm py-2 rounded-lg transition-colors"
                          >
                            {isOrderBusy(ord.bookingId) ? 'Accepting…' : `Accept & Start Preparation (${selectedPrepTimes[ord.bookingId] || 15}m)`}
                          </button>
                        </div>
                      )}

                      {ord.status === 'preparing' && !ord.driverId && (
                        <div className="space-y-1">
                          <button 
                            disabled={isOrderBusy(ord.bookingId) || ord.exception?.status === 'open' || (ord.serviceType === 'grocery' && !isGroceryOrderFullyPicked(ord))}
                            onClick={() => handleMarkOrderReady(ord.bookingId)}
                            className="merchant-order-action w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-2 rounded-lg"
                          >
                            Mark Ready for Delivery Pickup
                          </button>
                          {ord.serviceType === 'grocery' && !isGroceryOrderFullyPicked(ord) && (
                            <p className="text-[10px] text-amber-400 font-medium text-center">
                              {Object.values(ord.picking?.substitutions || {}).some(s => s.status === 'pending')
                                ? 'Waiting for customer decision on pending substitution.'
                                : 'Confirm all packed items in the packing editor before marking ready.'}
                            </p>
                          )}
                        </div>
                      )}

                      {ord.status === 'ready' && !ord.driverId && (
                        <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 py-2.5 px-3 text-center text-xs text-amber-300 font-medium">
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                          <span>Order ready. Searching for nearby delivery partner...</span>
                        </div>
                      )}

                      {(ord.status === 'accepted' || (ord.status === 'ready' && Boolean(ord.driverId))) && (
                        <div className="flex items-center justify-between rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-300">
                          <div className="flex items-center gap-2">
                            <Bike className="w-4 h-4 text-blue-400" />
                            <div>
                              <p className="font-bold text-white">Rider assigned: {ord.driverName || 'Delivery Partner'}</p>
                              <p className="text-[10px] text-blue-300/80">Heading to your store for collection</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {['preparing', 'ready'].includes(ord.status) && Boolean(ord.driverId) && (
                        <div className="flex items-center justify-between rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-xs text-emerald-300">
                          <div className="flex items-center gap-2">
                            {ord.arrivedAtPickup ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Bike className="w-4 h-4 text-blue-400 shrink-0" />}
                            <div>
                              <p className="font-bold text-white">{ord.arrivedAtPickup ? 'Rider at store' : 'Rider assigned'}: {ord.driverName || 'Delivery Partner'}</p>
                              <p className="text-[10px] text-emerald-300/80">{ord.arrivedAtPickup ? 'Rider has arrived. Hand over the packed order, then confirm the handoff.' : 'The rider is on the way. Handoff confirmation will be available after arrival.'}</p>
                            </div>
                          </div>
                          {Boolean(ord.pickupCode || ord.pickupOtp) && (
                            <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-950/70 border border-emerald-500/40 px-3 py-2 text-xs">
                              <div>
                                <span className="block font-bold text-emerald-200">Handover Pickup Code</span>
                                <span className="text-[10px] text-emerald-400">Share with rider to verify pickup</span>
                              </div>
                              <b className="font-mono text-base font-black tracking-widest text-emerald-300 bg-emerald-900/80 px-2.5 py-1 rounded border border-emerald-500/50">
                                {ord.pickupCode || ord.pickupOtp}
                              </b>
                            </div>
                          )}
                          {ord.arrivedAtPickup && !ord.merchantPickupConfirmedAt ? (
                            <button type="button" disabled={isOrderBusy(ord.bookingId)} onClick={() => void handleConfirmMerchantPickup(ord.bookingId)} className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50">Confirm order handed to rider</button>
                          ) : ord.merchantPickupConfirmedAt ? <p role="status" className="mt-2 text-center text-[10px] font-bold text-emerald-200">Pickup handoff confirmed</p> : null}
                        </div>
                      )}

                      {ord.status === 'transit' && (
                        <div className="flex items-center justify-between rounded-lg bg-slate-700/40 border border-slate-600/50 p-2 text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="w-4 h-4 text-emerald-400" />
                            <span>Collected by {ord.driverName || 'Partner'} · Out for delivery</span>
                          </div>
                        </div>
                      )}

                      {['preparing', 'ready'].includes(ord.status) && canManageOrders && (
                        <div className="pt-2 border-t border-slate-800/80">
                          <MerchantCancelAfterAccept
                            bookingId={ord.bookingId}
                            cashOnDelivery={ord.paymentStatus === 'pending_cod'}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Order History View */}
        {canManageOrders && panel === 'history' && activeMerchantId && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setPanel('orders')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              <span>Back to Active Orders</span>
            </button>
            <MerchantBookingHistory merchantId={activeMerchantId} />
          </div>
        )}

        {/* =========================================================================
            TAB 2: MENU & CATALOG PANEL
           ========================================================================= */}
        {canManageCatalog && (panel === 'catalog' || panel === 'preview' || panel === 'offers' || panel === 'stock') && (
          <section data-panel="catalog" className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              {CATALOG_TABS.filter(t => t.allowed).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPanel(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    panel === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {panel === 'catalog' && (
              loading ? (
                <div className="text-center py-12">
                  <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full inline-block animate-spin mb-2" />
                  <p className="text-xs text-slate-400">Loading catalog items...</p>
                </div>
              ) : (
                <MerchantCatalogEditor
                  id={activeMerchantId}
                  type={activeMerchantType}
                  items={activeMerchantType === 'restaurant' ? activeMenu : activeStock}
                />
              )
            )}

            {panel === 'preview' && activeOutlet && (
              <MerchantStorefrontPreview business={activeOutlet} type={activeMerchantType} items={activeMerchantType === 'restaurant' ? activeMenu : activeStock}/>
            )}

            {panel === 'offers' && canManageBusiness && (
              <MerchantOffersPanel key={`${activeMerchantType}:${activeMerchantId}`} merchantId={activeMerchantId} merchantType={activeMerchantType}/>
            )}
          </section>
        )}

        {/* =========================================================================
            TAB 3: INSIGHTS & PERFORMANCE PANEL
           ========================================================================= */}
        {(panel === 'insights' || panel === 'overview') && (
          <div className="space-y-4" data-screen="merchant-dashboard">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              {INSIGHTS_TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPanel(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    (panel === t.id || (panel === 'overview' && t.id === 'insights'))
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  {t.id === 'reviews' && <Star className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Key Performance Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed booking value today</p>
                <h4 className="text-xl font-black text-emerald-400 mt-1">₹{grossRevenueToday.toLocaleString('en-IN')}</h4>
                <span className="text-[9px] text-slate-400 mt-0.5 block">From today’s completed orders</span>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed today</p>
                <h4 className="text-xl font-black text-white mt-1">{completedToday}</h4>
                <span className="text-[9px] text-slate-400 mt-0.5 block">Confirmed order deliveries</span>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average order value</p>
                <h4 className="text-xl font-black text-indigo-400 mt-1">₹{avgOrderValue.toLocaleString('en-IN')}</h4>
                <span className="text-[9px] text-slate-400 mt-0.5 block">Per completed delivery</span>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Weekly run-rate pace</p>
                <h4 className="text-xl font-black text-amber-400 mt-1">₹{(grossRevenueToday * 7).toLocaleString('en-IN')}</h4>
                <span className="text-[9px] text-slate-400 mt-0.5 block">Projected 7-day revenue</span>
              </div>
            </div>

            {/* 7-Day Revenue & Volume Trend Chart */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3" data-testid="merchant-revenue-trends">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    <span>7-Day Order Volume & Revenue Trend</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Daily delivery performance and earnings distribution</p>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Live Trend
                </span>
              </div>

              <div className="pt-4 pb-1">
                <div className="flex items-end justify-between gap-2 h-36 px-2 border-b border-slate-700/60 pb-2">
                  {weeklyTrendData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[9px] font-mono font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        ₹{d.revenue}
                      </span>
                      <div className="w-full bg-slate-900 rounded-t-md h-24 flex items-end p-0.5 overflow-hidden">
                        <div 
                          className={`w-full rounded-t transition-all duration-500 ${
                            d.isToday 
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-lg shadow-emerald-500/20' 
                              : 'bg-gradient-to-t from-blue-700 to-indigo-500 group-hover:from-blue-600 group-hover:to-indigo-400'
                          }`}
                          style={{ height: `${Math.max(12, Math.min(100, (d.revenue / maxTrendRevenue) * 100))}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <span className={`text-[10px] block font-bold ${d.isToday ? 'text-emerald-400 font-black' : 'text-slate-400'}`}>
                          {d.day}
                        </span>
                        <span className="text-[9px] text-slate-500 block">
                          {d.orders} ord
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top-Selling Items Ranking */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3" data-testid="merchant-top-selling-items">
              <div className="flex justify-between items-center">
                <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Top-Selling Catalog Items</span>
                </h4>
                <span className="text-[10px] text-slate-400">By popularity & revenue</span>
              </div>

              <div className="space-y-2 pt-1">
                {topSellingItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        index === 0 ? 'bg-amber-500 text-slate-950 shadow' :
                        index === 1 ? 'bg-slate-300 text-slate-950' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white">{item.name}</p>
                        <p className="text-[10px] text-slate-400">{item.category} · ₹{item.price}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400">₹{item.totalRevenue.toLocaleString('en-IN')}</span>
                      <p className="text-[10px] text-slate-400">{item.unitsSold} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Store Quality & Reliability Scorecard (WP6) */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-2" data-testid="merchant-scorecard-section">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Store Quality & Reliability Scorecard</span>
                <span className="text-[10px] text-slate-500 font-semibold">Reliability metrics</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Missed Orders</span>
                  <span data-testid="scorecard-missed" className="text-base font-black text-rose-400">{scorecard.missedOrders || 0}</span>
                </div>
                <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Cancelled (After Accept)</span>
                  <span data-testid="scorecard-cancelled" className="text-base font-black text-amber-400">{scorecard.cancelledAfterAccept || 0}</span>
                </div>
                <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Items Removed</span>
                  <span data-testid="scorecard-items-removed" className="text-base font-black text-blue-400">{scorecard.itemRemovals || 0}</span>
                </div>
              </div>
            </div>

            {/* Settlement availability overview */}
            {canManageSettlements && <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-700/50 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Settlement availability</p>
                <h3 className="text-xl font-black text-white mt-0.5">Setup required</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Merchant settlement records are required before payouts.</p>
              </div>
              <button
                onClick={() => setPanel('settlements')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
              >
                <span>View Payouts</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>}

            {!canManageOrders && !canManageCatalog && !canManageBusiness && !canManageSettlements && (
              <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">
                Your account has no permissions for this business location. Contact its owner.
              </p>
            )}
          </div>
        )}

        {/* Customer Reviews subtab */}
        {canManageOrders && panel === 'reviews' && activeMerchantId && activeMerchantType && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setPanel('insights')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              <span>Back to Insights Overview</span>
            </button>
            <MerchantReviews key={`${activeMerchantType}:${activeMerchantId}`} merchantId={activeMerchantId} merchantType={activeMerchantType}/>
          </div>
        )}

        {/* =========================================================================
            TAB 4: SETTLEMENTS & PAYOUTS PANEL
           ========================================================================= */}
        {canManageSettlements && panel === 'settlements' && (
          <MerchantSettlements bookings={activeBookings} merchantId={activeMerchantId} merchantType={activeMerchantType}/>
        )}

        {/* =========================================================================
            TAB 5: SETTINGS & MORE OPERATIONS PANEL
           ========================================================================= */}
        {(panel === 'settings' || panel === 'more' || panel === 'business' || panel === 'support' || panel === 'compliance') && (
          <section data-panel="business" className="space-y-4">
            {/* More subtabs */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-800" data-testid="merchant-more-tabs">
              {MORE_TABS.filter(t => t.allowed !== false).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanel(id as MerchantPanel)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    panel === id || ((panel === 'settings' || panel === 'more') && id === 'business')
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {(panel === 'settings' || panel === 'more' || panel === 'business') && (
              <>
                <h2 className="role-section-title">Business hours & closures</h2>
                {activeOutlet?.canManageStaff && <MerchantBusinessProfileEditor key={activeOutlet.id} business={activeOutlet}/>}
                <MerchantHoursEditor id={activeMerchantId} type={activeMerchantType}/>
                <MerchantClosuresEditor id={activeMerchantId} type={activeMerchantType}/>
                <MerchantCapacityEditor id={activeMerchantId} type={activeMerchantType}/>
                {activeOutlet?.canManageStaff && <MerchantStaffManager merchantId={activeMerchantId} merchantType={activeMerchantType}/>}
                <MerchantPrinterSettings/>
              </>
            )}

            {panel === 'support' && <MerchantSupport userId={userId} activeBookings={merchantBookings}/>}

            {panel === 'compliance' && activeOutlet?.applicationId && (
              <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-4" data-panel="compliance">
                <h2 className="font-bold">Compliance & business documents</h2>
                <p className="text-xs text-slate-400">Private application records, scan status and verified document expiry. Approved records are read-only here.</p>
                <PartnerEvidencePanel applicationId={activeOutlet.applicationId} staff={false} active={activeOutlet.applicationNeedsInformation === true}/>
              </section>
            )}
          </section>
        )}

      </div>

      {chatBooking && (
        <MerchantOrderChat
          booking={chatBooking}
          userId={userId}
          storeName={activeOutlet?.name || 'Store Partner'}
          onClose={() => setChatBooking(null)}
        />
      )}

      </div>
    </MerchantAppShell>
  );
}
