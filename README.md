# VISAANDVOYAGE

Monorepo: `client` (public site), `admin` (dashboard), `server` (Express API).

## Local development

From the repo root (installs `concurrently`, then run all three):

```bash
npm install
npm run dev
```

- Client: Vite dev server (see terminal for port; proxies `/api` to the backend).
- Admin: `http://localhost:5174` (proxies `/api` to the backend).
- API: `http://localhost:5000` by default.

Copy `server/.env.example` → `server/.env` and `client/.env.example` → `client/.env` and fill values (MongoDB, SMTP, optional SMS/Firebase/Razorpay — see server example comments).

## Deploy on Render

Use the included [Blueprint](https://render.com/docs/infrastructure-as-code): add [`render.yaml`](render.yaml) via **New → Blueprint** and connect this repository.

The blueprint creates **three** services:

| Service name           | Type        | Role                          |
|------------------------|------------|-------------------------------|
| `visa-voyage-api`      | Web (Node) | Express API (`server/`)       |
| `visa-voyage-client`   | Static     | Vite production build (`client/`) |
| `visa-voyage-admin`    | Static     | Vite production build (`admin/`)  |

Default **HTTPS** URLs (match [`render.yaml`](render.yaml) unless you rename services):

- API: `https://api.visavo.in`
- Client: `https://visa-voyage-client.onrender.com`
- Admin: `https://visa-voyage-admin.onrender.com`

Static sites bake `VITE_API_URL` and `VITE_ADMIN_APP_ORIGIN` at **build** time. If you rename a service, update those env vars on the static services and redeploy.

### Database

Use **MongoDB Atlas** (or another hosted Mongo). Set `MONGO_URI` on `visa-voyage-api` when Render prompts (Blueprint `sync: false`). In Atlas **Network Access**, allow **`0.0.0.0/0`** so Render’s outbound IPs can connect.

### Optional: uploads persistence

File uploads live under `server/uploads`. On Render, attach a **persistent disk** to the API service and mount it at the same path your app uses (`server/uploads` relative to the service root — i.e. under `server/`). Otherwise uploads can be lost on redeploy.

### Cold starts

Free/starter web services **spin down** when idle; the first request after idle can be slow. Upgrade or keep traffic if you need always-on latency.

## Deploy client + admin on Cloudflare Pages

Backend stays on Render (example: [API health check](https://api.visavo.in/)). Create **two** [Cloudflare Pages](https://developers.cloudflare.com/pages/) projects from this repo.

### Build settings

| | **Client** (public site) | **Admin** (dashboard) |
|---|--------------------------|-------------------------|
| Root directory | `client` | `admin` |
| Build command | `npm install && npm run build` | `npm install && npm run build` |
| Build output | `dist` | `dist` |

Use **Production** environment variables for builds (Vite reads them at **build** time):

**Admin project**

- `VITE_API_URL` = `https://api.visavo.in` (no trailing slash, no `/api`)

**Client project**

- `VITE_API_URL` = `https://api.visavo.in`
- `VITE_ADMIN_APP_ORIGIN` = full URL of your admin Pages deploy, e.g. `https://<admin-project>.pages.dev` or your custom domain for admin

Deploy **admin** first, copy its `*.pages.dev` URL, then set `VITE_ADMIN_APP_ORIGIN` on the **client** project and trigger a new client build.

SPA routing: [`client/public/_redirects`](client/public/_redirects) and [`admin/public/_redirects`](admin/public/_redirects) rewrite all routes to `index.html` so React Router works on Cloudflare.

### CORS

Your Express API uses open CORS by default; requests from `*.pages.dev` and custom domains should work. If you lock down CORS later, allow your Cloudflare origins explicitly.

## Deploy client + admin on Vercel

Backend stays on Render (e.g. `https://api.visavo.in`). You create **two Vercel projects** from the **same Git repo**—one for `client`, one for `admin`.

[`client/vercel.json`](client/vercel.json) and [`admin/vercel.json`](admin/vercel.json) rewrite unknown paths to `index.html` so React Router works ([SPA fallback](https://vercel.com/docs/frameworks/vite#using-vite-on-vercel)).

### 1. Prerequisites

- Repo on GitHub (or GitLab / Bitbucket) connected to [Vercel](https://vercel.com).
- API URL (no `/api` suffix): `https://api.visavo.in`

### 2. Deploy the admin app first

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → **Add New…** → **Project**.
2. **Import** your repository.
3. Before deploying, open **Configure Project**:
   - **Root Directory**: **Edit** → set to `admin` → **Continue**.
   - **Framework Preset**: **Vite** (should auto-detect).
   - **Build Command**: `npm run build` (default).
   - **Output Directory**: `dist` (default for Vite).
4. Open **Environment Variables** → **Production**:
   - Name: `VITE_API_URL` → Value: `https://api.visavo.in`
5. Click **Deploy**.

When it finishes, note the admin URL (e.g. `https://visa-admin-xxxxx.vercel.app`).

### 3. Deploy the public client

1. **Add New…** → **Project** → import the **same** repo again (second project).
2. **Root Directory**: `client`.
3. **Framework Preset**: **Vite**.
4. **Environment Variables** → **Production**:
   - `VITE_API_URL` = `https://api.visavo.in`
   - `VITE_ADMIN_APP_ORIGIN` = your admin URL from step 2 (full `https://…`, no trailing slash), e.g. `https://visa-admin-xxxxx.vercel.app`
5. **Deploy**.

### 4. If something fails

- **Wrong API host**: Check Production env vars on that project → **Redeploy**.
- **Routes 404 on refresh**: Confirm `vercel.json` is inside `client/` or `admin/` (already added in this repo).
- **Client “Admin” links wrong**: Set `VITE_ADMIN_APP_ORIGIN` on the **client** project and redeploy (env is baked in at **build** time).

### 5. Optional: Preview / branch builds

Add the same variables under **Preview** (and **Development** if you use `vercel dev`) so PR previews also point at your API.

Custom domains: **Project → Settings → Domains** after deploy.
