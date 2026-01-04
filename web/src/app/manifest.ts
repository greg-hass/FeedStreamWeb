
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'FeedStream',
        short_name: 'FeedStream',
        description: 'Self-hosted RSS Reader & Podcast Player',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#a3e635',
        orientation: 'any',
        categories: ['news', 'productivity', 'utilities'],
        icons: [
            {
                src: '/icon.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
            },
            {
                src: '/icon.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
            }
        ],
        screenshots: [
            {
                src: '/screenshot-desktop.png',
                sizes: '1920x1080',
                type: 'image/png',
                form_factor: 'wide',
                label: 'FeedStream Desktop Reader'
            },
            {
                src: '/screenshot-mobile.png',
                sizes: '1170x2532',
                type: 'image/png',
                label: 'FeedStream Mobile'
            }
        ],
    };
}
