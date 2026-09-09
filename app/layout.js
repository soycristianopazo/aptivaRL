import './globals.css';
import { Montserrat } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });

export const metadata = {
  title: 'Aptiva RL · Gestión Documental y Acreditación',
  description: 'Plataforma corporativa multiempresa del Holding Río Loa: gestión documental, acreditación y administración de recursos.',
  icons: { icon: '/favicon-aptiva.png', shortcut: '/favicon-aptiva.png', apple: '/favicon-aptiva.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning className={montserrat.className}>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
