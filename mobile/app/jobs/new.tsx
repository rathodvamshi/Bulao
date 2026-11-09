import { Redirect } from "expo-router";

/**
 * Redirect /jobs/new to the Smart 7-Step Job Posting flow at /post-work
 */
export default function PostJobRedirect() {
  return <Redirect href="/post-work" />;
}
