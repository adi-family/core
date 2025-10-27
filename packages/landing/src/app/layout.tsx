import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ADI Simple - Landing',
  description: 'Welcome to ADI Simple',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
