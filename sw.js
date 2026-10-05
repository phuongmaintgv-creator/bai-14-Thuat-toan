const CACHE_NAME = 'bai-14-thth-hoan-thanh-so-luu-niem-v1';
const VIDEO_URL = './BAI_14_THTH_HOAN_THANH_SO_LUU_NIEM.mp4';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  VIDEO_URL
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return Promise.allSettled(CORE_ASSETS.map(function(url) { return cache.add(url); }));
      })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.filter(function(key) { return key !== CACHE_NAME; }).map(function(key) { return caches.delete(key); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

function parseRange(rangeHeader, size) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;
  var spec = rangeHeader.slice(6).split(',')[0].trim();
  var parts = spec.split('-');
  if (parts.length !== 2) return null;
  var start;
  var end;
  if (parts[0] === '') {
    var suffix = parseInt(parts[1], 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    suffix = Math.min(suffix, size);
    start = size - suffix;
    end = size - 1;
  } else {
    start = parseInt(parts[0], 10);
    if (!Number.isFinite(start) || start < 0 || start >= size) return null;
    if (parts[1] === '') end = size - 1;
    else {
      end = parseInt(parts[1], 10);
      if (!Number.isFinite(end) || end < start) return null;
      end = Math.min(end, size - 1);
    }
  }
  return {start:start, end:end};
}

async function rangeResponse(request, cachedResponse) {
  var buffer = await cachedResponse.arrayBuffer();
  var size = buffer.byteLength;
  var parsed = parseRange(request.headers.get('range'), size);
  if (!parsed) {
    return new Response(null, {
      status: 416,
      headers: {'Content-Range': 'bytes */' + size, 'Accept-Ranges': 'bytes'}
    });
  }
  var chunk = buffer.slice(parsed.start, parsed.end + 1);
  var headers = new Headers();
  headers.set('Content-Type', cachedResponse.headers.get('Content-Type') || 'video/mp4');
  headers.set('Content-Range', 'bytes ' + parsed.start + '-' + parsed.end + '/' + size);
  headers.set('Content-Length', String(chunk.byteLength));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(chunk, {status:206, statusText:'Partial Content', headers:headers});
}

self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  var isVideo = url.pathname.endsWith('/BAI_14_THTH_HOAN_THANH_SO_LUU_NIEM.mp4');

  if (isVideo && request.headers.has('range')) {
    event.respondWith((async function() {
      var cache = await caches.open(CACHE_NAME);
      var cached = await cache.match(VIDEO_URL) || await cache.match(request.url);
      if (cached) return rangeResponse(request, cached);
      return fetch(request);
    })());
    return;
  }

  event.respondWith((async function() {
    var cached = await caches.match(request);
    if (cached) return cached;
    try {
      var response = await fetch(request);
      if (response && response.ok) {
        var cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(function(){});
      }
      return response;
    } catch (err) {
      if (request.mode === 'navigate') {
        var fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
