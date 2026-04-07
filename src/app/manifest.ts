import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chord Analyzer',
    short_name: 'Chord Analyzer',
    description: 'Midi detector and Chord analyzer',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/128.png',
        sizes: '128x128',
        type: 'image/png',
      },
      {
        src: '/256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/512.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
