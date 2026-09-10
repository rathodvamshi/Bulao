# Skeleton Loading Examples

## Quick Start

### Basic Usage (Simple Pulse)
```tsx
import { YourHiringsSkeleton, RecentJobsSkeleton } from "../src/components/SkeletonLoader";
import { useQuery } from "@tanstack/react-query";

function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-data"],
    queryFn: fetchData,
  });

  if (isLoading) return <YourHiringsSkeleton />;
  if (error) return <ErrorComponent />;
  return <DataComponent data={data} />;
}
```

### Premium Shimmer Effect
```tsx
import { YourHiringsSkeletonShimmer, RecentJobsSkeletonShimmer } from "../src/components/SkeletonShimmer";

function MyComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-data"],
    queryFn: fetchData,
  });

  if (isLoading) {
    return (
      <>
        <YourHiringsSkeletonShimmer />
        <RecentJobsSkeletonShimmer count={3} />
      </>
    );
  }

  return <DataComponent data={data} />;
}
```

## Advanced Patterns

### Minimum Loading Time (Prevent Flashing)
```tsx
import { useMinimumLoadingTime } from "../src/hooks/useMinimumLoadingTime";
import { RecentJobsSkeleton } from "../src/components/SkeletonLoader";

function JobsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
  });

  // Ensure skeleton shows for at least 500ms
  const showSkeleton = useMinimumLoadingTime(isLoading, 500);

  if (showSkeleton) return <RecentJobsSkeleton count={5} />;
  return <JobsListContent data={data} />;
}
```

### Staggered Content Reveal
```tsx
import { useStaggeredReveal } from "../src/hooks/useMinimumLoadingTime";
import { 
  YourHiringsSkeleton, 
  RecentJobsSkeleton,
  ProfileHeaderSkeleton 
} from "../src/components/SkeletonLoader";

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  const [showStats, showJobs, showProfile] = useStaggeredReveal(isLoading, 3, 200);

  return (
    <ScrollView>
      {showStats ? <StatsSection data={data.stats} /> : <YourHiringsSkeleton />}
      {showJobs ? <JobsSection data={data.jobs} /> : <RecentJobsSkeleton />}
      {showProfile ? <ProfileSection data={data.profile} /> : <ProfileHeaderSkeleton />}
    </ScrollView>
  );
}
```

### With Timeout Handling
```tsx
import { useSkeletonTimeout } from "../src/hooks/useMinimumLoadingTime";
import { RecentJobsSkeleton } from "../src/components/SkeletonLoader";

function JobsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
  });

  const hasTimedOut = useSkeletonTimeout(isLoading, 8000);

  if (hasTimedOut) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Taking longer than expected...</Text>
        <Button label="Cancel" onPress={goBack} />
      </View>
    );
  }

  if (isLoading) return <RecentJobsSkeleton />;
  if (error) return <ErrorView />;
  return <JobsList data={data} />;
}
```

## Component-Specific Examples

### Provider Home Screen
```tsx
function ProviderHomeScreen() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["provider-stats"],
    queryFn: fetchStats,
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["provider-jobs"],
    queryFn: fetchJobs,
  });

  return (
    <ScrollView>
      <TopHeader />
      <HeroSection />
      
      {statsLoading ? (
        <YourHiringsSkeleton />
      ) : (
        <YourHiringsSection stats={stats} />
      )}
      
      {jobsLoading ? (
        <RecentJobsSkeleton count={3} />
      ) : (
        <RecentJobsSection jobs={jobs} />
      )}
    </ScrollView>
  );
}
```

### Job Detail Screen
```tsx
import { 
  Skeleton, 
  SkeletonCircle, 
  CardSkeleton 
} from "../src/components/SkeletonLoader";

function JobDetailScreen({ jobId }) {
  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId),
  });

  if (isLoading) {
    return (
      <View style={{ padding: 16, gap: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <SkeletonCircle size={80} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="80%" height={24} />
            <Skeleton width="60%" height={16} />
            <Skeleton width="50%" height={16} />
          </View>
        </View>

        {/* Details Cards */}
        <CardSkeleton lines={4} showHeader />
        <CardSkeleton lines={3} showHeader />
        <CardSkeleton lines={2} />
      </View>
    );
  }

  return <JobDetailContent job={job} />;
}
```

### Search Results
```tsx
import { SearchBarSkeleton, JobCardSkeleton } from "../src/components/SkeletonLoader";

function SearchScreen() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchJobs(query),
    enabled: query.length > 0,
  });

  return (
    <View>
      <SearchBar value={query} onChangeText={setQuery} />
      
      {isLoading ? (
        <View style={{ padding: 16, gap: 12 }}>
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
        </View>
      ) : (
        <SearchResults data={data} />
      )}
    </View>
  );
}
```

### Profile Screen
```tsx
import { 
  ProfileHeaderSkeleton, 
  ListItemSkeleton,
  CardSkeleton 
} from "../src/components/SkeletonLoader";

function ProfileScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  if (isLoading) {
    return (
      <ScrollView style={{ padding: 16 }}>
        <ProfileHeaderSkeleton />
        <CardSkeleton lines={3} showHeader />
        <View style={{ gap: 12, marginTop: 20 }}>
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </View>
      </ScrollView>
    );
  }

  return <ProfileContent data={data} />;
}
```

### Categories Grid
```tsx
import { GridItemSkeleton } from "../src/components/SkeletonLoader";

function CategoriesScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  if (isLoading) {
    return (
      <View style={{ 
        flexDirection: "row", 
        flexWrap: "wrap", 
        gap: 12, 
        padding: 16 
      }}>
        <GridItemSkeleton />
        <GridItemSkeleton />
        <GridItemSkeleton />
        <GridItemSkeleton />
        <GridItemSkeleton />
        <GridItemSkeleton />
      </View>
    );
  }

  return <CategoriesGrid data={data} />;
}
```

### Messages/Chat List
```tsx
import { ListItemSkeleton } from "../src/components/SkeletonLoader";

function MessagesScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: fetchMessages,
  });

  if (isLoading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </View>
    );
  }

  return <MessagesList data={data} />;
}
```

## FlatList Integration

### With ListEmptyComponent
```tsx
import { JobCardSkeleton } from "../src/components/SkeletonLoader";

function JobsList() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
  });

  return (
    <FlatList
      data={isLoading ? [] : jobs}
      renderItem={({ item }) => <JobCard job={item} />}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        isLoading ? (
          <View style={{ gap: 12, padding: 16 }}>
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </View>
        ) : (
          <EmptyState />
        )
      }
    />
  );
}
```

### With Infinite Scroll
```tsx
function InfiniteJobsList() {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobsPage,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  return (
    <FlatList
      data={data?.pages.flatMap((page) => page.jobs) || []}
      renderItem={({ item }) => <JobCard job={item} />}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        isLoading ? <RecentJobsSkeleton count={5} /> : <EmptyState />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ padding: 16 }}>
            <JobCardSkeleton />
            <JobCardSkeleton />
          </View>
        ) : null
      }
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
    />
  );
}
```

## Form Screens

### Multi-step Form with Loading
```tsx
import { FormFieldSkeleton, Skeleton } from "../src/components/SkeletonLoader";

function PostJobScreen() {
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  if (isLoading) {
    return (
      <Screen back title="Post a Job">
        <FormFieldSkeleton />
        <FormFieldSkeleton />
        <FormFieldSkeleton />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Skeleton width={80} height={44} borderRadius={22} />
          <Skeleton width={100} height={44} borderRadius={22} />
          <Skeleton width={90} height={44} borderRadius={22} />
        </View>
        <Skeleton width="100%" height={54} borderRadius={16} />
      </Screen>
    );
  }

  return <PostJobForm categories={categories} />;
}
```

## Custom Skeleton Layouts

### Create Custom Skeleton
```tsx
import { Skeleton, SkeletonCircle } from "../src/components/SkeletonLoader";

function MyCustomCardSkeleton() {
  return (
    <View style={{ 
      backgroundColor: colors.white, 
      padding: 20, 
      borderRadius: 16,
      gap: 12 
    }}>
      {/* Header with icon and text */}
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <SkeletonCircle size={40} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.line }} />

      {/* Content lines */}
      <Skeleton width="100%" height={16} />
      <Skeleton width="90%" height={16} />
      <Skeleton width="70%" height={16} />

      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Skeleton width={100} height={40} borderRadius={20} />
        <Skeleton width={100} height={40} borderRadius={20} />
      </View>
    </View>
  );
}
```

## Testing

### Test Skeleton Components
```tsx
import { render } from "@testing-library/react-native";
import { RecentJobsSkeleton } from "../src/components/SkeletonLoader";

describe("RecentJobsSkeleton", () => {
  it("renders correct number of skeleton items", () => {
    const { getAllByTestId } = render(<RecentJobsSkeleton count={3} />);
    const items = getAllByTestId("skeleton-job-card");
    expect(items).toHaveLength(3);
  });

  it("matches snapshot", () => {
    const { toJSON } = render(<RecentJobsSkeleton count={2} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
```

## Performance Tips

1. **Use React.memo** for skeleton components to prevent unnecessary re-renders
2. **Native driver** is enabled by default for animations (60fps smooth)
3. **Don't over-skeleton** - Match real content structure
4. **Reuse components** - Use existing skeletons rather than creating new ones
5. **Test on low-end devices** - Ensure animations are smooth

## Choosing Between Pulse and Shimmer

### Use Simple Pulse When:
- ✅ Simple layouts (text, basic cards)
- ✅ Performance is critical
- ✅ Low-end devices
- ✅ Battery-conscious users

### Use Shimmer When:
- ✅ Premium feel needed
- ✅ Complex layouts
- ✅ High-end devices
- ✅ Image placeholders
- ✅ First-time user experience

## Accessibility

All skeleton components are decorative and hidden from screen readers. Once content loads, proper semantic components take over with appropriate ARIA labels and roles.

```tsx
// Skeleton is automatically hidden from screen readers
<RecentJobsSkeleton /> 

// Real content has proper accessibility
<JobCard 
  job={job}
  accessibilityLabel={`Job: ${job.title}`}
  accessibilityRole="button"
/>
```
