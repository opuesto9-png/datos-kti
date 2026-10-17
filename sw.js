// Datos KTI — funciona sin señal: guarda la app en el celular y la sirve desde ahí.
const VERSION = 'datos-kti-v5';
const APP = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
// Lo de afuera que la app necesita para abrir y guardar sin señal (Firebase, letra, Excel)
const EXT = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(APP);
    // si alguno de afuera falla no frena la instalación
    await Promise.all(EXT.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La página: primero la red (para recibir actualizaciones), si no hay señal la copia guardada
  // Con señal débil (campo) no se queda esperando: a los 3 s abre la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const guardada = await caches.match('./index.html', { ignoreSearch: true });
      const red = fetch(req).then(r => {
        if (r && r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put('./index.html', c)); }
        return r;
      });
      if (!guardada) return red;
      const espera = new Promise(ok => setTimeout(() => ok(guardada), 3000));
      return Promise.race([red.catch(() => guardada), espera]);
    })());
    return;
  }
  // Fuentes y archivos propios: la copia guardada, y se actualiza en segundo plano
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) || (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.includes('/exceljs/'))) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});

// Al tocar el aviso de Windows: trae la app al frente (o la abre)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
