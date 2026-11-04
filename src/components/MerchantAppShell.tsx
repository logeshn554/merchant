import type { SellerVertical } from '../domain/merchant';
import { useEffect, useState, type ReactNode } from 'react';
import { Bell, ChevronDown, Circle, LogOut, Moon, Sun } from 'lucide-react';
import { nativeSignOut } from '../nativeNotifications';
import { MERCHANT_PRIMARY_NAV, type MerchantPanel, isMerchantPanelActive } from './merchantNavigation';

interface OutletOption { id: string; merchantType: SellerVertical; name: string; address?: string; }
interface MerchantAppShellProps {
  children: ReactNode;
  panel: MerchantPanel;
  onPanelChange: (panel: MerchantPanel) => void;
  outlet: OutletOption;
  outlets: readonly OutletOption[];
  selectedOutlet: string;
  onOutletChange: (value: string) => void;
  userId: string;
  online: boolean;
  connected: boolean;
  pendingOrders: number;
  permissions?: readonly string[];
}

export default function MerchantAppShell({ children, panel, onPanelChange, outlet, outlets, selectedOutlet, onOutletChange, userId, online, connected, pendingOrders, permissions = [] }: MerchantAppShellProps) {
  const [darkMode, setDarkMode] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark');
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'; }, [darkMode]);
  const navigate = (id: MerchantPanel) => onPanelChange(id === 'settlements' ? 'settlements' : id);
  const primaryItems = MERCHANT_PRIMARY_NAV.filter(item => !item.permission || permissions.includes(item.permission));

  return (
    <div className="allgo-merchant-shell">
      <aside className="merchant-sidebar" aria-label="Merchant navigation">
        <div className="merchant-sidebar-brand"><span className="merchant-brand-mark">A</span><span>AllGo <small>Merchant</small></span></div>
        <nav className="merchant-sidebar-nav">
          {primaryItems.map(item => {
            const Icon = item.icon;
            const active = isMerchantPanelActive(panel, item.id);
            return <button key={item.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon aria-hidden="true" /><span>{item.label}</span>{item.id === 'orders' && pendingOrders > 0 && <b>{pendingOrders}</b>}</button>;
          })}
        </nav>
        <div className="merchant-sidebar-footer"><span className="merchant-connection"><Circle aria-hidden="true" className={connected ? 'is-connected' : 'is-disconnected'} />{connected ? 'Connected' : 'Reconnecting'}</span><small>Account {userId.slice(0, 8)}…</small></div>
      </aside>

      <div className="merchant-shell-main">
        <header className="merchant-app-header">
          <div className="merchant-outlet-heading">
            <div className="merchant-outlet-avatar" aria-hidden="true">{outlet.name.slice(0, 1).toUpperCase()}</div>
            <label><span>Outlet</span><select aria-label="Business location" value={selectedOutlet} onChange={event => onOutletChange(event.target.value)}>{outlets.map(option => <option key={`${option.merchantType}:${option.id}`} value={`${option.merchantType}:${option.id}`}>{option.name}</option>)}</select></label>
            <ChevronDown aria-hidden="true" className="merchant-outlet-chevron" />
          </div>
          <div className="merchant-header-actions">
            <span className={`merchant-online-status ${online ? 'is-online' : 'is-offline'}`}><span aria-hidden="true" />{online ? 'Online' : 'Offline'}</span>
            <span className="merchant-header-connection" title={connected ? 'Live connection' : 'Reconnecting'}><Circle aria-hidden="true" className={connected ? 'is-connected' : 'is-disconnected'} />{connected ? 'Live' : 'Offline'}</span>
            <button type="button" className="merchant-header-icon" aria-label="Notifications"><Bell aria-hidden="true" />{pendingOrders > 0 && <b>{pendingOrders}</b>}</button>
            <button type="button" className="merchant-header-icon" aria-label={darkMode ? 'Use light theme' : 'Use dark theme'} onClick={() => setDarkMode(value => !value)}>{darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button>
            <button type="button" className="merchant-header-icon" aria-label="Sign out" onClick={() => void nativeSignOut()}><LogOut aria-hidden="true" /></button>
          </div>
        </header>
        <main className="merchant-shell-content">{children}</main>
        <nav className="role-navigation merchant-bottom-navigation" aria-label="Merchant navigation">
          {primaryItems.slice(0, 5).map(item => { const Icon = item.icon; const active = isMerchantPanelActive(panel, item.id); return <button key={item.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon aria-hidden="true" /><span>{item.label}</span>{item.id === 'orders' && pendingOrders > 0 && <b className="allgo-navigation-badge">{pendingOrders}</b>}</button>; })}
        </nav>
      </div>
    </div>
  );
}
