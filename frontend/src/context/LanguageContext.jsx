import React, { createContext, useContext, useState, useEffect } from 'react';
import { enPart1 } from './locales/enPart1';
import { enPart2 } from './locales/enPart2';
import { viPart1 } from './locales/viPart1';
import { viPart2 } from './locales/viPart2';

const translations = {
  EN: {
    ...enPart1,
    ...enPart2,
  },
  VI: {
    ...viPart1,
    ...viPart2,
  },
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Default is always English; user can change via Settings
    const stored = localStorage.getItem('aurora_language');
    return stored === 'VI' ? 'VI' : 'EN';
  });

  useEffect(() => {
    localStorage.setItem('aurora_language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'EN' ? 'VI' : 'EN'));
  };

  const t = (key) => {
    const langDict = translations[language] || translations.EN;
    return langDict[key] || translations.EN[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
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
