# Dining Passport — Claude Context Document

This file is the canonical context handoff for Claude Code sessions.
Read this at the start of every new session before making any changes.

---

## 1. File Structure

```
dietary-passport-v3/
├── docs/
│   └── CLAUDE_CONTEXT.md          ← this file
├── app/
│   ├── globals.css                 ← design tokens, btn-primary, passportPulse
│   ├── layout.tsx                  ← root layout, Inter font, metadata
│   ├── page.tsx                    ← Screen 00: Welcome / landing
│   ├── onboarding/
│   │   ├── role/page.tsx           ← Screen 01: Role selection
│   │   ├── account-creation/page.tsx ← Screen 02: Account creation + validation
│   │   ├── allergens/page.tsx      ← Screen 03: Allergen selection (Step 1 of 3)
│   │   ├── preferences/page.tsx    ← Screen 04: Dietary preferences (Step 2 of 3)
│   │   ├── severity/page.tsx       ← Screen 05: Severity + notes (Step 3 of 3)
│   │   └── preview/page.tsx        ← Screen 06: Passport preview before save
│   ├── student/
│   │   ├── home/page.tsx           ← Screen 07: Student home (fully built)
│   │   ├── passport/page.tsx       ← placeholder
│   │   └── edit/page.tsx           ← placeholder
│   ├── staff/
│   │   ├── scan/page.tsx           ← placeholder
│   │   └── profile/[token]/page.tsx ← placeholder
│   ├── admin/
│   │   ├── dashboard/page.tsx      ← placeholder
│   │   └── students/[id]/page.tsx  ← placeholder
│   └── passport/
│       └── [token]/page.tsx        ← public passport view (no auth), placeholder
├── lib/
│   ├── useRoleGuard.ts             ← role-based page guard hook
│   ├── useAuthRedirect.ts          ← post-login routing hook
│   └── supabaseClient.ts           ← Supabase JS client
├── types/
│   └── index.ts                    ← shared TypeScript types
├── sql/
│   └── schema.sql                  ← Supabase DB schema
├── tailwind.config.cjs
├── tsconfig.json
├── next.config.js
├── postcss.config.cjs
└── package.json
```

---

## 2. Design System

### Font
- **Family:** Inter (via Google Fonts import in globals.css)
- **Weights loaded:** 400, 600, 700
- **Fallback stack:** `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`

### Colors

#### Brand
| Token | Hex | Usage |
|---|---|---|
| Primary green | `#1A7A5E` | Buttons, borders (selected), accent |
| Primary green dark | `#155f49` | Button hover |
| Primary light | `#F0FAF7` | Selected card background, tints |
| Primary lighter | `#E8F5F1` | Icon bubbles (selected) |

#### Semantic
| Token | Hex | Usage |
|---|---|---|
| Danger / Must avoid | `#DC2626` | Tier 1 allergens, error states |
| Danger bg | `#FEF2F2` / `#FFF5F5` | Tier 1 card backgrounds |
| Danger border | `#FECACA` / `#FEE2E2` | Tier 1 borders |
| Danger text dark | `#991B1B` | Tier 1 pill text |
| Warning / Try to avoid | `#D97706` | Tier 2, amber states |
| Warning bg | `#FFFBEB` / `#FEF3C7` | Tier 2 backgrounds |
| Warning border | `#FDE68A` | Tier 2 borders |
| Warning text dark | `#92400E` | Tier 2 pill text |
| Safe / Preference | `#16A34A` | Tier 3, safe states |
| Safe bg | `#F0FDF4` / `#DCFCE7` | Tier 3 backgrounds |
| Safe border | `#BBF7D0` | Tier 3 borders |
| Safe text dark | `#166534` | Tier 3 pill text |
| Staff green bg | `#F0FAF7` | Staff instruction cards |
| Staff green border | `#D1FAE5` | Staff instruction borders |
| Staff green text | `#065F46` | Staff instruction text |

#### Neutrals
| Token | Hex | Usage |
|---|---|---|
| Text primary | `#111827` | Headings, body text |
| Text secondary | `#6B7280` | Subtitles, secondary text |
| Text tertiary | `#9CA3AF` | Labels, helper text |
| Text muted | `#D1D5DB` | Disabled, placeholder arrows |
| Background | `#FFFFFF` | Page / card backgrounds |
| Surface | `#F8FAFB` | Page bg (home screen), icon bubbles |
| Surface mid | `#F3F4F6` | Dividers, subtle backgrounds |
| Border | `#E5E7EB` | Default card/input borders |
| Border light | `#F3F4F6` | Section dividers |

### Border Radius
| Context | Value |
|---|---|
| Cards (standard) | `12px` |
| Cards (large) | `14px` |
| Cards (passport sheet) | `16px` |
| Inputs | `10px` (inline style) / `8px` (.input class) |
| Buttons (primary) | `12px` (rounded-xl via Tailwind) |
| Passport button | `14px` |
| Pills / badges | `99px` |
| Icon squares | `10px` |
| Small badges | `6px` |
| Bottom sheets | `20px 20px 0 0` |

### Spacing
- Max content width: `430px` (mobile-first)
- Page horizontal padding: `20px` (home) / `24px` (onboarding)
- Section top padding: `14px–16px`

### Global CSS Classes
```css
.btn-primary       /* bg-primary, text-white, rounded-xl, py-4, w-full, text-base */
.card              /* border-radius: 12px */
.input             /* border-radius: 8px */

@keyframes passportPulse  /* box-shadow pulse only — fill color never changes */
```

### Path Alias
`@/*` maps to the project root (`./`). Configured in `tsconfig.json`.

---

## 3. Screens Built

### Screen 00 — Welcome
- **Route:** `/`
- **File:** `app/page.tsx`
- **Status:** Complete
- **Description:** Landing screen. Logo mark, tagline, three feature cards (green/blue/amber icons), "Get started" CTA → `/onboarding/role`, "Sign in" link → `/auth/signin`, footer text. No auth required.

### Screen 01 — Role Selection
- **Route:** `/onboarding/role`
- **File:** `app/onboarding/role/page.tsx`
- **Status:** Complete
- **Description:** Three role cards (Student / Dining Hall Staff / Admin / Dietitian). Selected role saved to `localStorage['selectedRole']` using exact strings `'Student'`, `'Dining Hall Staff'`, `'Admin / Dietitian'`. Student pre-selected. Logo mark at top.

### Screen 02 — Account Creation
- **Route:** `/onboarding/account-creation`
- **File:** `app/onboarding/account-creation/page.tsx`
- **Status:** Complete
- **Description:** Step 1 of 2. Full name, email, password, confirm password (all required), university/institution (optional). Inline blur-triggered validation. On submit saves `userName`, `userEmail`, `userUniversity` to localStorage. Routes based on role: Student → `/onboarding/allergens`, Staff → `/staff/scan`, Admin → `/admin/dashboard`.

### Screen 03 — Allergen Selection
- **Route:** `/onboarding/allergens`
- **File:** `app/onboarding/allergens/page.tsx`
- **Status:** Complete
- **Description:** Step 1 of 3 (student onboarding). 2-column grid of 9 allergen cards + "Other allergen" row. Selected count. Skip link. Saves `selectedAllergens: string[]` to localStorage. Prunes `restrictionDetails` when selection changes. Restores on back navigation.

### Screen 04 — Dietary Preferences
- **Route:** `/onboarding/preferences`
- **File:** `app/onboarding/preferences/page.tsx`
- **Status:** Complete
- **Description:** Step 2 of 3. Two sections: Lifestyle (4 rows) and Religious / cultural (2 rows) + "Other preference" row. Always-enabled CTA. Saves `selectedPreferences: string[]`. Prunes `restrictionDetails` on change. Restores on back navigation.

### Screen 05 — Severity & Notes
- **Route:** `/onboarding/severity`
- **File:** `app/onboarding/severity/page.tsx`
- **Status:** Complete
- **Description:** Step 3 of 3. One card per restriction from allergens + preferences. Each card: tier selector (3 options, null until chosen), cross-contact toggle (off by default), staff note textarea. CTA disabled until every card has a tier set. Saves `restrictionDetails: RestrictionDetail[]`. Merges with existing saved data on back navigation (preserves configured cards, new cards start blank).

### Screen 06 — Passport Preview
- **Route:** `/onboarding/preview`
- **File:** `app/onboarding/preview/page.tsx`
- **Status:** Complete
- **Description:** Final onboarding step before save. Renders a "Dining Passport card" showing exactly what staff will see: must avoid pills (red), cross-contact banner, try to avoid pills (amber), preference pills (green), staff notes, staff instruction bar. Save button writes `profileSaved: 'true'` and `profileCreatedAt` ISO timestamp, then routes to `/student/home`.

### Screen 07 — Student Home
- **Route:** `/student/home`
- **File:** `app/student/home/page.tsx`
- **Status:** Complete
- **Sections built:**
  - **Header** — time-based greeting, student name, dynamic profile pill (4 states: tier1+crossContact → red, tier1 only → amber, restrictions but no tier1 → green, empty → gray)
  - **Show Passport button** — full-width green CTA with `passportPulse` box-shadow animation. Opens passport sheet.
  - **Where to Eat** — 4 mock dining hall cards (Lipton, Palladium, Kimmel, Downstein) with safe/limited/unsafe status, safe item count, hours, time badge. Opens dining detail sheet.
  - **Your Profile** — restriction list sorted tier 1→2→3, edit buttons, empty state. Quick action grid: Edit Profile + Share Profile (clipboard toast).
  - **Footer** — formatted `profileCreatedAt` date.
  - **Passport bottom sheet** — Show Screen tab (must avoid, cross-contact banner, try to avoid, preference, staff notes, staff instructions) + Show QR tab (QRCodeSVG, student name, instruction box, must avoid summary). Green header, tab switcher, green bottom bar.
  - **Dining hall detail sheet** — slides up on card tap, shows safe menu items list, "Safe" badges, coming soon note.
  - **Toast** — fixed-position pill on clipboard copy.

---

## 4. Data Model (localStorage)

All data is stored in `localStorage`. No server persistence yet — Supabase integration is planned but not wired.

### Keys and Shapes

```typescript
// Role selected on Screen 01
localStorage['selectedRole']: 'Student' | 'Dining Hall Staff' | 'Admin / Dietitian'

// User profile from Screen 02
localStorage['userName']: string            // e.g. "Jane Smith"
localStorage['userEmail']: string           // e.g. "jane@nyu.edu"
localStorage['userUniversity']: string      // e.g. "New York University"

// Screen 03 output
localStorage['selectedAllergens']: string   // JSON: string[]
// e.g. '["Peanuts","Milk / dairy","Custom allergen"]'
// Known names: 'Peanuts' | 'Tree nuts' | 'Shellfish' | 'Fish' |
//              'Milk / dairy' | 'Eggs' | 'Wheat / gluten' | 'Soy' | 'Sesame'
// Custom text appended at end if "Other" was filled in.

// Screen 04 output
localStorage['selectedPreferences']: string  // JSON: string[]
// e.g. '["Vegan","Halal"]'
// Known names: 'Vegan' | 'Vegetarian' | 'Keto / low-carb' |
//              'Gluten-free (preference)' | 'Halal' | 'Kosher'
// Custom text appended at end if "Other" was filled in.

// Screen 05 output
localStorage['restrictionDetails']: string  // JSON: RestrictionDetail[]

// RestrictionDetail shape:
type RestrictionDetail = {
  name: string                              // restriction name (from allergens or preferences)
  emoji: string                             // mapped emoji character
  category: 'allergen' | 'preference'
  tier: 1 | 2 | 3 | null                  // null = not yet configured
  crossContact: boolean
  staffNote: string
}

// Screen 06 output
localStorage['profileSaved']: 'true'        // set on passport save
localStorage['profileCreatedAt']: string    // ISO timestamp e.g. "2026-04-02T14:30:00.000Z"
```

### Cascade Pruning Rules
When allergens change (Screen 03 → continue or skip):
- `restrictionDetails` is pruned to remove entries not in the new `selectedAllergens` + current `selectedPreferences`.

When preferences change (Screen 04 → continue or skip):
- `restrictionDetails` is pruned to remove entries not in current `selectedAllergens` + new `selectedPreferences`.

### Emoji Map (canonical)
```typescript
'Peanuts'                 → '🥜'
'Tree nuts'               → '🌰'
'Shellfish'               → '🦐'
'Fish'                    → '🐟'
'Milk / dairy'            → '🥛'
'Eggs'                    → '🥚'
'Wheat / gluten'          → '🌾'
'Soy'                     → '🫘'
'Sesame'                  → '🌱'
'Vegan'                   → '🌿'
'Vegetarian'              → '🥗'
'Keto / low-carb'         → '🥑'
'Gluten-free (preference)'→ '🌾'
'Halal'                   → '☪️'
'Kosher'                  → '✡️'
default                   → '🍽️'
```

---

## 5. Tech Stack & Architecture

### Stack
| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript | 5.9.3 |
| UI | React | 18.2.0 |
| Styling | Tailwind CSS | 3.4.1 |
| Backend (planned) | Supabase | @supabase/supabase-js ^2.0.0 |
| QR codes | qrcode.react | 3.1.0 |

### Key Architectural Decisions

**1. Role strings are verbose, not slugs.**
Roles are stored exactly as `'Student'`, `'Dining Hall Staff'`, `'Admin / Dietitian'` — not slugs like `'student'`. This matches what the UI renders and avoids a mapping layer. Do not normalize these.

**2. localStorage-first, Supabase later.**
All data flows through `localStorage` during the current build phase. The `supabaseClient.ts` exists but is not yet wired to any screen. When Supabase is added, localStorage becomes a cache/fallback, not the source of truth.

**3. All localStorage reads are inside `useEffect`.**
Every screen that reads from `localStorage` does so inside `useEffect` to avoid Next.js SSR hydration errors. Never read `localStorage` at the module level or in initial state.

**4. `useRoleGuard` on every protected page.**
Every student/staff/admin page calls `useRoleGuard('Student' | 'Dining Hall Staff' | 'Admin / Dietitian')` at the top of the component. This reads `selectedRole` from localStorage and redirects mismatched users. The public `/passport/[token]` route is the only page that skips this.

**5. Tier type is `1 | 2 | 3 | null`.**
`null` means "not yet configured by the student." The severity screen enforces that all cards must have a non-null tier before the CTA enables. When re-visiting severity after a back navigation, previously configured cards restore their tier; new cards start as `null`.

**6. No `@/` alias was originally configured.**
The `@/*` path alias was added to `tsconfig.json` during this session. Use `@/lib/...`, `@/types`, etc. for imports. Older files may still use relative paths — both work.

**7. Inline styles over Tailwind for dynamic values.**
All dynamic/conditional styles (hover states, selected states, tier-based colors) use inline `style` props. Tailwind is used for static utility classes (`flex`, `gap-*`, `text-*`, `font-*`, etc.) and the `.btn-primary` global class. Never use Tailwind's `style=` for runtime-computed values.

**8. `passportPulse` animation is box-shadow only.**
The animation on the Show Passport button pulses `box-shadow` only. The fill color `#1A7A5E` never changes during animation. Hover/active states are managed via `onMouseEnter/Leave/Down/Up` handlers writing directly to `e.currentTarget.style`.

**9. Bottom sheets use `onClick e.stopPropagation()`.**
Both the passport sheet and dining hall detail sheet use `e.stopPropagation()` on the sheet `div` to prevent overlay click-through. The overlay sits at z-40, the sheet at z-50.

**10. `qrcode.react` requires a `mounted` guard.**
`QRCodeSVG` from `qrcode.react` must only render client-side. Use a `mounted` boolean state set in a separate `useEffect(() => { setMounted(true) }, [])`. Render a same-sized placeholder div when `!mounted`.

---

## 6. What Still Needs to Be Built

### Student Flow
| Screen | Route | Description |
|---|---|---|
| Screen 08 | `/student/edit` | Edit dietary profile — re-run through allergens/preferences/severity flow with existing data pre-populated |
| Screen 09 | `/student/passport` | Standalone passport view (same content as passport sheet, full page) |

### Staff Flow
| Screen | Route | Description |
|---|---|---|
| Staff Home | `/staff/scan` | QR scanner using device camera. Scan student QR → decode token → fetch profile |
| Staff Profile View | `/staff/profile/[token]` | Full student dietary profile view after scanning — same layout as student passport but read-only, optimized for staff reading speed. Shows must avoid prominently. |

### Admin Flow
| Screen | Route | Description |
|---|---|---|
| Admin Dashboard | `/admin/dashboard` | List of all students at the institution, search/filter, summary stats |
| Admin Student Detail | `/admin/students/[id]` | Full profile view for a specific student, ability to add notes or flags |

### Public Route
| Screen | Route | Description |
|---|---|---|
| Public Passport | `/passport/[token]` | No-auth public URL. Token decoded server-side (or client-side from Supabase). Shows full dietary profile in read-only format. This is what the QR code links to. |

### Auth Screens (not yet started)
| Screen | Route | Description |
|---|---|---|
| Sign In | `/auth/signin` | Email + password login. Role-based post-login redirect via `useAuthRedirect`. |
| Sign Up | `/auth/signup` | Alternative entry point (vs. onboarding flow) |

### Infrastructure Still Needed
- **Supabase auth wiring** — connect account creation form to `supabase.auth.signUp()`. Save user profile to `users` table after sign-up. Wire `useRoleGuard` to check Supabase session, not just localStorage.
- **QR token generation** — create a token in Supabase `qr_tokens` table on profile save. Use token as the QR code value URL parameter.
- **Real menu API** — replace `MOCK_DINING_HALLS` in `student/home/page.tsx` with a real data source.
- **Profile persistence** — on "Save my passport" (Screen 06), write `restrictionDetails` to Supabase `dietary_profiles` and `restrictions` tables.
- **Edit flow** — Screen 08 (`/student/edit`) must pre-populate allergens/preferences/severity from either localStorage or Supabase, then re-save on complete.
