import type { Metadata } from 'next'; import './globals.css';
export const metadata:Metadata={title:'Advaitum Business OS',description:'Private inventory, purchasing and sales management.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
