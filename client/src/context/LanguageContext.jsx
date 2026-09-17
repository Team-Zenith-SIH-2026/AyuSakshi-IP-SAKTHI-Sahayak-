import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS } from './translations';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', bcp47: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', bcp47: 'ml-IN' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', bcp47: 'bn-IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', bcp47: 'mr-IN' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', bcp47: 'gu-IN' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ', bcp47: 'or-IN' },
  { code: 'sa', label: 'Sanskrit', native: 'संस्कृतम्', bcp47: 'sa-IN' },
  { code: 'as', label: 'Assamese', native: 'অসমীয়া', bcp47: 'as-IN' },
  { code: 'ne', label: 'Nepali', native: 'नेपाली', bcp47: 'ne-NP' },
  { code: 'kok', label: 'Konkani', native: 'कोंकणी', bcp47: 'kok-IN' },
  { code: 'sd', label: 'Sindhi', native: 'سنڌي', bcp47: 'sd-IN' },
  { code: 'mai', label: 'Maithili', native: 'मैथिली', bcp47: 'mai-IN' },
  { code: 'ur', label: 'Urdu', native: 'اردو', bcp47: 'ur-IN' },
];

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('ayusakshi_language');
      const found = SUPPORTED_LANGUAGES.find((l) => l.code === saved);
      return found ? found.code : 'en';
    } catch (e) {
      return 'en';
    }
  });

  const setLanguage = (langCode) => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    const validCode = found ? found.code : 'en';
    setLanguageState(validCode);
    try {
      localStorage.setItem('ayusakshi_language', validCode);
    } catch (e) {}
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  // Translation helper: looks up in selected language, falls back to English (NEVER to Hindi for other languages!)
  const t = (key) => {
    if (TRANSLATIONS[language] && TRANSLATIONS[language][key]) {
      return TRANSLATIONS[language][key];
    }
    // Only fall back to English
    if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
      return TRANSLATIONS.en[key];
    }
    return key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        currentLanguage,
        languages: SUPPORTED_LANGUAGES,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
