import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ADI - Automated AI Development',
  description: 'Automated Development Intelligence platform',
  keywords: ['AI', 'development', 'automation', 'intelligence', 'software development', 'AI assistant', 'developer tools'],
  authors: [{ name: 'ADI' }],
  creator: 'ADI',
  publisher: 'ADI',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  themeColor: '#1a1a1a',
  openGraph: {
    type: 'website',
    title: 'ADI - Automated AI Development',
    description: 'Automated Development Intelligence platform',
    siteName: 'ADI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADI - Automated AI Development',
    description: 'Automated Development Intelligence platform',
  },
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
