# Skeleton Loading - Quick Start Guide ⚡

## 30-Second Implementation

### 1. Import the Component
```tsx
import { RecentJobsSkeleton } from "../src/components/SkeletonLoader";
```

### 2. Replace Loading State
```tsx
// Before ❌
{isLoading && <ActivityIndicator />}

// After ✅
{isLoading && <RecentJobsSkeleton count={3} />}
```

### 3. Done! 🎉
That's it. Your loading state now looks professional and smooth.

---

## Common Patterns

### Pattern 1: Stats/Dashboard Cards
```tsx
import { YourHiringsSkeleton } from "../src/components/SkeletonLoader";

{isLoading ? <YourHiringsSkeleton /> : <StatsCards />}
```

### Pattern 2: Job Listings
```tsx
import { RecentJobsSkeleton } from "../src/components/SkeletonLoader";

{isLoading ? <RecentJobsSkeleton count={5} /> : <JobsList />}
```

### Pattern 3: Profile Screen
```tsx
import { ProfileHeaderSkeleton, ListItemSkeleton } from "../src/components/SkeletonLoader";

{isLoading ? (
  <>
    <ProfileHeaderSkeleton />
    <ListItemSkeleton />
    <ListItemSkeleton />
    <ListItemSkeleton />
  </>
) : (
  <ProfileContent />
)}
```

### Pattern 4: Search Results
```tsx
import { JobCardSkeleton } from "../src/components/SkeletonLoader";

{isLoading ? (
  <View style={{ gap: 12 }}>
    <JobCardSkeleton />
    <JobCardSkeleton />
    <JobCardSkeleton />
  </View>
) : (
  <SearchResults />
)}
```

---

## Available Components

### Most Used (Start Here)
- `YourHiringsSkeleton` - Stats cards
- `RecentJobsSkeleton` - Job listings
- `JobCardSkeleton` - Single job card
- `ListItemSkeleton` - Generic list item
- `ProfileHeaderSkeleton` - User profile header

### Forms & Search
- `FormFieldSkeleton` - Input fields
- `SearchBarSkeleton` - Search bar
- `CardSkeleton` - Content cards

### Grids & Categories
- `GridItemSkeleton` - Category items

### Advanced
- `FullScreenSkeleton` - Entire screen
- `HeroSkeleton` - Hero banners

---

## Want Premium Shimmer?

Just change the import:

```tsx
// Simple pulse (default)
import { RecentJobsSkeleton } from "../src/components/SkeletonLoader";

// Premium shimmer ✨
import { RecentJobsSkeletonShimmer } from "../src/components/SkeletonShimmer";
```

Everything else stays the same!

---

## Build Custom Skeleton

```tsx
import { Skeleton, SkeletonCircle } from "../src/components/SkeletonLoader";

function MyCustomSkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <SkeletonCircle size={50} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="70%" height={20} />
          <Skeleton width="50%" height={16} />
        </View>
      </View>
      <Skeleton width="100%" height={100} borderRadius={12} />
    </View>
  );
}
```

---

## Advanced: Prevent Flashing

If data loads too fast (< 300ms), use this hook:

```tsx
import { useMinimumLoadingTime } from "../src/hooks/useMinimumLoadingTime";
import { RecentJobsSkeleton } from "../src/components/SkeletonLoader";

function MyScreen() {
  const { data, isLoading } = useQuery({ ... });
  
  // Ensures skeleton shows for at least 500ms
  const showSkeleton = useMinimumLoadingTime(isLoading, 500);
  
  if (showSkeleton) return <RecentJobsSkeleton />;
  return <Content data={data} />;
}
```

---

## Cheat Sheet

### Import Path
```tsx
// Pulse animation (default)
import { ComponentName } from "../src/components/SkeletonLoader";

// Shimmer animation (premium)
import { ComponentNameShimmer } from "../src/components/SkeletonShimmer";

// Hooks
import { useMinimumLoadingTime } from "../src/hooks/useMinimumLoadingTime";
```

### Replace This
```tsx
{isLoading && (
  <View style={{ padding: 40, alignItems: "center" }}>
    <ActivityIndicator size="large" color={colors.green} />
  </View>
)}
```

### With This
```tsx
{isLoading && <RecentJobsSkeleton count={3} />}
```

---

## Need More Help?

📚 **Full Documentation:**
1. `SKELETON_LOADING_STRATEGY.md` - Complete strategy guide
2. `SKELETON_EXAMPLES.md` - Code examples for every scenario
3. `README_SKELETON.md` - API reference
4. `BEFORE_AFTER_SKELETON.md` - Visual comparisons

💡 **Live Example:**
- See `mobile/app/provider-home.tsx` for real implementation

---

## That's It!

You're now ready to create beautiful loading states. Start with the common patterns above and customize as needed.

**Happy coding!** 🚀

---

**Built with ❤️ for Bulao**
