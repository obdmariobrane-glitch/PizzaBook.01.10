import LegalPage from '../src/components/LegalPage';
import { useT } from '../src/i18n/LanguageProvider';

export default function PrivacyPolicy() {
  const { t } = useT();
  const legal = t.legal.privacy;
  return (
    <LegalPage
      title={t.profile.privacyPolicy}
      intro={legal.intro}
      sections={[
        legal.information,
        legal.device,
        legal.use,
        legal.publicContent,
        legal.providers,
        legal.retention,
        legal.children,
        legal.contact,
      ]}
    />
  );
}
