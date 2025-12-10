import type { ReactNode } from 'react';
import { Providers } from '../components/Providers';
import '../styles/tokens.css';
import '../styles/globals.css';
import '../styles/components.css';
import './mobile.css';

export const metadata = {
  title: 'YouTube Upload Manager',
  description: 'Drive-backed YouTube upload tool',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
