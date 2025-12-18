// FulfillME PWA - Main Application Script

// DOM Elements
const installBanner = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissBtn');
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const closeModals = document.querySelectorAll('.close-modal');
const switchToSignup = document.getElementById('switchToSignup');
const switchToLogin = document.getElementById('switchToLogin');
const userTypeBtns = document.querySelectorAll('.user-type-btn');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const requestsGrid = document.getElementById('requestsGrid');
const searchInput = document.getElementById('searchInput');
const categorySelect = document.getElementById('categorySelect');
const searchBtn = document.querySelector('.btn-search');
const categoryCards = document.querySelectorAll('.category-card');

// PWA Install Prompt
let deferredPrompt;

// Sample data for requests
const sampleRequests = [
    {
        id: 1,
        title: "Plumber for kitchen sink",
        location: "Nairobi",
        price: "KSh 1,000",
        description: "Need a plumber to fix a leaking kitchen sink. Issue started yesterday.",
        user: { name: "John M.", avatar: "JM" },
        time: "2 hours ago",
        category: "services",
        image: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=250&fit=crop"
    },
    {
        id: 2,
        title: "Used laptop under KSh 15,000",
        location: "Kisumu",
        price: "KSh 15,000 max",
        description: "Looking for a used laptop in good condition for student use.",
        user: { name: "Sarah K.", avatar: "SK" },
        time: "5 hours ago",
        category: "products",
        image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=250&fit=crop"
    },
    {
        id: 3,
        title: "Wedding DJ",
        location: "Nakuru",
        price: "KSh 5,000",
        description: "Need a DJ for wedding reception next weekend. Must have own equipment.",
        user: { name: "David W.", avatar: "DW" },
        time: "1 day ago",
        category: "services",
        image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=250&fit=crop"
    },
    {
        id: 4,
        title: "House cleaning",
        location: "Mombasa",
        price: "KSh 800",
        description: "Deep cleaning needed for 3-bedroom house. Must provide own cleaning supplies.",
        user: { name: "Amina R.", avatar: "AR" },
        time: "2 days ago",
        category: "services",
        image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w-400&h=250&fit=crop"
    },
    {
        id: 5,
        title: "German Shepherd puppy",
        location: "Eldoret",
        price: "KSh 8,000",
        description: "Looking for a healthy German Shepherd puppy, vaccinated if possible.",
        user: { name: "Peter K.", avatar: "PK" },
        time: "3 days ago",
        category: "pets",
        image: "https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=400&h=250&fit=crop"
    },
    {
        id: 6,
        title: "Car rental for 3 days",
        location: "Nairobi",
        price: "KSh 6,000/day",
        description: "Need a reliable car for family trip. Automatic transmission preferred.",
        user: { name: "Michael T.", avatar: "MT" },
        time: "4 days ago",
        category: "rentals",
        image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&h=250&fit=crop"
    }
];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadRequests();
    setupEventListeners();
    checkNetworkStatus();
    initializeServiceWorker();
});

function initializeApp() {
    // Check if user has already installed the app
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('Running in standalone mode');
    }
}

function loadRequests(filterCategory = '') {
    requestsGrid.innerHTML = '';
    
    let filteredRequests = sampleRequests;
    if (filterCategory) {
        filteredRequests = sampleRequests.filter(req => req.category === filterCategory);
    }
    
    filteredRequests.forEach(request => {
        const requestCard = createRequestCard(request);
        requestsGrid.appendChild(requestCard);
    });
}

function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.id = request.id;
    card.dataset.category = request.category;
    
    card.innerHTML = `
        <div class="request-image">
            <div class="request-price">${request.price}</div>
            <div style="width: 100%; height: 100%; background: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.3)), url('${request.image}'); background-size: cover; background-position: center;"></div>
        </div>
        <div class="request-content">
            <h3 class="request-title">${request.title}</h3>
            <div class="request-location">
                <i class="fas fa-map-marker-alt"></i> ${request.location}
            </div>
            <p class="request-description">${request.description}</p>
            <div class="request-footer">
                <div class="request-user">
                    <div class="user-avatar">${request.user.avatar}</div>
                    <span>${request.user.name}</span>
                </div>
                <div class="request-time">${request.time}</div>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        // In a real app, this would navigate to request detail page
        showToast(`Viewing request: ${request.title}`);
        // Save for offline viewing
        saveForOffline(request);
    });
    
    return card;
}

function setupEventListeners() {
    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('show');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
            navLinks.classList.remove('show');
        }
    });
    
    // Modal controls
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.add('show');
        signupModal.classList.remove('show');
        document.body.style.overflow = 'hidden';
    });
    
    signupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupModal.classList.add('show');
        loginModal.classList.remove('show');
        document.body.style.overflow = 'hidden';
    });
    
    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
            loginModal.classList.remove('show');
            signupModal.classList.remove('show');
            document.body.style.overflow = 'auto';
        });
    });
    
    // Switch between login and signup modals
    switchToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.remove('show');
        signupModal.classList.add('show');
    });
    
    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        signupModal.classList.remove('show');
        loginModal.classList.add('show');
    });
    
    // User type selection
    userTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            userTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Form submissions
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        // Simulate login
        simulateLogin(email, password);
    });
    
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const phone = document.getElementById('signupPhone').value;
        const location = document.getElementById('signupLocation').value;
        const password = document.getElementById('signupPassword').value;
        const userType = document.querySelector('.user-type-btn.active').dataset.type;
        
        // Simulate signup
        simulateSignup({ name, email, phone, location, password, userType });
    });
    
    // Search functionality
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Category filtering
    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            categoryCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            loadRequests(category);
            showToast(`Showing ${category} requests`);
        });
    });
    
    // Category select change
    categorySelect.addEventListener('change', () => {
        const category = categorySelect.value;
        loadRequests(category || '');
    });
    
    // PWA Install banner
    if (installBanner) {
        dismissBtn.addEventListener('click', () => {
            installBanner.classList.remove('show');
            localStorage.setItem('installBannerDismissed', 'true');
        });
        
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                installBanner.classList.remove('show');
            }
        });
    }
    
    // Handle beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install banner if not dismissed before
        if (!localStorage.getItem('installBannerDismissed')) {
            setTimeout(() => {
                installBanner.classList.add('show');
            }, 3000);
        }
    });
    
    // Handle app installed
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        if (installBanner) {
            installBanner.classList.remove('show');
        }
        showToast('App installed successfully!');
    });
}

function performSearch() {
    const query = searchInput.value.toLowerCase();
    const category = categorySelect.value;
    
    let results = sampleRequests;
    
    if (category) {
        results = results.filter(req => req.category === category);
    }
    
    if (query) {
        results = results.filter(req => 
            req.title.toLowerCase().includes(query) ||
            req.location.toLowerCase().includes(query) ||
            req.description.toLowerCase().includes(query)
        );
    }
    
    displaySearchResults(results);
}

function displaySearchResults(results) {
    requestsGrid.innerHTML = '';
    
    if (results.length === 0) {
        requestsGrid.innerHTML = `
            <div class="text-center p-20">
                <i class="fas fa-search fa-3x" style="color: var(--light-gray); margin-bottom: 20px;"></i>
                <h3>No requests found</h3>
                <p>Try different search terms or browse all categories</p>
            </div>
        `;
        return;
    }
    
    results.forEach(request => {
        const requestCard = createRequestCard(request);
        requestsGrid.appendChild(requestCard);
    });
    
    showToast(`Found ${results.length} request(s)`);
}

function simulateLogin(email, password) {
    // Show loading state
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Close modal
        loginModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Show success message
        showToast('Login successful! Redirecting to dashboard...');
        
        // In a real app, you would redirect or update UI
        setTimeout(() => {
            window.location.href = 'pages/dashboard.html';
        }, 1500);
    }, 1500);
}

function simulateSignup(userData) {
    // Show loading state
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Close modal
        signupModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Show success message
        showToast(`Account created! Welcome ${userData.name}`);
        
        // Save user data to localStorage (simulated)
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Redirect based on user type
        setTimeout(() => {
            if (userData.userType === 'asker') {
                window.location.href = 'pages/post-need.html';
            } else {
                window.location.href = 'pages/browse.html';
            }
        }, 1500);
    }, 1500);
}

function checkNetworkStatus() {
    const offlineIndicator = document.createElement('div');
    offlineIndicator.className = 'offline-indicator';
    offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> You are currently offline. Some features may be limited.';
    document.body.appendChild(offlineIndicator);
    
    function updateNetworkStatus() {
        if (!navigator.onLine) {
            offlineIndicator.classList.add('show');
            showToast('You are now offline', 'warning');
        } else {
            offlineIndicator.classList.remove('show');
            showToast('Back online!', 'success');
        }
    }
    
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Initial check
    updateNetworkStatus();
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add icon based on type
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    if (type === 'error') icon = 'fa-times-circle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
    
    // Allow click to dismiss
    toast.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    });
}

function saveForOffline(request) {
    // Save request to localStorage for offline viewing
    try {
        let offlineData = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
        
        // Check if already saved
        if (!offlineData.some(req => req.id === request.id)) {
            offlineData.push(request);
            localStorage.setItem('offlineRequests', JSON.stringify(offlineData));
            console.log('Request saved for offline viewing');
        }
    } catch (error) {
        console.error('Error saving for offline:', error);
    }
}

function initializeServiceWorker() {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
        // Register service worker
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Service Worker update found!');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('New version available! Refresh to update.', 'info');
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', event => {
            console.log('Message from service worker:', event.data);
            
            if (event.data.type === 'CACHE_UPDATED') {
                showToast('New content available. Refresh to update.', 'info');
            }
        });
    }
}

// Utility function to format currency
function formatCurrency(amount) {
    return `KSh ${parseInt(amount).toLocaleString()}`;
}

// Export functions for use in other modules (if needed)
window.FulfillME = {
    showToast,
    formatCurrency,
    saveForOffline
};