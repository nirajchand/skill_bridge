import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import DashboardTopbar from '@/components/DashboardTopbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProfileNudge from '@/components/ProfileNudge';

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen gap-3 bg-black p-3 text-neutral-100">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <DashboardTopbar />
          <main className="animate-fade-in flex-1 rounded-2xl border border-white/10 bg-neutral-950/50 p-5 sm:p-6">
            <ProfileNudge />
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
