import type { ComponentType, ReactNode } from 'react';
import { ArrowRight, Bell, ChevronRight, UserRound } from 'lucide-react';
import type { UserProfile } from '../types';
import { CatalogImage } from '../design-system/CatalogImage';

export type ProfileAction = {label:string;detail?:string;group?:string;Icon:ComponentType<{size?:number}>;value?:string;onClick:()=>void};

export default function ProfileScreen({profile,name,actions,children,onSignOut}: {profile?:UserProfile|null;name:string;actions:ProfileAction[];children?:ReactNode;onSignOut:()=>void}) {
  const groups = [...new Set(actions.map(action => action.group || 'Your account'))];
  const editAction = actions.find(action => action.label === 'Personal information' || action.label === 'Personal details') || actions[0];
  const needsProfileCompletion = !profile?.email || !profile?.name || profile.name === 'AllGo User' || profile.name === 'Your account';

  return (
    <section className="stitch-profile" data-screen="customer-profile-overview">
      <header className="allgo-heading">
        <div>
          <h1>Your account</h1>
          <p>Manage your deliveries, preferences and details.</p>
        </div>
      </header>

      <div className="stitch-profile-person">
        <CatalogImage src={profile?.photoURL} alt="" className="stitch-profile-avatar" fallback={<UserRound size={32} strokeWidth={1.5}/>}/>
        <div>
          <h2>{name || 'Your AllGo account'}</h2>
          {(profile?.phone || profile?.email) && <p>{profile.phone || profile.email}</p>}
        </div>
      </div>

      {needsProfileCompletion && (
        <aside className="stitch-profile-alert" role="status" aria-label="Profile completion prompt">
          <div className="stitch-profile-alert-icon">
            <Bell size={20} />
          </div>
          <div className="stitch-profile-alert-content">
            <h3>Add your name & email</h3>
            <p>Add your full name and email address to receive order receipts, invoices, and delivery updates.</p>
            {editAction && (
              <button type="button" className="stitch-profile-alert-btn" onClick={editAction.onClick}>
                Add details <ArrowRight size={14} />
              </button>
            )}
          </div>
        </aside>
      )}

      {groups.map(group => (
        <section key={group} aria-label={group}>
          <h2 className="allgo-account-section-title">{group}</h2>
          <div className="stitch-profile-links">
            {actions.filter(action => (action.group || 'Your account') === group).map(({label,detail,Icon,value,onClick}) => (
              <button type="button" key={label} onClick={onClick}>
                <Icon size={20} aria-hidden="true"/>
                <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
                {value && <span className="stitch-profile-value">{value}</span>}
                <ChevronRight size={17} aria-hidden="true"/>
              </button>
            ))}
          </div>
        </section>
      ))}

      {children}
      <button type="button" className="stitch-signout" onClick={onSignOut}>Sign out</button>
    </section>
  );
}

