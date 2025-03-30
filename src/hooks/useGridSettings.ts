import { useState, useEffect } from 'react';

export interface GridSettings {
  upperLimit: number;
  lowerLimit: number;
  gridNumber: number;
  initialInvestment: number;
  stopLoss: number;
  takeProfitLevel: number;
}

export const useGridSettings = (initialSettings?: Partial<GridSettings>) => {
  // デフォルト設定
  const defaultSettings: GridSettings = {
    upperLimit: 30000,
    lowerLimit: 25000,
    gridNumber: 10,
    initialInvestment: 1000,
    stopLoss: 24000,
    takeProfitLevel: 31000,
  };

  // ローカルストレージからの復元を試みる
  const loadSettings = (): GridSettings => {
    try {
      const savedSettings = localStorage.getItem('gridBotSettings');
      return savedSettings
        ? { ...defaultSettings, ...JSON.parse(savedSettings) }
        : { ...defaultSettings, ...initialSettings };
    } catch (error) {
      console.error('設定の読み込みエラー:', error);
      return { ...defaultSettings, ...initialSettings };
    }
  };

  // 状態の初期化
  const [settings, setSettings] = useState<GridSettings>(loadSettings);
  const [isDirty, setIsDirty] = useState(false);

  // 設定の更新
  const updateSettings = (newSettings: Partial<GridSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      setIsDirty(true);
      return updated;
    });
  };

  // 設定の保存
  const saveSettings = () => {
    try {
      localStorage.setItem('gridBotSettings', JSON.stringify(settings));
      setIsDirty(false);
      return true;
    } catch (error) {
      console.error('設定の保存エラー:', error);
      return false;
    }
  };

  // グリッド間隔を計算
  const calculateGridInterval = (): number => {
    return (settings.upperLimit - settings.lowerLimit) / settings.gridNumber;
  };

  // グリッドラインを計算
  const calculateGridLines = (): number[] => {
    const { upperLimit, lowerLimit, gridNumber } = settings;
    const interval = (upperLimit - lowerLimit) / gridNumber;
    
    return Array.from({ length: gridNumber + 1 }, (_, i) => 
      lowerLimit + (interval * i)
    );
  };

  // 変更を自動保存
  useEffect(() => {
    if (isDirty) {
      const timer = setTimeout(() => {
        saveSettings();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [settings, isDirty]);

  return {
    settings,
    updateSettings,
    saveSettings,
    calculateGridInterval,
    calculateGridLines,
    isDirty
  };
}; 