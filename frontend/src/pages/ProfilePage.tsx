import React, { useEffect, useState } from 'react';
import { FloppyDisk, LockKey, SealCheck, ShieldCheck, UserCircle } from '@phosphor-icons/react';

import { Button, Card, Input } from '../components';
import { getStoredUser, profileService } from '../services';
import type { User } from '../types';

export const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [fullName, setFullName] = useState(user?.fullName ?? user?.name ?? '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    profileService.getProfile().then((profile) => {
      if (!cancelled) {
        setUser(profile);
        setFullName(profile.fullName ?? profile.name ?? '');
      }
    }).catch(() => {
      if (!cancelled) setError('Chưa thể tải hồ sơ. Vui lòng thử lại.');
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      setError('Tên hiển thị không được để trống.');
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await profileService.updateProfile(normalizedName);
      setUser(updated);
      setFullName(updated.fullName ?? normalizedName);
      setSuccess('Thông tin cá nhân đã được cập nhật.');
    } catch {
      setError('Chưa thể lưu thay đổi. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 pb-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
      <Card className="bg-surface p-6 sm:p-8">
        <div className="border-b border-rule pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Tài khoản</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">Thông tin cá nhân</h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted">Cập nhật tên hiển thị trong không gian học. Email đăng nhập được giữ cố định để bảo vệ quyền sở hữu dữ liệu.</p>
        </div>
        {isLoading ? (
          <div data-testid="profile-skeleton" className="mt-7 animate-pulse space-y-5" aria-label="Đang tải hồ sơ">
            <div className="h-4 w-28 rounded bg-paper-3" /><div className="h-12 w-full rounded-xl bg-paper-3" /><div className="h-12 w-full rounded-xl bg-paper-3" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <Input data-testid="profile-full-name" label="Tên hiển thị" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} leftIcon={<UserCircle size={18} />} helperText="Tối đa 80 ký tự." required />
            <Input label="Email đăng nhập" value={user?.email ?? ''} disabled leftIcon={<LockKey size={18} />} />
            <div aria-live="polite">
              {error && <p data-testid="profile-error" className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}
              {success && <p data-testid="profile-success" className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success">{success}</p>}
            </div>
            <Button data-testid="profile-save" type="submit" size="lg" isLoading={isSaving} disabled={isSaving || !fullName.trim()} leftIcon={<FloppyDisk size={18} />}>Lưu thay đổi</Button>
          </form>
        )}
      </Card>
      <aside className="space-y-4">
        <Card className="bg-ink p-6 text-paper"><ShieldCheck size={24} /><h2 className="mt-5 text-lg font-bold">Phiên được bảo vệ</h2><p className="mt-2 text-sm leading-6 text-paper/65">Token có thời hạn ngắn và mọi tài liệu được kiểm tra quyền sở hữu ở máy chủ.</p></Card>
        <Card className="bg-surface p-6"><div className="flex items-center gap-3"><SealCheck size={21} className={user?.emailVerified ? 'text-success' : 'text-warning'} /><div><p className="text-sm font-bold text-ink">Trạng thái email</p><p className="text-xs text-muted">{user?.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</p></div></div></Card>
      </aside>
    </div>
  );
};
