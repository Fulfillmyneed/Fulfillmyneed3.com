-- Create database
CREATE DATABASE fulfillme_db;

-- Switch to database
\c fulfillme_db;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    location VARCHAR(100) NOT NULL,
    national_id VARCHAR(20),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    user_type VARCHAR(20) CHECK (user_type IN ('asker', 'fulfiller')) NOT NULL,
    categories TEXT[], -- Array of category IDs for fulfillers
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    bio TEXT,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INTEGER DEFAULT 0,
    credits INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    parent_id UUID REFERENCES categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Needs table
CREATE TABLE needs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    budget DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    location VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    timeline VARCHAR(50),
    photo_urls TEXT[], -- Array of photo URLs
    contact_prefs JSONB DEFAULT '["whatsapp", "call"]',
    status VARCHAR(20) CHECK (status IN ('active', 'fulfilled', 'expired', 'cancelled')) DEFAULT 'active',
    asker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    view_count INTEGER DEFAULT 0,
    unlock_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENTESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unlocks table (transactions)
CREATE TABLE unlocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    fulfiller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    transaction_id VARCHAR(100) UNIQUE,
    mpesa_receipt VARCHAR(50),
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    contact_details_revealed BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages_need (need_id),
    INDEX idx_messages_sender (sender_id),
    INDEX idx_messages_receiver (receiver_id)
);

-- Ratings table
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rater_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review TEXT,
    response TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(need_id, rater_user_id)
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user (user_id)
);

-- Credit purchases table
CREATE TABLE credit_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    credits INTEGER NOT NULL,
    transaction_id VARCHAR(100) UNIQUE,
    mpesa_receipt VARCHAR(50),
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Fulfiller categories junction table
CREATE TABLE fulfiller_categories (
    fulfiller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (fulfiller_id, category_id)
);

-- Indexes for better performance
CREATE INDEX idx_needs_status ON needs(status);
CREATE INDEX idx_needs_category ON needs(category_id);
CREATE INDEX idx_needs_asker ON needs(asker_id);
CREATE INDEX idx_needs_location ON needs(location);
CREATE INDEX idx_needs_created ON needs(created_at DESC);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_unlocks_fulfiller ON unlocks(fulfiller_id);
CREATE INDEX idx_ratings_rated_user ON ratings(rated_user_id);

-- Insert default categories
INSERT INTO categories (id, name, description, icon, sort_order) VALUES
(uuid_generate_v4(), 'Services', 'Plumbing, electricians, cleaning, childcare, events', 'fa-tools', 1),
(uuid_generate_v4(), 'Products', 'Phones, electronics, fashion, toys, books', 'fa-mobile-alt', 2),
(uuid_generate_v4(), 'Rentals', 'Hotels, cars, equipment, venues', 'fa-car', 3),
(uuid_generate_v4(), 'Pets & Animals', 'Dogs, goats, veterinary services', 'fa-paw', 4),
(uuid_generate_v4(), 'Other', 'Writers, digital marketing, prayers', 'fa-ellipsis-h', 5);

-- Insert sub-categories for Services
INSERT INTO categories (id, name, description, icon, parent_id, sort_order) VALUES
(uuid_generate_v4(), 'Plumbing', 'Pipe fixing, installation, repairs', 'fa-faucet', (SELECT id FROM categories WHERE name = 'Services'), 1),
(uuid_generate_v4(), 'Electrical', 'Wiring, installations, repairs', 'fa-bolt', (SELECT id FROM categories WHERE name = 'Services'), 2),
(uuid_generate_v4(), 'Cleaning', 'House, office, industrial cleaning', 'fa-broom', (SELECT id FROM categories WHERE name = 'Services'), 3),
(uuid_generate_v4(), 'Childcare', 'Babysitting, nanny services', 'fa-baby', (SELECT id FROM categories WHERE name = 'Services'), 4),
(uuid_generate_v4(), 'Events', 'Catering, decor, planning', 'fa-calendar-alt', (SELECT id FROM categories WHERE name = 'Services'), 5),
(uuid_generate_v4(), 'Legal', 'Legal advice, documentation', 'fa-gavel', (SELECT id FROM categories WHERE name = 'Services'), 6),
(uuid_generate_v4(), 'Fitness', 'Personal training, gym sessions', 'fa-dumbbell', (SELECT id FROM categories WHERE name = 'Services'), 7),
(uuid_generate_v4(), 'Beauty', 'Hair, nails, makeup, spa', 'fa-spa', (SELECT id FROM categories WHERE name = 'Services'), 8),
(uuid_generate_v4(), 'Transport', 'Moving, delivery, logistics', 'fa-truck', (SELECT id FROM categories WHERE name = 'Services'), 9),
(uuid_generate_v4(), 'Security', 'Guards, alarm systems', 'fa-shield-alt', (SELECT id FROM categories WHERE name = 'Services'), 10);

-- Insert sub-categories for Products
INSERT INTO categories (id, name, description, icon, parent_id, sort_order) VALUES
(uuid_generate_v4(), 'Phones & Electronics', 'Smartphones, laptops, accessories', 'fa-mobile-alt', (SELECT id FROM categories WHERE name = 'Products'), 1),
(uuid_generate_v4(), 'Fashion', 'Clothing, shoes, accessories', 'fa-tshirt', (SELECT id FROM categories WHERE name = 'Products'), 2),
(uuid_generate_v4(), 'Toys & Games', 'Children toys, video games', 'fa-gamepad', (SELECT id FROM categories WHERE name = 'Products'), 3),
(uuid_generate_v4(), 'Books', 'Textbooks, novels, educational', 'fa-book', (SELECT id FROM categories WHERE name = 'Products'), 4),
(uuid_generate_v4(), 'Furniture', 'Home and office furniture', 'fa-couch', (SELECT id FROM categories WHERE name = 'Products'), 5);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_needs_updated_at BEFORE UPDATE ON needs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate user rating
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET rating = (
        SELECT AVG(rating)::DECIMAL(3,2)
        FROM ratings
        WHERE rated_user_id = NEW.rated_user_id
        AND is_public = TRUE
    ),
    total_ratings = (
        SELECT COUNT(*)
        FROM ratings
        WHERE rated_user_id = NEW.rated_user_id
        AND is_public = TRUE
    )
    WHERE id = NEW.rated_user_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for ratings
CREATE TRIGGER update_rating_after_insert AFTER INSERT OR UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_user_rating();

-- Create view for active needs with user details
CREATE VIEW active_needs_view AS
SELECT 
    n.*,
    u.full_name as asker_name,
    u.avatar_url as asker_avatar,
    u.rating as asker_rating,
    c.name as category_name,
    c.icon as category_icon
FROM needs n
JOIN users u ON n.asker_id = u.id
JOIN categories c ON n.category_id = c.id
WHERE n.status = 'active'
AND u.is_active = TRUE
ORDER BY n.created_at DESC;

-- Create view for fulfillers with their categories
CREATE VIEW fulfiller_profiles_view AS
SELECT 
    u.*,
    ARRAY_AGG(c.name) as category_names,
    ARRAY_AGG(c.id) as category_ids
FROM users u
LEFT JOIN fulfiller_categories fc ON u.id = fc.fulfiller_id
LEFT JOIN categories c ON fc.category_id = c.id
WHERE u.user_type = 'fulfiller'
AND u.is_active = TRUE
GROUP BY u.id;