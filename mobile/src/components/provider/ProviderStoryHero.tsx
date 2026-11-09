import { StoryHero, type StoryHeroProps } from '../StoryHero';
import { dash } from './palette';
export function ProviderStoryHero(props: StoryHeroProps) {
  return <StoryHero {...props} collection="hire-someone" backgroundColor={dash.bg} fallbackOffset={0.22}
    fallbackLabel="A bakery owner needs a temporary worker" />;
}
