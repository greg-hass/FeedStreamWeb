
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'FeedStream',
        short_name: 'FeedStream',
        description: 'Self-hosted RSS Reader',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#a3e635',
        icons: [
            {
                src: '/icon.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    };
}
