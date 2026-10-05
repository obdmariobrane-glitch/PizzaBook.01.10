import LegalPage from '../src/components/LegalPage';
import { useT } from '../src/i18n/LanguageProvider';

export default function CommunityGuidelines() {
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
