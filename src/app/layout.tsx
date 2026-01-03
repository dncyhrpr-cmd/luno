import './globals.css';
import { Inter } from 'next/font/google';
import ClientProviders from '@/components/ClientProviders';
import React from 'react';

// Initialize the Inter font for optimal loading and performance
const inter = Inter({ 
    subsets: ['latin'],
    variable: '--font-sans', // Define as a CSS variable for consistent use across components
});

// Metadata for SEO and application title
export const metadata = {
    title: 'Luno - Crypto Trading Platform',
    description: 'A modern, real-time cryptocurrency trading platform built with Next.js and Tailwind CSS. Trade crypto with live charts, binary options, and advanced analytics.',
    keywords: ['cryptocurrency', 'crypto trading', 'bitcoin', 'ethereum', 'trading platform', 'real-time charts', 'binary options'],
    authors: [{ name: 'Luno Team' }],
    openGraph: {
        title: 'Luno - Crypto Trading Platform',
        description: 'Trade cryptocurrencies with real-time data, advanced charts, and binary options on Luno.',
        url: 'https://luno-trading.com',
        siteName: 'Luno',
        images: [
            {
                url: 'https://luno-trading.com/luno-logo.svg',
                width: 1200,
                height: 630,
                alt: 'Luno Crypto Trading Platform',
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Luno - Crypto Trading Platform',
        description: 'Trade cryptocurrencies with real-time data, advanced charts, and binary options on Luno.',
        images: ['https://luno-trading.com/luno-logo.svg'],
        creator: '@luno_trading',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // Removed hardcoded 'dark' class. Theme is managed by ClientProviders.
        // suppressHydrationWarning is needed when initial state (like theme) is determined on the client.
        <html lang="en" suppressHydrationWarning>
            <body 
                // Apply Inter font and antialiasing for smoother text rendering
                className={`${inter.className} antialiased`}
            >
                {/* ClientProviders wraps the entire application with necessary contexts (e.g., Theme, Auth, Data) */}
                <ClientProviders>
                    {children}
                </ClientProviders>
            </body>
        </html>
    );
}