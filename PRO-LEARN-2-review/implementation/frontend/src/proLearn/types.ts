export type ProGuideLanguage = 'hr' | 'en' | 'de' | 'sl';

export type ProGuideSection = {
  id: string;
  title: string;
  level: 3 | 4;
  markdown: string;
};

export type ProGuideTopic = {
  id: string;
  title: string;
  description: string;
  introduction: string;
  sections: ProGuideSection[];
};

export type ProGuideManual = {
  locale: ProGuideLanguage;
  title: string;
  introduction: string;
  topics: ProGuideTopic[];
};
