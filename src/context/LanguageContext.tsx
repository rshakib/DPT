import React, { createContext, useState, useContext } from 'react';

type LanguageType = 'en' | 'bn';

interface LanguageContextType {
  language: LanguageType;
  toggleLanguage: (lang?: LanguageType) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<LanguageType>('en');

  const toggleLanguage = (lang?: LanguageType) => {
    if (lang) {
      setLanguage(lang);
    } else {
      setLanguage((prev) => (prev === 'en' ? 'bn' : 'en'));
    }
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
