import { StoryHero, type StoryHeroProps } from '../StoryHero';
import { dash } from './palette';
export function ServiceStoryHero(props: StoryHeroProps) {
  return <StoryHero {...props} collection="request-service" backgroundColor={dash.bg} fallbackOffset={0.18}
    fallbackLabel="A leaking sink right before family lunch" />;
}
