# Deployment Guide

## Frontend (Vercel)

1. Push your code to a GitHub repository
2. Go to [Vercel](https://vercel.com) and create a new project
3. Connect your GitHub repository
4. Configure the following settings:
   - Framework Preset: Vite
   - Root Directory: client
   - Build Command: npm run build
   - Output Directory: dist
5. Add the following environment variable:
   - `BACKEND_URL`: Your Railway backend URL (e.g., https://your-app.railway.app)

## Backend (Railway)

1. Go to [Railway](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Configure the following settings:
   - Root Directory: / (root)
   - Build Command: npm install
   - Start Command: npm start
4. Add the following environment variables:
   - `NODE_ENV`: production
   - `ALLOWED_ORIGINS`: Your Vercel frontend URL (e.g., https://your-app.vercel.app)
   - Any other environment variables your app needs

## Local Development

1. In the root directory:
   ```bash
   npm install
   npm run dev
   ```

The app will run in development mode with both frontend and backend on the same port (5000).

## Production Preview

To test the production build locally:

1. Frontend (client directory):
   ```bash
   npm run build
   npm run preview
   ```

2. Backend (root directory):
   ```bash
   npm run start
   ```

Make sure to set the appropriate environment variables in your .env files.
