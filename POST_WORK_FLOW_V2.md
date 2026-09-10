# KaamNow — Post Work Flow v2

## Overview

The Post Work flow is a 6-step guided experience for providers to post job listings. Each step groups 2-3 related decisions, maintaining simplicity while reducing the total number of screens compared to traditional form-heavy approaches.

## Design Principles

1. **Group by decision, not by field** — "Where + which spot on the map" is one decision, not separate screens
2. **Show the answer as a plain sentence** — Every step ends with a recap that confirms choices in natural language
3. **Every choice is visibly editable** — Pencil icons (✏️) next to values teach users "I can tap this and change it"
4. **Progress dots** — 6 soft dots show progress, tappable backward only
5. **No dead ends** — Every screen has defaults that let users move forward without filling everything
6. **One primary action per screen** — "Next" button always in the same position (bottom, thumb reach)

## The 6 Steps

### Step 1: Category + Role
**File:** `/mobile/app/post-work/index.tsx`

- **Decisions:** Category (5 icon tiles) → Role (chips that appear after category selection)
- **Special:** No manual "Next" button — two taps and you glide into Step 2
- **Recap:** "Construction → Painter" with pencil icons on each part

### Step 2: What & How Many
**File:** `/mobile/app/post-work/details.tsx`

- **Decisions:**
  - Title (pre-filled, editable, with mic button)
  - Workers needed (stepper: − 1 +)
  - Experience level (3 chips: Any 🌱, Some 🙂, Expert 🏅)
- **Recap:** "Painters needed, 2 people, any experience."

### Step 3: Where
**File:** `/mobile/app/post-work/location.tsx`

- **Decisions:**
  - Pick a place:
    - 📍 Use current location (GPS, one tap)
    - ⭐ Saved places (if any exist, show as chips: "Home," "Shop," etc.)
    - 🗺️ Pick on map (opens map, drop pin, drag to adjust)
  - Confirm locality (editable: "Miyapur — ✏️ change")
  - Exact address (optional, collapsed by default)
  - Save this place? (checkbox/chip: "⭐ Save as [Home/Shop/Site/Other]")
- **Recap:** "Miyapur (Site 2) — near XYZ landmark"

**Key feature:** Saved places reward repeat providers — first post uses GPS/map, subsequent posts are one-tap.

### Step 4: When (Schedule)
**File:** `/mobile/app/post-work/schedule.tsx`

- **Decisions:**
  - Start date (helper chips: Today · Tomorrow · Pick a date)
  - How long:
    - One day → done
    - Few days → shows "to" date picker + live sentence: "15 Sep → 20 Sep (6 days)"
    - Ongoing → shows: "Starts 15 Sep, no end date — you can close this job anytime."
  - Working hours:
    - Full day → shows: "Full day (as agreed)"
    - Custom hours → two time wheels (start/end), with live duration: "9 AM–5 PM (8 hours)"
- **Recap:** "Starts tomorrow, one day, 9 AM–5 PM." or "Starts 15 Sep, ongoing, full day."

**Key feature:** Live-updating sentences make the schedule concrete and reassuring.

### Step 5: Pay + Extras
**File:** `/mobile/app/post-work/pay.tsx`

- **Decisions:**
  - Amount (number pad, ₹ prefix)
  - Unit (chips: per day / per task / per hour / per week / per month)
  - When paid (chips: After work · Daily · Weekly · Monthly)
  - Extras (collapsed by default):
    - Category-specific extras (Tools/Materials for Construction, Dress code for Events, etc.)
    - Benefits chips (🍽️ Meals / 🚗 Travel / 🏨 Stay)
    - Optional photo
    - Optional description with mic button
- **Recap:** "₹1,000/day, paid daily. 2 extras added."

### Step 6: Review & Post
**File:** `/mobile/app/post-work/review.tsx`

- Shows the full job card, exactly as seekers will see it
- Every line has a pencil icon (✏️) — tapping jumps to the step that made it
- One big button: **Post job**
- Reassurance line: "💡 You can edit or close this job anytime after posting."
- Progress dots at bottom (6 filled)

## Backend API

### New Endpoint: Saved Places

**File:** `/backend/src/modules/locations/saved-places.ts`

- `GET /saved-places` — Get all saved places for the user (ordered by last_used_at)
- `POST /saved-places` — Create a new saved place
- `PATCH /saved-places/:id/use` — Update last_used_at timestamp
- `DELETE /saved-places/:id` — Delete a saved place

### Database Schema Addition

**File:** `/backend/src/db/schema.ts`

```typescript
export const savedPlaces = sqliteTable("saved_places", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  label: text("label").notNull(), // Home, Shop, Site, or custom name
  icon: text("icon").notNull().default("📍"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  locality: text("locality").notNull(),
  address: text("address").notNull().default(""),
  lastUsedAt: integer("last_used_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

**Migration:** `/backend/migrations/0006_add_saved_places.sql`

### Updated Jobs Schema

The existing `jobs` table already supports the new fields from v2:
- `experience` (any/some/expert)
- `duration` (one/few/ongoing)
- `endsAt` (for "few days")
- `hours` (full/custom)
- `startTime`, `endTime` (for custom hours)
- `paidWhen` (after/daily/weekly/monthly)
- `extras` (JSON array)

## Mobile App Structure

```
mobile/
├── app/
│   └── post-work/
│       ├── _layout.tsx          # Stack navigator for the flow
│       ├── index.tsx            # Step 1: Category + Role
│       ├── details.tsx          # Step 2: What & How Many
│       ├── location.tsx         # Step 3: Where
│       ├── schedule.tsx         # Step 4: When
│       ├── pay.tsx              # Step 5: Pay + Extras
│       └── review.tsx           # Step 6: Review & Post
└── src/
    ├── api/
    │   └── savedPlaces.ts       # API client for saved places
    └── features/
        └── post-work/
            └── store.ts         # Zustand store for flow state

```

## State Management

**Store:** `/mobile/src/features/post-work/store.ts`

Uses Zustand to manage flow state across all 6 steps. Key features:
- Persists data as user navigates between steps
- Allows jumping to any previous step for editing
- Resets on flow completion

## Key UI Components

All screens use the existing design system from `/mobile/src/components/ui.tsx`:
- `Screen` — Consistent layout with back button and title
- `Button` — Primary action (always "Next" except final "Post job")
- `Chip` — Multi-select and single-select options
- `Card` — Review screen uses accent card for the job preview
- `Copy` — Body text for instructions
- Custom components:
  - Stepper (workers count in Step 2)
  - Location tiles (Step 3)
  - Date/time pickers (Step 4)
  - Collapsible extras section (Step 5)
  - Editable recap rows (Step 6)

## Icon Language

| Element | Icon | Meaning |
|---------|------|---------|
| Editable value | ✏️ | Tap to jump back and edit |
| Saved place | ⭐ | User's saved location |
| Current location | 📍 | GPS location |
| Map picker | 🗺️ | Drop a pin |
| Mic input | 🎤 | Voice input option |
| Meals benefit | 🍽️ | Food provided |
| Travel benefit | 🚗 | Transport covered |
| Stay benefit | 🏨 | Accommodation included |
| Experience levels | 🌱🙂🏅 | Any / Some / Expert |

## Navigation Flow

```
/post-work (Step 1)
  ↓
/post-work/details (Step 2)
  ↓
/post-work/location (Step 3)
  ↓
/post-work/schedule (Step 4)
  ↓
/post-work/pay (Step 5)
  ↓
/post-work/review (Step 6)
  ↓
Submit → /provider-home
```

Any step can jump back by tapping the back arrow or tapping an editable field in the recap/review.

## Dependencies Added

**Mobile:**
- `@react-native-community/datetimepicker` — For date and time selection in Step 4
- `expo-location` — Already installed, used for GPS location in Step 3
- `zustand` — Already installed, used for state management

**Backend:**
- No new dependencies required

## Installation & Setup

### Backend

1. Apply the database migration:
```bash
cd backend
# Run migration 0006_add_saved_places.sql
```

2. Register the saved places routes in your main router:
```typescript
import { savedPlacesRoutes } from "./modules/locations/saved-places";

app.route("/saved-places", savedPlacesRoutes);
```

### Mobile

1. Install dependencies:
```bash
cd mobile
pnpm install
```

2. For iOS, install pods:
```bash
cd ios
pod install
```

3. Run the app:
```bash
pnpm start
```

## Testing the Flow

1. Start from the provider home screen
2. Tap "Post Work" button (you may need to add this button)
3. Complete all 6 steps:
   - Select category and role
   - Enter details (title, workers, experience)
   - Choose or save a location
   - Set schedule (date, duration, hours)
   - Enter pay and optional extras
   - Review and post

4. After posting, verify:
   - Job appears in your posted jobs list
   - Saved places persist for next post (if you saved one)
   - All job details are correctly stored

## What This Flow Solves

1. **Faster repeat posting** — Saved places make posting 5 jobs a week fast instead of tedious
2. **Lower anxiety** — Live recaps, edit icons, and "you can change this later" text make decisions feel safe
3. **Mobile-first design** — Every screen is thumb-reachable, 2-3 taps max per step
4. **Low-literacy friendly** — Plain sentences confirm choices without requiring re-reading forms
5. **Complete yet light** — 6 steps capture all needed data without feeling like a long form

## Future Enhancements

- **Photo upload** — Currently shows a button but doesn't implement upload
- **Map picker** — Currently shows an alert; needs actual map integration
- **Voice input** — Mic buttons shown but need speech-to-text integration
- **Draft saving** — Auto-save progress if user exits mid-flow
- **Templates** — Let repeat posters save job templates for even faster posting
- **Bulk posting** — Post multiple similar jobs with minor variations

## Notes

- All screens are designed for mobile-first experience
- Desktop/web layout will need responsive adjustments
- Saved places are user-specific, not shared across accounts
- The flow uses optimistic defaults (e.g., "Painter needed" auto-fills title)
- Validation happens at each step, not just at the end
- Backend rate limiting (30 posts per day) already exists in the jobs route

---

**Version:** 2.0  
**Last Updated:** January 2025  
**Status:** ✅ Implementation Complete
