import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

type VendorChunkGroup = {
  name: string;
  packages: string[];
};

const vendorChunkGroups: VendorChunkGroup[] = [
  {
    name: 'vendor-react',
    packages: ['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', '@remix-run/router'],
  },
  {
    name: 'vendor-firebase-auth',
    packages: ['firebase/auth', '@firebase/auth', '@firebase/auth-interop-types'],
  },
  {
    name: 'vendor-firebase-firestore',
    packages: ['firebase/firestore', '@firebase/firestore', '@firebase/webchannel-wrapper'],
  },
  {
    name: 'vendor-firebase-storage',
    packages: ['firebase/storage', '@firebase/storage'],
  },
  {
    name: 'vendor-firebase-core',
    packages: ['firebase/app', 'firebase', '@firebase/app', '@firebase/component', '@firebase/logger', '@firebase/util'],
  },
  {
    name: 'vendor-motion',
    packages: ['motion', 'framer-motion'],
  },
  {
    name: 'vendor-payments-analytics',
    packages: ['@stripe', '@vercel/analytics'],
  },
  {
    name: 'vendor-ui',
    packages: ['lucide-react'],
  },
];

const getVendorChunk = (id: string) => {
  if (!id.includes('node_modules')) return undefined;

  const normalizedId = id.replace(/\\/g, '/');
  const nodeModulesPath = `${normalizedId.split('/node_modules/').pop() ?? ''}/`;

  for (const group of vendorChunkGroups) {
    if (group.packages.some((packageName) => nodeModulesPath === `${packageName}/` || nodeModulesPath.startsWith(`${packageName}/`))) {
      return group.name;
    }
  }

  return undefined;
};

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'motion/react': path.resolve(__dirname, 'src/shims_motion_react.tsx'),
    }
  },
  build: {
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: getVendorChunk,
      },
    },
  },
});
