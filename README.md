# WFH Planner

A modern web app to manage Work From Home (WFH) and Work From Office (WFO) schedules for your team.

## Features

- **Kanban-style dashboard** - View 4 weeks at a time with employee chips
- **Employee management** - Add, edit, delete, and reorder team members
- **WFH types** - Rotating, Permanent WFH, Permanent WFO, Day-Fixed
- **Auto-allocation** - System generates fair rotation schedules
- **Admin swap** - One-click swap between employees across weeks
- **Override tracking** - Visual indicators for manually modified weeks
- **Google OAuth** - Secure authentication

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** + shadcn/ui (dark theme)
- **Turso** (distributed SQLite)
- **Drizzle ORM**
- **NextAuth.js v5**

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Turso Database

1. Create account at [turso.tech](https://turso.tech)
2. Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
3. Login: `turso auth login`
4. Create database: `turso db create wfh-planner`
5. Get credentials:
   ```bash
   turso db show wfh-planner --url
   turso db tokens create wfh-planner
   ```

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable OAuth consent screen
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### 4. Environment Variables

Copy `.env.local` and fill in your values:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
AUTH_SECRET=generate-with-openssl-rand-base64-32
AUTH_URL=http://localhost:3000
```

### 5. Push database schema

```bash
npm run db:push
```

### 6. Run development server

```bash
npm run dev
```

## Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_SECRET`
   - `AUTH_URL` (your production URL)
4. Update Google OAuth redirect URI to `https://your-app.vercel.app/api/auth/callback/google`
5. Deploy

## Usage

1. **Add employees** - Go to Employees page, click "Add Employee"
2. **Set WFH type** - Rotating (default), Permanent WFH/WFO, or Day-Fixed
3. **Reorder rotation** - Use arrows to change rotation order
4. **Generate schedule** - Click "Generate Schedule" on dashboard
5. **Swap employees** - Click one employee, then click another to swap
6. **Configure settings** - Set seats, WFH slots per week, cycle length
