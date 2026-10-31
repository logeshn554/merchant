import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Shield, Clock } from 'lucide-react';
import { Booking } from '../types';
import { listenToChatMessages, sendChatMessage } from '../data/firestoreHelper';
import MaskedCallButton from './MaskedCallButton';

interface MerchantOrderChatProps {
  booking: Booking;
  userId: string;
  storeName?: string;
  onClose: () => void;
}

export default function MerchantOrderChat({
  booking,
  userId,
  storeName = 'Store Partner',
  onClose
}: MerchantOrderChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return listenToChatMessages(booking.bookingId, msgs => {
      setMessages(msgs);
    });
  }, [booking.bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const cannedReplies = [
    'Order is currently being prepared',
    'Order packed and waiting at pickup counter',
    'Rider, please pick up at counter',
    'Item out of stock, checking alternatives'
  ];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError('');
    try {
      await sendChatMessage(booking.bookingId, userId, storeName, clean);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Order chat for ${booking.bookingId}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full h-[600px] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="bg-slate-950 border-b border-slate-800 p-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Order Chat · #{booking.bookingId.slice(-6)}</h3>
              <p className="text-[10px] text-slate-400">
                Customer: {booking.customerName || 'Customer'}
                {booking.driverName ? ` · Driver: ${booking.driverName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MaskedCallButton bookingId={booking.bookingId} recipientRole="customer" recipientName={booking.customerName} />
            {booking.driverId && (
              <MaskedCallButton bookingId={booking.bookingId} recipientRole="driver" recipientName={booking.driverName} />
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice */}
        <div className="bg-slate-950/60 border-b border-slate-800/80 px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
          <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>Privacy Protected · Messages are logged securely for order fulfillment and dispute resolution.</span>
        </div>

        {/* Message history */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-900/50" data-testid="merchant-chat-messages">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs font-semibold">No messages yet</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                You can chat directly with the customer or assigned delivery partner regarding this order.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isStore = msg.senderRole === 'merchant' || msg.senderId === userId;
              const isDriver = msg.senderRole === 'driver';
              const isCust = msg.senderRole === 'customer';

              return (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${isStore ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isStore
                        ? 'bg-blue-900 text-blue-200'
                        : isDriver
                        ? 'bg-amber-900 text-amber-200'
                        : 'bg-emerald-900 text-emerald-200'
                    }`}>
                      {isStore ? 'Store (You)' : isDriver ? 'Delivery Partner' : 'Customer'}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {msg.senderName}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                      isStore
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : isDriver
                        ? 'bg-slate-800 text-amber-100 border border-amber-500/20 rounded-tl-xs'
                        : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                  <span className="text-[8px] text-slate-500 mt-0.5 px-1 font-mono">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Canned Quick Replies */}
        <div className="bg-slate-950 border-t border-slate-800 px-3 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {cannedReplies.map(reply => (
            <button
              key={reply}
              type="button"
              disabled={busy}
              onClick={() => setText(reply)}
              className="text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 border border-slate-700 transition"
            >
              {reply}
            </button>
          ))}
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="bg-slate-950 border-t border-slate-800 p-2.5 flex gap-2 shrink-0">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a message to customer or partner…"
            disabled={busy}
            maxLength={1000}
            data-testid="merchant-chat-input"
            aria-label="Order chat message input"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            data-testid="merchant-chat-send-btn"
            aria-label="Send message"
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
        {error && <p role="alert" className="text-[10px] text-rose-400 bg-rose-950 px-3 py-1">{error}</p>}
      </div>
    </div>
  );
}
