# Aquatic Solutions IMS

## Overview
Project management and job tracking system for Aquatic Solutions, ported from ASP.NET/Azure to Next.js/Supabase/Vercel.

## Tech Stack
- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Database:** Supabase (PostgreSQL)
- **UI:** shadcn/ui, Tailwind CSS 4, Lucide icons
- **Hosting:** Vercel
- **Package Manager:** pnpm

## Key Commands
- `pnpm dev` - start dev server
- `pnpm build` - production build
- `pnpm lint` - run ESLint

## Project Structure
- `app/` - Next.js pages and API routes
- `app/api/` - Backend API endpoints (Supabase queries)
- `components/` - React components (shadcn/ui in `components/ui/`)
- `lib/` - Utilities
- `hooks/` - React hooks
- `styles/` - Global CSS

## Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (used by migration column-config)

## Database Tables
- `jobs` - Main job/project records (keyed by enquiry_id)
- `events` - Tasks/events linked to jobs
- `clients` - Client businesses
- `contacts` - Client contacts
- `job_types` - Job type lookup
- `job_classes` - Job class lookup
- `parameters` - System config

## Notes
- Company ID is hardcoded to 6 (single-tenant)
- No authentication currently implemented
- TypeScript build errors are ignored in next.config.mjs
