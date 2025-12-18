// FulfillME PWA Service Worker

const CACHE_NAME = 'fulfillme-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/pages/dashboard.html',
    '/pages/post-need.html',
    '/pages/browse.html',
    '/pages/profile.html',
    '/pages/unlock.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Open+Sans:wght@400;600&display=swap'
];

// Install event
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('Service Worker: Activated');
    
    // Remove old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
        .then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached response if found
                if (cachedResponse) {
                    console.log('Service Worker: Serving from cache', event.request.url);
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        // Cache the new response
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        // If network fails and no cache, return offline page
                        console.log('Service Worker: Fetch failed; returning offline page', error);
                        
                        // For HTML requests, return offline page
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        
                        // For other requests, you could return a placeholder
                        return new Response('Network error occurred', {
                            status: 408,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
});

// Background sync for form submissions
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync', event.tag);
    
    if (event.tag === 'sync-forms') {
        event.waitUntil(syncForms());
    }
});

// Function to sync pending forms
function syncForms() {
    // Get pending forms from IndexedDB
    return getPendingForms()
        .then(forms => {
            return Promise.all(
                forms.map(form => {
                    return fetch(form.url, {
                        method: 'POST',
                        body: JSON.stringify(form.data),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => {
                        if (response.ok) {
                            // Remove form from pending queue
                            return removePendingForm(form.id);
                        }
                        throw new Error('Sync failed');
                    });
                })
            );
        });
}

// Push notification event
self.addEventListener('push', event => {
    console.log('Service Worker: Push received');
    
    const options = {
        body: event.data ? event.data.text() : 'New request available!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        },
        actions: [
            {
                action: 'explore',
                title: 'Browse',
                icon: '/icons/icon-72x72.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icons/icon-72x72.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('FulfillME', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification click');
    
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // If a window is already open, focus it
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Otherwise open a new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Message event from main thread
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data.type === 'CACHE_NEW_REQUEST') {
        // Cache a new request for offline viewing
        const request = event.data.request;
        cacheRequest(request);
    }
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Function to cache individual request
function cacheRequest(request) {
    caches.open(CACHE_NAME)
        .then(cache => {
            // Create a mock response for the request
            const mockResponse = new Response(JSON.stringify(request), {
                headers: { 'Content-Type': 'application/json' }
            });
            
            // Create a URL for the request
            const url = `/api/requests/${request.id}`;
            
            cache.put(url, mockResponse);
            console.log('Service Worker: Cached request', request.id);
        });
}

// Helper functions for IndexedDB (simplified)
function getPendingForms() {
    // In a real implementation, you would use IndexedDB
    return Promise.resolve([]);
}

function removePendingForm(id) {
    // In a real implementation, you would use IndexedDB
    return Promise.resolve();
}

// Periodic sync for updates
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-content') {
        event.waitUntil(updateContent());
    }
});

function updateContent() {
    return fetch('/api/latest-requests')
        .then(response => response.json())
        .then(data => {
            // Notify all clients about update
            self.clients.matchAll()
                .then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'CACHE_UPDATED',
                            data: data
                        });
                    });
                });
        })
        .catch(error => {
            console.error('Periodic sync failed:', error);
        });
}

// Cache strategies for different file types
const cacheStrategies = {
    static: 'cache-first',
    images: 'cache-first',
    api: 'network-first'
};

// Helper to determine cache strategy
function getCacheStrategy(request) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/api/')) {
        return cacheStrategies.api;
    }
    
    if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
        return cacheStrategies.images;
    }
    
    return cacheStrategies.static;
}