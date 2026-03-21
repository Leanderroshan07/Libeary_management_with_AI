# Deployment Guide (Vercel + Render)

This project is configured for:
- Frontend: Vercel (from `client/`)
- Backend: Render (from repository root, starting `server/index.js`)

## 1) Backend on Render

Create a **Web Service** from this repository and use:

- Build Command:
  - `npm install --prefix server && (python3 -m pip install -r requirements.txt || python -m pip install -r requirements.txt)`
- Start Command:
  - `node server/index.js`
- Health Check Path:
  - `/api/health`

Required environment variables on Render:
- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGIN` (comma-separated list of allowed frontend origins)
  - Example:
    - `https://your-frontend.vercel.app,https://your-production-domain.com`

Recommended environment variables on Render:
- `NODE_ENV=production`
- `FINE_RATE_PER_DAY=10`
- `ALLOW_VERCEL_PREVIEWS=true`
- `RAG_PYTHON=python3`
- `GROQ_API_KEY` (if using LLM answers)
- `GROQ_MODEL=llama-3.1-8b-instant`

After deploy, verify:
- `https://<your-render-service>.onrender.com/`
- `https://<your-render-service>.onrender.com/api/health`

## 2) Frontend on Vercel

Import the same repo into Vercel and set:

- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variables on Vercel:
- `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`
- Optional: `VITE_FALLBACK_API_BASE_URL=https://<secondary-api-base-url>`

`client/vercel.json` already includes SPA route rewrites.

## 3) Fresh redeploy checklist

1. Deploy Render backend first.
2. Confirm Render health endpoint is `ok`.
3. Add backend URL to Vercel `VITE_API_BASE_URL`.
4. Deploy Vercel frontend.
5. Test login, books list, admin routes, and RAG chat.

## 4) Common issues

- Frontend calling localhost in production:
  - Ensure `VITE_API_BASE_URL` is set in Vercel and redeploy.
- CORS blocked requests:
  - Ensure `CORS_ORIGIN` includes your Vercel production domain.
- Render starts wrong file:
  - Start command must be `node server/index.js`.
- RAG Python runtime errors:
  - Ensure build command installs Python deps from root `requirements.txt`.
