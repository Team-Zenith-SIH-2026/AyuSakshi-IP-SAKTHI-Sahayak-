import React, { createContext, useContext, useState, useEffect } from 'react';

const JurisdictionContext = createContext();

export const JurisdictionProvider = ({ children }) => {
  const [jurisdiction, setJurisdiction] = useState(() => {
    try {
      const saved = localStorage.getItem('ayusakshi_jurisdiction');
      return (saved === 'india' || saved === 'international') ? saved : 'india';
    } catch (e) {
      return 'india';
    }
  });

  useEffect(() => {
    localStorage.setItem('ayusakshi_jurisdiction', jurisdiction);
  }, [jurisdiction]);

  const setIndia = () => setJurisdiction('india');
  const setInternational = () => setJurisdiction('international');

  return (
    <JurisdictionContext.Provider
      value={{
        jurisdiction,
        setJurisdiction,
        setIndia,
        setInternational,
        isIndia: jurisdiction === 'india',
        isInternational: jurisdiction === 'international',
      }}
    >
      {children}
    </JurisdictionContext.Provider>
  );
};

export const useJurisdiction = () => useContext(JurisdictionContext);
