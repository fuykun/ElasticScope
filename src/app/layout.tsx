import type { Metadata } from 'next';
import '../index.css';
import '../styles/index.css';

export const metadata: Metadata = {
    title: 'ElasticScope',
    description: 'A modern web UI for Elasticsearch',
    icons: {
        icon: '/favicon.svg',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
