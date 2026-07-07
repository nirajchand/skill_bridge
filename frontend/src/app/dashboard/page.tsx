'use client';

import { useAuth } from '@/context/AuthContext';
import ClientHome from '@/components/dashboard/ClientHome';
import FreelancerHome from '@/components/dashboard/FreelancerHome';
import { Spinner } from '@/components/ui';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return user.role === 'freelancer' ? <FreelancerHome /> : <ClientHome />;
}
