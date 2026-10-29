import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Advaitum Business OS', description: 'Inventory, purchasing, sales and profit reporting for Advaitum.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
