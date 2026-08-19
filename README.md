# DietKu

DietKu is a calorie and nutrition tracker for iOS and Android. Scan a meal with the camera, log food and exercise, track daily macros, and share progress in community groups.

The UI is bilingual (Bahasa Indonesia by default, plus English). App version is **1.0.18** (`app.json`).

- **iOS:** `app.rork.dietku-clone-jlejfwy` · build 36 · App Store Apple ID `6761396062`
- **Android:** `app.rork.dietku_clone_jlejfwy` · versionCode 34
- **Repo:** https://github.com/ktimothybudi-source/DietKu

## Features

- **AI meal scan** — Camera or gallery photo, analyzed with OpenAI. Free users are limited to **3 scans per day**; bypass accounts live in `public.ai_scan_quota_bypass`.
- **Food diary** — Log meals, calories, protein, carbs, fat, micronutrients, and water. Favorites and recent meals are stored in Supabase.
- **Manual food search** — App food database plus optional USDA FoodData Central.
- **Meal builder** — Combine items into a custom meal before logging.
- **Exercise** — Log workouts; the backend can estimate calories from a text description.
- **Dashboard & analytics** — Daily totals, progress charts, weight history, streaks.
- **Community** — Groups, invites, posts, likes, comments, and daily progress shares.
- **Story share** — Export progress images (Instagram Stories is queried on iOS).
- **Reminders** — Local daily food-scan reminders plus Expo push when a group member logs a meal.
- **Auth** — Email/password and Google OAuth via Supabase. Referral codes can be stashed at sign-in.
- **Referrals & affiliates** — In-app referral flow plus a separate Next.js affiliate dashboard (`affiliate-platform/`).
- **Premium** — RevenueCat subscriptions (monthly/yearly). Paid gates are currently off by default (`FREE_FOR_NOW` in `lib/appAccess.ts`); flip with `EXPO_PUBLIC_FREE_FOR_NOW=false`.
- **Account** — Profile, language, theme, restore purchase screen, account deletion.

AI estimates are approximations, not medical advice.

## Stack

| Layer | Tech |
| --- | --- |
| App | Expo 54, React Native 0.81.5, Expo Router 6, TypeScript |
| State | React Query, Zustand, React context (nutrition, theme, language, subscription, notifications) |
| Backend | Hono on port 3000 (`bun start:backend`), tRPC (`/trpc`), REST under `/api/ai`, `/api/account`, `/api/notifications` |
| Database | Supabase (Postgres, Auth, Storage bucket `meal-photos`, RLS) |
| AI | OpenAI (meal photos, exercise estimates, Indonesian↔English food translation, search ranking) |
| Payments | RevenueCat (`premium` entitlement), custom paywall in `components/PremiumPaywallModal.tsx` |
| Push | Expo Notifications, tokens in `user_push_tokens` |

Native pieces that need a **dev client / store build** (not Expo Go): camera, purchases, push, `expo-dev-client`.

## Project layout

```
app/                     Expo Router screens
  (tabs)/                Dashboard, analytics, community, profile
  camera-scan.tsx        AI meal scan
  food-search.tsx        Manual food search
  meal-builder.tsx
  log-exercise.tsx
  onboarding.tsx
  sign-in.tsx
  story-share.tsx        Progress image export
backend/                 Hono + tRPC API
affiliate-platform/      Next.js affiliate site (dashboard, referrals, earnings, leaderboard)
supabase/                schema.sql, rls-policies.sql, migrations/
contexts/                Nutrition, subscription, theme, language, notifications
lib/                     Supabase client, access gates, invites, referrals
utils/                   USDA, scan helpers, dashboard cache, share
```

## Local setup

Needs **Node.js** and **Bun**.

```
git clone https://github.com/ktimothybudi-source/DietKu.git
cd DietKu
bun i
cp .env.example .env
```

Then fill `.env` from `.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (server only)
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `EXPO_PUBLIC_API_BASE_URL` (local: `http://localhost:3000`)
- RevenueCat public SDK keys for iOS/Android
- Optional: `EXPO_PUBLIC_USDA_API_KEY`, referral promo codes, premium email allowlist

```
bun start:backend
bun start
bun run start-web
```

Checks:

```
bun run typecheck
bun run lint
bun run check:env:safety
```

### Supabase

1. Create a project and put URL + anon key in `.env`.
2. Run `supabase/schema.sql`, then `supabase/rls-policies.sql`, then any newer files in `supabase/migrations/`.
3. Create public storage bucket `meal-photos` (policies in `SETUP.md`).
4. Enable Email (and Google OAuth if you use Google sign-in).

Tables include profiles, food/exercise/weight logs, community groups/posts, daily progress shares, push tokens, favorites, water, micronutrients, streaks, and AI scan quota.

### Affiliate site

```
cd affiliate-platform
cp .env.example .env.local
npm install
npm run dev
```

Needs the affiliate tracking migration `supabase/migrations/20260517_affiliate_referral_tracking.sql`.

## Builds (EAS)

`eas.json` profiles: `development` (dev client), `preview` (internal APK / iOS), `production` (Play App Bundle / App Store).

```
bun run build:ios:preview
bun run build:ios:prod
bun run submit:ios:prod

bun run build:android:preview
bun run build:android:prod
bun run submit:android:prod
```

Production iOS auto-increments `ios.buildNumber`. Android production uses local credentials and does not auto-increment `versionCode`.

Set EAS env for preview/production: Supabase URL/anon key, `EXPO_PUBLIC_API_BASE_URL` (HTTPS), RevenueCat keys. Keep `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` on the API host only.

## More docs in this repo

| File | What |
| --- | --- |
| `SETUP.md` | Supabase, OpenAI, USDA, OAuth, backend |
| `EXTERNAL_SETUP_REQUIREMENTS.md` | External checklist |
| `APPSTORE_RELEASE_RUNBOOK.md` | iOS release |
| `PLAYSTORE_RELEASE_RUNBOOK.md` | Android release |
| `IOS_REVENUECAT_SETUP.md` | RevenueCat + Apple IAP |
| `PLAYSTORE_LISTING_TEMPLATE_ID.md` | Play Store copy (ID) |
