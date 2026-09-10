# Skeleton Loading Animation Strategy

## Overview
This document outlines the skeleton loading strategy for optimal user experience when loading data in the mobile app.

## Core Principles

### 1. **Progressive Disclosure**
- Show skeleton immediately (0ms delay)
- Match skeleton layout to actual content
- Maintain consistent spacing and proportions
- Never show blank screens or spinners alone

### 2. **Smooth Animations**
- Pulse animation: 1200ms duration for smooth breathing effect
- Opacity range: 0.3 to 0.7 for subtle shimmer
- Easing: Ease in/out for natural motion
- Loop continuously until data loads

### 3. **Perceived Performance**
- Skeleton shows instantly while data fetches
- Users perceive 30-40% faster load times
- Reduces bounce rate during loading
- Gives users context about what's coming

### 4. **Accessibility**
- Skeleton components are decorative (no screen reader announcement)
- Once content loads, proper semantic HTML/components take over
- Loading states don't block navigation or interaction

## When to Use Skeletons

### ✅ Use Skeletons For:
- **Initial page load** - First time users see the screen
- **Data refresh** - When pulling to refresh or refetching
- **Pagination** - Loading more items in a list
- **Search results** - While query is processing
- **Complex layouts** - Cards, lists, grids with multiple elements
- **Images & avatars** - Before images download

### ❌ Don't Use Skeletons For:
- **Instant operations** - Actions completing < 300ms
- **Error states** - Show error message instead
- **Empty states** - Show proper empty state UI
- **Background updates** - Silent updates without user action
- **Progress indicators** - Use progress bar for known duration tasks

## Skeleton Components Library

### Base Components
```tsx
<Skeleton width={100} height={20} borderRadius={8} />
<SkeletonCircle size={40} />
```

### Composite Components
```tsx
<YourHiringsSkeleton />           // Stats cards section
<RecentJobsSkeleton count={3} />  // Job listing
<JobCardSkeleton />               // Single job card
<ProfileHeaderSkeleton />         // User profile header
<ListItemSkeleton />              // Generic list item
<FormFieldSkeleton />             // Input field
<CardSkeleton lines={3} />        // Content card
<SearchBarSkeleton />             // Search input
<GridItemSkeleton />              // Category/service grid item
<HeroSkeleton />                  // Hero banner
<FullScreenSkeleton />            // Entire screen loading
```

## Implementation Pattern

### Standard Loading Flow
```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ["data-key"],
  queryFn: fetchData,
});

return (
  <>
    {isLoading && <SkeletonComponent />}
    {error && <ErrorComponent />}
    {data && <ActualContent data={data} />}
  </>
);
```

### Advanced: Staggered Loading
```tsx
// Show skeleton for minimum 500ms even if data loads faster
// This prevents flashing/jarring content swap
const [showSkeleton, setShowSkeleton] = useState(true);

useEffect(() => {
  if (!isLoading) {
    setTimeout(() => setShowSkeleton(false), 500);
  }
}, [isLoading]);

return showSkeleton ? <Skeleton /> : <Content />;
```

## Animation Specifications

### Pulse Animation
- **Duration**: 1200ms per cycle (600ms fade in, 600ms fade out)
- **Opacity Range**: 0.3 → 0.7 → 0.3
- **Easing**: Ease (smooth acceleration/deceleration)
- **Loop**: Infinite until content loads

### Color Palette
- **Base**: `colors.line` (#C8D8CE) - subtle gray-green
- **Background**: Match component background (white, paper, etc.)
- **No gradients**: Simple solid color for performance

### Timing Best Practices
- **0-300ms**: Show nothing (too fast to need skeleton)
- **300ms-3s**: Show skeleton (sweet spot for UX)
- **3s+**: Add progress indicator or cancel button
- **Minimum display**: 400-500ms (prevents flashing)

## Responsive Design

### Mobile Considerations
- Use exact dimensions of real content
- Test on smallest target device (iPhone SE)
- Ensure touch targets remain 44x44pt minimum
- Account for safe areas and notches

### Tablet/Large Screens
- Scale skeleton proportionally
- Maintain aspect ratios
- Use flexible widths (%, flex) where appropriate

## Performance Optimization

### Native Driver
- Always use `useNativeDriver: true` for animations
- Offloads animation to native thread
- 60fps smooth performance

### Memoization
```tsx
const MemoizedSkeleton = React.memo(SkeletonComponent);
```

### Lazy Loading
- Don't render off-screen skeletons
- Use FlatList with skeleton in `ListEmptyComponent`

## Testing Strategy

### Visual Testing
- [ ] Skeleton matches real content layout
- [ ] Animation is smooth (60fps)
- [ ] No layout shift when content loads
- [ ] Works on different screen sizes

### UX Testing
- [ ] Load feels faster than spinner
- [ ] No flashing (minimum display time)
- [ ] Accessible via screen reader
- [ ] Clear what content is loading

### Performance Testing
- [ ] Animation runs on native thread
- [ ] No dropped frames during scroll
- [ ] Memory usage is acceptable
- [ ] Works on low-end devices

## Migration Checklist

To migrate existing loading states to skeleton:

1. **Identify current spinners/loading states**
   ```bash
   # Search for ActivityIndicator usage
   grep -r "ActivityIndicator" mobile/app
   ```

2. **Choose appropriate skeleton component**
   - Match component complexity to content
   - Reuse existing skeletons when possible

3. **Replace loading state**
   ```tsx
   // Before
   {isLoading && <ActivityIndicator />}
   
   // After
   {isLoading && <SkeletonComponent />}
   ```

4. **Test and refine**
   - Verify layout matches
   - Adjust dimensions if needed
   - Test on real device

## Examples by Screen Type

### List Screen (Jobs, Messages)
```tsx
{isLoading ? (
  <RecentJobsSkeleton count={5} />
) : (
  <FlatList data={jobs} renderItem={renderJob} />
)}
```

### Detail Screen (Profile, Job Detail)
```tsx
{isLoading ? (
  <>
    <ProfileHeaderSkeleton />
    <CardSkeleton lines={4} />
    <CardSkeleton lines={3} />
  </>
) : (
  <DetailContent />
)}
```

### Dashboard (Provider Home)
```tsx
{isLoading ? (
  <>
    <HeroSkeleton />
    <YourHiringsSkeleton />
    <RecentJobsSkeleton count={3} />
  </>
) : (
  <DashboardContent />
)}
```

### Search/Filter
```tsx
{isLoading ? (
  <>
    <SearchBarSkeleton />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <GridItemSkeleton />
      <GridItemSkeleton />
      <GridItemSkeleton />
    </View>
  </>
) : (
  <SearchResults />
)}
```

## Future Enhancements

### Phase 2 Features
- [ ] Shimmer wave effect (gradient sweep)
- [ ] Suspense boundary integration
- [ ] Skeleton theme variants (dark mode)
- [ ] Smart skeleton (learns from content)
- [ ] Analytics tracking (skeleton duration)

### Advanced Patterns
- Progressive image loading (blur-up)
- Optimistic UI updates
- Predictive prefetching
- Smart caching with stale-while-revalidate

## Resources

- [Nielsen Norman Group - Skeleton Screens](https://www.nngroup.com/articles/skeleton-screens/)
- [Material Design - Progress Indicators](https://material.io/components/progress-indicators)
- [React Native Animations](https://reactnative.dev/docs/animated)

## Conclusion

Good skeleton loading is about **perceived performance** and **user confidence**. By showing users what's coming before it arrives, we reduce uncertainty and create a smoother, more professional experience.

**Key Takeaway**: Match skeleton layout to real content, animate smoothly, and never show blank screens.
