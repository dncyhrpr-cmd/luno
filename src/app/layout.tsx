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
    description: 'A modern, real-time cryptocurrency trading platform built with Next.js and Tailwind CSS.',
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