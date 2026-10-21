import type { Metadata } from 'next';
import './globals.css';
import { AntdAlfaProvider } from '../components/ui/providers/AntdAlfaProvider';

export const metadata: Metadata = {
  title: 'Умный кредитный кабинет | Альфа-Банк',
  description: 'Кредитный конвейер для малого и микробизнеса',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-[#F2F3F5] text-[#0B1F35] antialiased">
        <AntdAlfaProvider>{children}</AntdAlfaProvider>
      </body>
    </html>
  );
}