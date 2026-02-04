import React, { createContext, useContext, useMemo, useState } from 'react';

type PreviewContextValue = {
  previewAsUser: boolean;
  setPreviewAsUser: (value: boolean) => void;
};

const PreviewContext = createContext<PreviewContextValue | undefined>(undefined);

export const PreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [previewAsUser, setPreviewAsUser] = useState(false);
  const value = useMemo(() => ({ previewAsUser, setPreviewAsUser }), [previewAsUser]);

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
};

export const usePreview = () => {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error('usePreview must be used within a PreviewProvider');
  }
  return context;
};
