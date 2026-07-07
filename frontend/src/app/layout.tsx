import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sora, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import Navbar from '@/components/Navbar';

const display = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap'
});

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'SkillBridge — Freelance work, paid fairly',
  description: 'Escrow-secured freelance marketplace for clients and freelancers.'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-black text-neutral-100 antialiased">
        <ToastProvider>
          <AuthProvider>
            <Navbar />
            {children}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
