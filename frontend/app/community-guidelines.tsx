import LegalPage from '../src/components/LegalPage';
import { Redirect } from 'expo-router';
import { useT } from '../src/i18n/LanguageProvider';
import { COMMUNITY_ENABLED } from '../src/communityFeature';

function CommunityGuidelinesContent() {
  const { t } = useT();
  const legal = t.legal.community;
  return (
    <LegalPage
      title={t.profile.communityGuidelines}
      intro={legal.intro}
      sections={[
        legal.respect,
        legal.share,
        legal.useful,
        legal.report,
        legal.enforcement,
      ]}
    />
  );
}

export default function CommunityGuidelines() {
  if (!COMMUNITY_ENABLED) return <Redirect href="/(tabs)" />;
  return <CommunityGuidelinesContent />;
}
