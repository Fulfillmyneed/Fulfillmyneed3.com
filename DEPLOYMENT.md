# FulfillME Backend Deployment Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **PostgreSQL** (v12 or higher)
3. **PM2** (for process management)
4. **NGINX** (as reverse proxy)
5. **SSL Certificate** (Let's Encrypt)

## Environment Setup

### 1. Server Requirements
- Ubuntu 20.04 LTS or higher
- 2GB RAM minimum
- 20GB disk space

### 2. Install Dependencies
```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install NGINX
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

## **Installation Summary**

1. **First, create all the NEW files** listed above
2. **Update existing files** with the code snippets at the specified locations
3. **Run these commands** to set up your project:

```bash
# Install all dependencies
npm install

# Create the database (make sure PostgreSQL is running)
psql -U postgres -f database.sql

# Start the development server
npm run dev

# Run tests
npm test