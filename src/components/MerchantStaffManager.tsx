import React, { useCallback, useEffect, useState } from 'react';
import {
  listMerchantStaff,
  grantMerchantStaffAccess,
  revokeMerchantStaffAccess,
  createMerchantStaffInvite,
  listMerchantStaffInvites,
  cancelMerchantStaffInvite,
  acceptMerchantStaffInvite,
  listMerchantStaffActivity,
  type MerchantStaffMember,
  type MerchantStaffInvite,
  type MerchantStaffActivity,
  type StaffPermission
} from '../data/firestoreHelper';

type Permission = StaffPermission;

const permissionsList: Array<{ id: Permission; label: string; description: string }> = [
  { id: 'orders', label: 'Orders', description: 'View orders, update preparation, and confirm picking.' },
  { id: 'catalog', label: 'Catalog', description: 'Update dish availability and product stock.' },
  { id: 'business', label: 'Business settings', description: 'Manage opening hours and closures.' },
  { id: 'settlements', label: 'Settlements & Payouts', description: 'View weekly payout statements, tax compliance, and invoices.' },
];

export default function MerchantStaffManager({
  merchantId,
  merchantType
}: {
  merchantId: string;
  merchantType: 'restaurant' | 'grocery';
}) {
  const [tab, setTab] = useState<'members' | 'invite' | 'pending' | 'activity' | 'claim'>('members');
  const [members, setMembers] = useState<MerchantStaffMember[]>([]);
  const [invites, setInvites] = useState<MerchantStaffInvite[]>([]);
  const [activities, setActivities] = useState<MerchantStaffActivity[]>([]);

  // Manual Account ID grant state
  const [staffUid, setStaffUid] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(['orders']);
  const [selectedRole, setSelectedRole] = useState<'manager' | 'staff'>('staff');

  // Invite creation state
  const [inviteContactType, setInviteContactType] = useState<'code' | 'phone' | 'email'>('code');
  const [inviteTargetContact, setInviteTargetContact] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [invitePermissions, setInvitePermissions] = useState<Permission[]>(['orders', 'catalog']);
  const [createdInviteResult, setCreatedInviteResult] = useState<{ inviteCode: string; expiresAt: string } | null>(null);

  // Claim invite state
  const [claimCode, setClaimCode] = useState('');
  const [claimSuccess, setClaimSuccess] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [membersData, invitesData, activityData] = await Promise.all([
        listMerchantStaff(merchantId, merchantType).catch(() => []),
        listMerchantStaffInvites(merchantId, merchantType).catch(() => []),
        listMerchantStaffActivity(merchantId, merchantType, 20).catch(() => [])
      ]);
      setMembers(membersData);
      setInvites(invitesData);
      setActivities(activityData);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Staff access could not be loaded. Only the verified business owner can manage staff.');
    } finally {
      setLoading(false);
    }
  }, [merchantId, merchantType]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const togglePermission = (
    permission: Permission,
    selected: Permission[],
    setter: React.Dispatch<React.SetStateAction<Permission[]>>
  ) => {
    setter(current =>
      current.includes(permission)
        ? current.filter(item => item !== permission)
        : [...current, permission]
    );
  };

  const grantDirect = async () => {
    if (busy || !staffUid.trim() || selectedPermissions.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await grantMerchantStaffAccess({
        merchantId,
        merchantType,
        staffUid: staffUid.trim(),
        permissions: selectedPermissions,
        role: selectedRole
      });
      setStaffUid('');
      setNotice('Staff access saved.');
      await refreshAll();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Staff access could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (invitePermissions.length === 0) {
      setError('Please select at least one permission.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    setCreatedInviteResult(null);
    try {
      const res = await createMerchantStaffInvite({
        merchantId,
        merchantType,
        contactType: inviteContactType,
        targetContact: inviteTargetContact.trim() || undefined,
        role: inviteRole,
        permissions: invitePermissions
      });
      setCreatedInviteResult({ inviteCode: res.inviteCode, expiresAt: res.expiresAt });
      setNotice(`Staff invite ${res.inviteCode} created successfully!`);
      setInviteTargetContact('');
      await refreshAll();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to create staff invite.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvite = async (inviteCode: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await cancelMerchantStaffInvite(merchantId, merchantType, inviteCode);
      setNotice(`Invite ${inviteCode} was cancelled.`);
      await refreshAll();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to cancel invite.');
    } finally {
      setBusy(false);
    }
  };

  const handleClaimInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !claimCode.trim()) return;
    setBusy(true);
    setError('');
    setClaimSuccess('');
    try {
      const res = await acceptMerchantStaffInvite(claimCode.trim().toUpperCase());
      setClaimSuccess(`Successfully claimed access to ${res.merchantId} (${res.merchantType}) with role ${res.role}!`);
      setClaimCode('');
      await refreshAll();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to claim staff invite.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (member: MerchantStaffMember) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await revokeMerchantStaffAccess({ merchantId, merchantType, staffUid: member.uid });
      setNotice(`Access removed for ${member.name || member.email || member.uid}.`);
      await refreshAll();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Staff access could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="merchant-staff-heading"
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-slate-100"
      data-panel="staff-permissions"
      data-screen="merchant-staff-manager"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
        <div>
          <h2 id="merchant-staff-heading" className="text-base font-bold text-white">
            Staff and permissions
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Grant access to an existing AllGo merchant account using its account ID or generate invite codes.
          </p>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tab === 'members' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Staff ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('invite')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tab === 'invite' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            + Invite Staff
          </button>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tab === 'pending' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Invites ({invites.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tab === 'activity' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Activity Log
          </button>
          <button
            type="button"
            onClick={() => setTab('claim')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tab === 'claim' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Claim Invite
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded bg-rose-950 p-3 text-sm text-rose-100">{error}</p>}
      {notice && <p role="status" className="rounded bg-emerald-950 p-3 text-sm text-emerald-100">{notice}</p>}
      {claimSuccess && <p role="status" className="rounded bg-emerald-950 p-3 text-sm text-emerald-100">{claimSuccess}</p>}

      {/* TAB 1: MEMBERS LIST & DIRECT GRANT */}
      {tab === 'members' && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Direct Account Assignment</h3>
            <label className="block text-sm font-semibold">
              Staff account ID
              <input
                value={staffUid}
                onChange={event => setStaffUid(event.target.value)}
                autoComplete="off"
                maxLength={128}
                className="mt-1 min-h-11 w-full rounded border border-slate-600 bg-slate-950 px-3 font-normal text-white"
                placeholder="Paste the staff member’s account ID"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 rounded border border-slate-700 p-2 cursor-pointer bg-slate-800">
                <input
                  type="radio"
                  name="directRole"
                  checked={selectedRole === 'staff'}
                  onChange={() => setSelectedRole('staff')}
                  className="accent-blue-500"
                />
                <span><strong>Staff</strong> (Operational tasks)</span>
              </label>
              <label className="flex items-center gap-2 rounded border border-slate-700 p-2 cursor-pointer bg-slate-800">
                <input
                  type="radio"
                  name="directRole"
                  checked={selectedRole === 'manager'}
                  onChange={() => {
                    setSelectedRole('manager');
                    setSelectedPermissions(permissionsList.map(p => p.id));
                  }}
                  className="accent-blue-500"
                />
                <span><strong>Manager</strong> (Full delegation)</span>
              </label>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Permissions for this business</legend>
              {permissionsList.map(item => (
                <label key={item.id} className="flex min-h-11 items-start gap-3 rounded border border-slate-700 p-3 bg-slate-800/40">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(item.id)}
                    onChange={() => togglePermission(item.id, selectedPermissions, setSelectedPermissions)}
                    className="mt-1 h-4 w-4 accent-blue-500"
                  />
                  <span>
                    <strong className="block text-sm">{item.label}</strong>
                    <small className="text-slate-300">{item.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <button
              type="button"
              disabled={busy || !staffUid.trim() || selectedPermissions.length === 0}
              onClick={() => void grantDirect()}
              className="min-h-11 w-full sm:w-auto rounded bg-blue-600 px-4 font-bold text-white disabled:opacity-50 hover:bg-blue-500"
            >
              {busy ? 'Saving…' : 'Grant staff access'}
            </button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold">People with access</h3>
            {loading ? (
              <p role="status" className="text-sm text-slate-300">Loading staff…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-300">No staff accounts have access to this location.</p>
            ) : (
              <ul className="divide-y divide-slate-700">
                {members.map(member => (
                  <li key={member.uid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="block truncate text-sm text-white">
                          {member.name || member.email || member.uid}
                        </strong>
                        {member.role && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700">
                            {member.role}
                          </span>
                        )}
                      </div>
                      <small className="block break-all text-slate-300 mt-0.5">
                        {member.email} · {member.permissions.map(value => permissionsList.find(item => item.id === value)?.label || value).join(', ')}
                      </small>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void revoke(member)}
                      className="min-h-11 rounded border border-rose-400 px-3 text-sm font-bold text-rose-200 disabled:opacity-50 hover:bg-rose-900/30"
                    >
                      Remove access
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE STAFF INVITE (M32 Upgrade) */}
      {tab === 'invite' && (
        <form onSubmit={handleCreateInvite} className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <div>
            <h3 className="text-sm font-bold text-white">Invite New Staff Member</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate a shareable 7-day invite code or send an invite to a phone number or email address.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Delivery Channel</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['code', 'phone', 'email'] as const).map(channel => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setInviteContactType(channel)}
                  className={`py-2 px-3 rounded border text-center font-bold capitalize transition-colors ${
                    inviteContactType === channel
                      ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {channel === 'code' ? 'Invite Code' : channel}
                </button>
              ))}
            </div>
          </div>

          {inviteContactType !== 'code' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {inviteContactType === 'phone' ? 'Phone Number (+91XXXXXXXXXX)' : 'Email Address'}
              </label>
              <input
                required
                type={inviteContactType === 'phone' ? 'tel' : 'email'}
                value={inviteTargetContact}
                onChange={e => setInviteTargetContact(e.target.value)}
                placeholder={inviteContactType === 'phone' ? '+919876543210' : 'staff@store.com'}
                className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Staff Role</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 rounded border border-slate-700 p-2.5 cursor-pointer bg-slate-800">
                <input
                  type="radio"
                  name="inviteRole"
                  checked={inviteRole === 'staff'}
                  onChange={() => setInviteRole('staff')}
                  className="accent-blue-500"
                />
                <span>
                  <strong className="block text-white">Staff</strong>
                  <span className="text-[11px] text-slate-400">Order taking & prep</span>
                </span>
              </label>
              <label className="flex items-center gap-2 rounded border border-slate-700 p-2.5 cursor-pointer bg-slate-800">
                <input
                  type="radio"
                  name="inviteRole"
                  checked={inviteRole === 'manager'}
                  onChange={() => {
                    setInviteRole('manager');
                    setInvitePermissions(permissionsList.map(p => p.id));
                  }}
                  className="accent-blue-500"
                />
                <span>
                  <strong className="block text-white">Manager</strong>
                  <span className="text-[11px] text-slate-400">Full business access</span>
                </span>
              </label>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-300 mb-1">Permissions to Grant</legend>
            {permissionsList.map(item => (
              <label key={item.id} className="flex items-start gap-3 rounded border border-slate-700 p-2.5 bg-slate-800/40">
                <input
                  type="checkbox"
                  checked={invitePermissions.includes(item.id)}
                  onChange={() => togglePermission(item.id, invitePermissions, setInvitePermissions)}
                  className="mt-1 h-4 w-4 accent-blue-500"
                />
                <span>
                  <strong className="block text-sm text-white">{item.label}</strong>
                  <small className="text-slate-400">{item.description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <button
            type="submit"
            disabled={busy || invitePermissions.length === 0}
            className="w-full py-2.5 rounded bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white disabled:opacity-50"
          >
            {busy ? 'Generating Invite…' : 'Generate & Send Staff Invite'}
          </button>

          {createdInviteResult && (
            <div className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-950/40 space-y-2">
              <p className="text-xs font-bold text-emerald-300">Invite Code Ready:</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-black text-emerald-200 tracking-wider bg-black/40 px-3 py-1 rounded">
                  {createdInviteResult.inviteCode}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(createdInviteResult.inviteCode);
                    setNotice(`Copied ${createdInviteResult.inviteCode} to clipboard!`);
                  }}
                  className="px-3 py-1 rounded text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white"
                >
                  Copy Code
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Share this code with your staff member. Valid for 7 days until {new Date(createdInviteResult.expiresAt).toLocaleDateString()}.
              </p>
            </div>
          )}
        </form>
      )}

      {/* TAB 3: PENDING INVITES */}
      {tab === 'pending' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Pending Staff Invites ({invites.length})</h3>
          {invites.length === 0 ? (
            <p className="text-xs text-slate-400">No active pending invites. Click &quot;+ Invite Staff&quot; to issue a new invite.</p>
          ) : (
            <div className="divide-y divide-slate-700">
              {invites.map(inv => (
                <div key={inv.inviteCode} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-bold text-blue-300">{inv.inviteCode}</code>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-900/60 text-amber-200 border border-amber-700">
                        {inv.status}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">
                        {inv.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Target: {inv.targetContact || 'Any authorized merchant'} · Permissions: {inv.permissions.join(', ')}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(inv.inviteCode);
                        setNotice(`Copied code ${inv.inviteCode} to clipboard.`);
                      }}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCancelInvite(inv.inviteCode)}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STAFF ACTIVITY AUDIT LOG */}
      {tab === 'activity' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Staff Activity Audit Trail</h3>
          <p className="text-xs text-slate-400">
            Real-time immutable log of actions taken by outlet managers and staff.
          </p>

          {activities.length === 0 ? (
            <p className="text-xs text-slate-400">No recent staff activity recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 font-bold">
                    <th className="py-2 pr-3">Timestamp</th>
                    <th className="py-2 pr-3">Actor</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2">Context / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {activities.map(act => (
                    <tr key={act.id} className="hover:bg-slate-800/40">
                      <td className="py-2 pr-3 text-slate-400 font-mono text-[11px]">
                        {new Date(act.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-white">
                        {act.actorName}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-200 font-mono">
                          {act.action}
                        </span>
                      </td>
                      <td className="py-2 text-slate-300 text-[11px] font-mono break-all">
                        {JSON.stringify(act.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CLAIM STAFF INVITE CODE */}
      {tab === 'claim' && (
        <form onSubmit={handleClaimInvite} className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4 max-w-md">
          <h3 className="text-sm font-bold text-white">Claim Staff Access Code</h3>
          <p className="text-xs text-slate-400">
            Were you invited to manage another outlet? Enter the 6-character invite code provided by the store owner.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Invite Code (e.g. INV-XXXXXX)
            </label>
            <input
              required
              maxLength={16}
              value={claimCode}
              onChange={e => setClaimCode(e.target.value.toUpperCase())}
              placeholder="INV-XXXXXX"
              className="w-full font-mono text-center tracking-widest text-base font-bold bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !claimCode.trim()}
            className="w-full py-2.5 rounded bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white disabled:opacity-50"
          >
            {busy ? 'Verifying & Claiming…' : 'Claim Staff Access'}
          </button>
        </form>
      )}
    </section>
  );
}
