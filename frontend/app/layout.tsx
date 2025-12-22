import type { ReactNode } from 'react';
import { Providers } from '../components/Providers';
import '../styles/tokens.css';
import '../styles/globals.css';
import '../styles/components.css';
import '../styles/media.css';
import './mobile.css';
import '../public/vendor/fontawesome/css/all.min.css';

export const metadata = {
  title: 'YouTube Upload Manager',
  description: 'Drive-backed YouTube upload tool',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
