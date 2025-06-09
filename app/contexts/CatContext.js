import React, { createContext, useCallback, useContext, useRef } from 'react';

const CatContext = createContext();

export const useCat = () => {
  const context = useContext(CatContext);
  if (!context) {
    throw new Error('useCat must be used within a CatProvider');
  }
  return context;
};

export const CatProvider = ({ children }) => {
  const catEatingFunctionRef = useRef(null);
  const catPositionRef = useRef(null);

  const triggerCatEating = useCallback(() => {
    // Trigger cat eating animation
    if (catEatingFunctionRef.current) {
      catEatingFunctionRef.current();
    }
  }, []);

  const registerCatEating = useCallback((eatFunction) => {
    catEatingFunctionRef.current = eatFunction;
  }, []);

  const registerCatPosition = useCallback((catRef) => {
    catPositionRef.current = catRef;
  }, []);

  const getCatPosition = useCallback(() => {
    return new Promise((resolve) => {
      if (catPositionRef.current) {
        catPositionRef.current.measureInWindow((x, y, width, height) => {
          resolve({ x: x + width / 2, y: y + height / 2 });
        });
      } else {
        resolve({ x: 0, y: 0 });
      }
    });
  }, []);

  const value = {
    triggerCatEating,
    registerCatEating,
    registerCatPosition,
    getCatPosition,
  };

  return (
    <CatContext.Provider value={value}>
      {children}
    </CatContext.Provider>
  );
};

export default CatContext; 