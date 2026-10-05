import LegalPage from '../src/components/LegalPage';
import { useT } from '../src/i18n/LanguageProvider';

export default function TermsOfUse() {
  const { t } = useT();
  const legal = t.legal.terms;
  return (
    <LegalPage
      title={t.profile.terms}
      intro={legal.intro}
      sections={[
        legal.eligibility,
        legal.content,
        legal.prohibited,
        legal.moderation,
        legal.availability,
        legal.termination,
        legal.contact,
      ]}
    />
  );
}
