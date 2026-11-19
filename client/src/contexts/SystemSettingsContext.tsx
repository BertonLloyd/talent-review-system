import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { review } from '@client/src/api';

interface SystemSettingsContextValue {
  systemName: string;
  systemLogo: string | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  setSystemName: (name: string) => void;
  setSystemLogo: (logo: string | null);
}

const DEFAULT_SYSTEM_NAME = '人才盘点系统';

const SystemSettingsContext = createContext<
  SystemSettingsContextValue | undefined
>(undefined);

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [systemName, setSystemName] = useState<string>(DEFAULT_SYSTEM_NAME);
  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSettings = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await review.getDisplaySettings();
      const nameItem = res.items.find(
        (s) => s.settingKey === 'system_name',
      );
      const logoItem = res.items.find(
        (s) => s.settingKey === 'system_logo',
      );
      if (nameItem?.settingValue) {
        setSystemName(nameItem.settingValue);
      } else {
        setSystemName(DEFAULT_SYSTEM_NAME);
      }
      setSystemLogo(logoItem?.settingValue || null);
    } catch {
      setSystemName(DEFAULT_SYSTEM_NAME);
      setSystemLogo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  return (
    <SystemSettingsContext.Provider
      value={{ systemName, systemLogo, loading, refreshSettings, setSystemName, setSystemLogo }}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
};

export function useSystemSettings(): SystemSettingsContextValue {
  const ctx = useContext(SystemSettingsContext);
  if (!ctx) {
    throw new Error(
      'useSystemSettings must be used within a SystemSettingsProvider',
    );
  }
  return ctx;
}
