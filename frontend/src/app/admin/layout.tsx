import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
