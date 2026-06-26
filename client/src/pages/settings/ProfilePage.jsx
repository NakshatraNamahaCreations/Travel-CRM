import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../store/AuthContext.jsx';
import { profileApi } from '../../api/settings.js';

export default function ProfilePage() {
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const set = (obj, k) => (e) => (obj === 'f' ? setF : setPw)((s) => ({ ...s, [k]: e.target.value }));

  const profileMut = useMutation({
    mutationFn: () => profileApi.update({ name: f.name, phone: f.phone }),
    onSuccess: () => toast.success('Profile updated'),
    onError: (e) => toast.error(e.message),
  });
  const pwMut = useMutation({
    mutationFn: () => profileApi.update(pw),
    onSuccess: () => { toast.success('Password changed'); setPw({ currentPassword: '', newPassword: '' }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><UserIcon size={22} /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{user?.name}</h1>
          <p className="text-sm text-gray-500">{user?.email} · <span className="capitalize">{user?.role}</span></p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); profileMut.mutate(); }} className="card space-y-4 p-5">
        <h2 className="font-semibold text-gray-900">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Name</label><input className="input" value={f.name} onChange={set('f', 'name')} /></div>
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={set('f', 'phone')} /></div>
        </div>
        <div><label className="label">Email</label><input className="input bg-gray-50" value={user?.email} disabled /></div>
        <div className="flex justify-end"><button className="btn-primary" disabled={profileMut.isPending}>{profileMut.isPending ? 'Saving…' : 'Save Profile'}</button></div>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); if (!pw.newPassword) return toast.error('Enter a new password'); pwMut.mutate(); }} className="card mt-6 space-y-4 p-5">
        <h2 className="font-semibold text-gray-900">Change Password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Current Password</label><input type="password" className="input" value={pw.currentPassword} onChange={set('pw', 'currentPassword')} /></div>
          <div><label className="label">New Password</label><input type="password" className="input" value={pw.newPassword} onChange={set('pw', 'newPassword')} /></div>
        </div>
        <div className="flex justify-end"><button className="btn-secondary" disabled={pwMut.isPending}>{pwMut.isPending ? 'Saving…' : 'Change Password'}</button></div>
      </form>
    </div>
  );
}
