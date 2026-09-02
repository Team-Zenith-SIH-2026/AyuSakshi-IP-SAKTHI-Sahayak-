import React, { createContext, useContext, useState, useEffect } from 'react';

const JurisdictionContext = createContext();

export const JurisdictionProvider = ({ children }) => {
  const [jurisdiction, setJurisdiction] = useState(() => {
    return localStorage.getItem('ayusakshi_jurisdiction') || 'india';
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
