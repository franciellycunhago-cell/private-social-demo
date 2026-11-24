# PrivateSocial — Full-Stack Social Platform PWA

A production-grade private social network built as a full-stack case study. Members join by invite only, verify identity via selfie review, and interact through a mobile-first PWA — no app store required.

> **Status:** Live in production with paying subscribers

---

## Technical Highlights

This project was built from scratch and pushed to production. Key engineering decisions:

- **Next.js 16 App Router** with React Server Components and Server Actions throughout
- **Supabase** — 40+ Row Level Security policies ensuring users can only see data they're allowed to
- **PostGIS** — geolocation-based member discovery ("Radar" feature)
- **Asaas payment gateway** — Pix + Credit Card with webhook reconciliation
- **2FA TOTP** for admin panel (otplib + QR code enrollment flow)
- **Per-viewer watermark** — every photo served through `/api/token-imagem` embeds a unique token per viewer, enabling leak tracing
- **Web Push API** (VAPID) — native push notifications without an app
- **PWA** — installable, works offline, custom service worker
- **LGPD compliance** — soft delete with 30-day grace period, purge cron, data export
- **Rate limiting** — per-IP and per-user middleware
- **Cloudflare Turnstile** CAPTCHA on public forms
- **Invite-only registration** — unique codes with usage tracking
- **CI/CD** — Vercel with automatic preview deployments

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript (strict mode) |
| UI | React 19 + Tailwind CSS + Framer Motion |
| Database | Supabase — PostgreSQL + PostGIS |
| Auth | Supabase Auth + custom 2FA (otplib) |
| Payments | Asaas (Pix + Card) |
| Push | Web Push API — VAPID (web-push) |
| PWA | Service Worker + Web App Manifest |
| Storage | Supabase Storage (private buckets) |
| Hosting | Vercel |

---

## Architecture

```
Browser (PWA / installable)
    ↓
Next.js App Router
  ├── Server Components  — data fetching, RLS-protected queries
  ├── Server Actions     — mutations, payment webhooks
  └── API Routes         — push subscribe, image generation, auth callbacks
    ↓
Supabase
  ├── PostgreSQL + PostGIS
  ├── 40+ RLS policies   — row-level data isolation
  ├── Realtime           — live chat updates
  └── Storage            — private photo buckets
```

---

## Key Features

### For Users
- Invite-only registration with selfie identity verification
- Profile with public + private photo sections
- Geolocation radar — discover nearby members
- Real-time chat / conversations
- Stories with per-viewer watermark tracking
- Event discovery and RSVP
- VIP subscription (Pix or Card)
- Push notifications (no app install required)
- Full LGPD account deletion with grace period

### For Admin
- 2FA-protected admin panel
- Member approval queue (selfie review)
- Moderation / reports dashboard
- Event management
- Push notification broadcast
- Subscription management

---

## Security Model

**Row Level Security:** every table has RLS enabled. A user querying `profiles` only sees rows where the target profile has not blocked them, has an active account, and has passed verification. This is enforced at the database level — not just in application code.

**Photo watermarking:** private photos are never served directly. The server generates a PNG overlay with a unique token per viewer. If a photo leaks, the token traces back to which account shared it.

**Rate limiting:** registration, login, and invite redemption endpoints are rate-limited per IP using a Redis-compatible counter in Supabase.

---

## Environment Variables

```bash
cp .env.example .env.local
```

See `.env.example` for all required variables (Supabase, Asaas, VAPID keys, Turnstile).

---

## Author

**Francielly Cunhago** — Digital Product Builder
- GitHub: [github.com/franciellycunhago-cell](https://github.com/franciellycunhago-cell)
- LinkedIn: [linkedin.com/in/franciellymeira](https://linkedin.com/in/franciellymeira)

---

## License

Private client project — source shared for portfolio purposes. Not licensed for reuse.
