import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Aptiva RL · Gestión Documental y Acreditación',
  description: 'Plataforma corporativa multiempresa del Holding Río Loa: gestión documental, acreditación y administración de recursos.',
  icons: { icon: '/favicon-aptiva.png', shortcut: '/favicon-aptiva.png', apple: '/favicon-aptiva.png' },
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
