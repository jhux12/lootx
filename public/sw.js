/* eslint-disable no-restricted-globals */
// Minimal service worker required for installability on Chromium browsers.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
