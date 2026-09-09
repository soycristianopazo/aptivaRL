import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Aptiva RL \u2013 Capacitaci\u00f3n y Competencias',
  description: 'Plataforma de capacitaci\u00f3n y certificaci\u00f3n de competencias laborales.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
