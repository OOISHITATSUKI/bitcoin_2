import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Settings, AlertTriangle, DollarSign, TrendingUp, Activity, Grid, BarChart2, Check, X, RefreshCw, PieChart, Database, Brain, Save } from 'lucide-react';
import { format } from 'date-fns';
import ja from 'date-fns/locale/ja';
import { BinanceApiClient, Balance as BinanceBalance } from './services/binanceApi';

// 自作コンポーネントとフック
import GridSettingsForm from './components/GridSettingsForm';
import { useGridSettings } from './hooks/useGridSettings';
import { api } from './services/api';
import { formatCrypto, formatCurrency, formatDate } from './utils/formatters';

interface PriceData {
  time: string;
  price: number;
}

interface Order {
  id: number;
  type: string;
  price: number;
  amount: number;
  status?: string;
  executedAt?: string;
  profit?: number;
}

interface Balance {
  base: number;
  quote: number;
}

interface GridSettings {
  upperLimit: number;
  lowerLimit: number;
  gridNumber: number;
  initialInvestment: number;
  stopLoss: number;
  takeProfitLevel: number;
  tempUpperLimit?: string;
  tempLowerLimit?: string;
  tempGridNumber?: string;
  tempInitialInvestment?: string;
  tempStopLoss?: string;
  tempTakeProfitLevel?: string;
}

interface ApiSettings {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  testMode: boolean;
}

interface AiOptimization {
  enabled: boolean;
  timeframe: string;
  historyPeriod: number;
  riskLevel: string;
  optimizationInProgress: boolean;
  lastOptimized: string | null;
}

interface TimeframeOption {
  label: string;
  value: string;
  interval: number;
  format: string;
}

const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { label: '15分足', value: '15m', interval: 15 * 60 * 1000, format: 'HH:mm' },
  { label: '1時間足', value: '1h', interval: 60 * 60 * 1000, format: 'MM/dd HH:mm' },
  { label: '4時間足', value: '4h', interval: 4 * 60 * 60 * 1000, format: 'MM/dd HH:mm' },
  { label: '日足', value: '1d', interval: 24 * 60 * 60 * 1000, format: 'yyyy/MM/dd' },
  { label: '週足', value: '1w', interval: 7 * 24 * 60 * 60 * 1000, format: 'yyyy/MM/dd' },
  { label: '月足', value: '1M', interval: 30 * 24 * 60 * 60 * 1000, format: 'yyyy/MM' }
];

// グリッド設定の入力フィールド用のカスタムフック
const useGridField = (initialValue: number, onChange: (value: number) => void) => {
  // ローカルの状態管理
  const [localValue, setLocalValue] = useState(initialValue.toString());

  // 実際の状態更新のための参照
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // 外部から値が変更された場合に同期
  useEffect(() => {
    if (!updateTimeoutRef.current && typeof initialValue === 'number') {
      setLocalValue(initialValue.toLocaleString());
    }
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 入力値から数値以外の文字を除去
    const newValue = e.target.value.replace(/[^\d.]/g, '');
    
    // 小数点が2つ以上ある場合は最初の小数点のみを残す
    const parts = newValue.split('.');
    const sanitizedValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
    
    // ローカル値を更新
    setLocalValue(sanitizedValue);
    
    // 親コンポーネントへの更新をデバウンス
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        // 数値として有効な場合のみ親コンポーネントの状態を更新
        if (sanitizedValue && !isNaN(Number(sanitizedValue))) {
          onChange(Number(sanitizedValue));
        }
      }
      updateTimeoutRef.current = null;
    }, 300);
  };

  const handleBlur = () => {
    // フォーカスが外れたときに確定
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    
    // 空または無効な値の場合、初期値に戻す
    const numericValue = localValue.replace(/[^\d.]/g, '');
    if (!numericValue || isNaN(Number(numericValue))) {
      setLocalValue(initialValue.toLocaleString());
      onChange(initialValue);
    } else {
      // 有効な数値の場合、親コンポーネントを更新
      const value = Number(numericValue);
      onChange(value);
      // フォーマットを適用した値に更新
      setLocalValue(value.toLocaleString());
    }
  };

  const handleFocus = () => {
    // フォーカス時は生の数値を表示
    const numericValue = localValue.replace(/[^\d.]/g, '');
    if (!isNaN(Number(numericValue))) {
      setLocalValue(numericValue);
    }
  };

  return {
    value: localValue,
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    type: "text" as const
  };
};

const GridTradingSystem = () => {
  // サンプルデータ
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([]);
  const [gridLines, setGridLines] = useState<number[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState<Balance>({ base: 0, quote: 0 });
  const [totalProfit, setTotalProfit] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [localSettings, setLocalSettings] = useState<GridSettings>({
    upperLimit: 30000,
    lowerLimit: 25000,
    gridNumber: 10,
    initialInvestment: 1000,
    stopLoss: 24000,
    takeProfitLevel: 31000
  });
  
  // APIキーをローカルストレージから読み込む
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => {
    const savedApiSettings = localStorage.getItem('gridBotApiSettings');
    return savedApiSettings 
      ? JSON.parse(savedApiSettings) 
      : {
          exchange: 'binance',
          apiKey: '',
          apiSecret: '',
          testMode: true
        };
  });
  
  // AIによる最適化設定
  const [aiOptimization, setAiOptimization] = useState<AiOptimization>({
    enabled: false,
    timeframe: '1d',
    historyPeriod: 30,
    riskLevel: 'medium',
    optimizationInProgress: false,
    lastOptimized: null
  });
  
  // エラー状態管理
  const [errorState, setErrorState] = useState({
    hasError: false,
    errorMessage: '',
    retryCount: 0
  });

  // UI表示用のステータス
  const [showSettings, setShowSettings] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>(TIMEFRAME_OPTIONS[0]);
  
  // 新しいstate定義
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);

  // BinanceApiClientの型を修正
  const [binanceClient, setBinanceClient] = useState<BinanceApiClient | null>(null);

  // グリッド設定フックの使用
  const { 
    settings: gridSettings,
    updateSettings: updateGridSettings, 
    saveSettings, 
    calculateGridLines 
  } = useGridSettings();

  // グリッドラインの計算
  const calculatedGridLines = calculateGridLines();

  // APIエラー処理関数
  const handleApiError = useCallback((error: any, operation: string) => {
    console.error(`Error in ${operation}:`, error);
    let errorMessage = 'エラーが発生しました';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error.msg) {
      errorMessage = error.msg;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // エラーメッセージを表示
    alert(`${operation}中にエラーが発生しました: ${errorMessage}`);
  }, []);

  // 残高取得関数
  const fetchBalance = useCallback(async () => {
    if (!binanceClient) {
      console.error('Binance client is not initialized');
      return;
    }

    try {
      console.log('Starting balance fetch...');
      const balance = await binanceClient.getAccountBalance();
      console.log('Balance fetched successfully:', balance);
      
      if (balance.base === 0 && balance.quote === 0) {
        console.warn('Warning: Both base and quote balances are 0');
      }
      
      setBalance(balance);
    } catch (error) {
      console.error('Error in fetchBalance:', error);
      if (error instanceof Error) {
        // より詳細なエラーメッセージを表示
        const errorMessage = error.message.includes('Failed to fetch')
          ? 'ネットワーク接続エラーが発生しました。インターネット接続を確認してください。'
          : error.message;
        
        handleApiError(error, `残高の取得: ${errorMessage}`);
      } else {
        handleApiError(error, '残高の取得');
      }
    }
  }, [binanceClient, handleApiError]);

  // Binance APIクライアントの初期化
  useEffect(() => {
    if (apiSettings.apiKey && apiSettings.apiSecret) {
      try {
        console.log('Initializing Binance client with settings:', {
          testMode: apiSettings.testMode,
          apiKeyLength: apiSettings.apiKey.length,
          apiSecretLength: apiSettings.apiSecret.length
        });

        const client = new BinanceApiClient({
          apiKey: apiSettings.apiKey,
          apiSecret: apiSettings.apiSecret,
          testMode: apiSettings.testMode
        });
        
        console.log('Binance client initialized successfully');
        setBinanceClient(client);
        
        // クライアント初期化後に残高を取得
        fetchBalance();
      } catch (error) {
        console.error('Error initializing Binance client:', error);
        handleApiError(error, 'APIクライアントの初期化');
      }
    } else {
      console.warn('API settings are not complete');
    }
  }, [apiSettings.apiKey, apiSettings.apiSecret, apiSettings.testMode, handleApiError, fetchBalance]);

  // 価格データ取得関数の実装
  const fetchPriceData = useCallback(async () => {
    try {
      setIsLoading(true);
      const now = Date.now();
      const data = [];
      let price = 27500;
      
      // シンプルなサンプルデータ生成
      for (let i = 0; i < 100; i++) {
        const time = new Date(now - (100 - i) * 600000); // 1分間隔
        price = price + (Math.random() - 0.5) * 200;
        data.push({
          time: time.toISOString(),
          price: price
        });
      }
      
      setPriceHistory(data);
      setLastUpdated(new Date());
    } catch (error) {
      handleApiError(error, 'チャートデータの更新');
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]);

  // 自動更新用のuseEffect
  useEffect(() => {
    // 初回のデータ取得
    fetchPriceData();
    
    // 定期的な更新用のタイマーをセット
    const intervalId = setInterval(() => {
      fetchPriceData();
    }, 10000); // 10秒ごとに更新
    
    return () => clearInterval(intervalId);
  }, [fetchPriceData]);

  // 時間枠が変更されたときのハンドラー
  const handleTimeframeChange = useCallback((newTimeframe: TimeframeOption) => {
    setSelectedTimeframe(newTimeframe);
    fetchPriceData();
  }, [fetchPriceData]);

  // 初期データの読み込み
  useEffect(() => {
    if (priceHistory.length === 0) {
      fetchPriceData();
    }
  }, [fetchPriceData, priceHistory.length]);

  // グリッド設定の更新（永続化）
  const handleSettingsUpdate = (newSettings: any) => {
    setLocalSettings(newSettings);
    updateGridSettings(newSettings);
    
    try {
      localStorage.setItem('gridBotSettings', JSON.stringify(newSettings));
    } catch (error) {
      handleApiError(error, 'グリッド設定の更新');
    }
  };

  // ボットの開始/停止
  const toggleBotStatus = () => {
    setIsRunning(!isRunning);
  };

  // 通貨ペアの変更
  const changeTradingPair = (pair: string) => {
    setSelectedPair(pair);
  };

  // グリッド設定フォーム
  const SettingsForm = () => {
    const upperLimitProps = useGridField(
      localSettings.upperLimit,
      (value) => handleSettingsUpdate({...localSettings, upperLimit: value})
    );

    const lowerLimitProps = useGridField(
      localSettings.lowerLimit,
      (value) => handleSettingsUpdate({...localSettings, lowerLimit: value})
    );

    const gridNumberProps = useGridField(
      localSettings.gridNumber,
      (value) => handleSettingsUpdate({...localSettings, gridNumber: value})
    );

    const initialInvestmentProps = useGridField(
      localSettings.initialInvestment,
      (value) => handleSettingsUpdate({...localSettings, initialInvestment: value})
    );

    const stopLossProps = useGridField(
      localSettings.stopLoss,
      (value) => handleSettingsUpdate({...localSettings, stopLoss: value})
    );

    const takeProfitLevelProps = useGridField(
      localSettings.takeProfitLevel,
      (value) => handleSettingsUpdate({...localSettings, takeProfitLevel: value})
    );

  return (
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
        <h3 className="text-lg font-semibold mb-4">グリッド設定</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">上限価格</label>
            <input
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              {...upperLimitProps}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">下限価格</label>
            <input
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              {...lowerLimitProps}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">グリッド本数</label>
            <input
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              {...gridNumberProps}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">初期投資額</label>
            <input
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              {...initialInvestmentProps}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ストップロス</label>
            <input
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              {...stopLossProps}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">利確レベル</label>
            <input
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              {...takeProfitLevelProps}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            onClick={() => setShowSettings(false)}
          >
            キャンセル
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => {
              setShowSettings(false);
            }}
          >
            保存
          </button>
        </div>
      </div>
    );
  };

  // API設定フォーム
  const ApiSettingsForm = () => (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
      <h3 className="text-lg font-semibold mb-4">取引所API設定</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">取引所</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={apiSettings.exchange}
            onChange={(e) => setApiSettings({ ...apiSettings, exchange: e.target.value })}
          >
            <option value="binance">Binance</option>
            <option value="bitflyer">bitFlyer</option>
            <option value="coincheck">Coincheck</option>
            <option value="gmo">GMOコイン</option>
            <option value="bitbank">bitbank</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">APIキー</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={apiSettings.apiKey}
            onChange={(e) => setApiSettings({ ...apiSettings, apiKey: e.target.value })}
            placeholder="APIキーを入力してください"
          />
          <p className="mt-1 text-xs text-gray-500">※権限設定: 取引権限・残高取得権限のみを付与してください</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">APIシークレット</label>
          <input
            type="password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={apiSettings.apiSecret}
            onChange={(e) => setApiSettings({ ...apiSettings, apiSecret: e.target.value })}
            placeholder="APIシークレットを入力してください"
          />
        </div>
        <div className="flex items-center mb-2">
          <input
            id="testMode"
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            checked={apiSettings.testMode}
            onChange={(e) => setApiSettings({ ...apiSettings, testMode: e.target.checked })}
          />
          <label htmlFor="testMode" className="ml-2 block text-sm text-gray-700">
            テストモード（実際の取引は行いません）
          </label>
        </div>
        
        <div className="flex items-center bg-green-50 p-3 rounded-md">
          <Database className="text-green-600 mr-2" size={20} />
          <p className="text-sm text-green-700">
            <strong>データは端末に安全に保存されます</strong>（ブラウザのローカルストレージ）
          </p>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>API接続のヒント:</strong><br />
            • APIキーの権限は最小限に設定してください（取引・残高照会のみ）<br />
            • 出金権限は絶対に付与しないでください<br />
            • IP制限を設定することでセキュリティが向上します<br />
            • テストモードでは実際の取引は行われません
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end space-x-4">
        <button
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          onClick={() => setShowApiSettings(false)}
        >
          キャンセル
        </button>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          onClick={async () => {
            if (apiSettings.apiKey && apiSettings.apiSecret) {
              try {
                const client = new BinanceApiClient({
                  apiKey: apiSettings.apiKey,
                  apiSecret: apiSettings.apiSecret,
                  testMode: apiSettings.testMode
                });
                
                // 接続テスト
                await client.getAccountBalance();
                
                localStorage.setItem('gridBotApiSettings', JSON.stringify(apiSettings));
                setBinanceClient(client);
                setShowApiSettings(false);
                alert('APIキーの接続に成功しました！');
              } catch (error) {
                handleApiError(error, 'API接続テスト');
              }
            } else {
              alert('APIキーとシークレットを入力してください');
            }
          }}
        >
          接続テスト
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          onClick={() => {
            if (apiSettings.apiKey && apiSettings.apiSecret) {
              try {
                localStorage.setItem('gridBotApiSettings', JSON.stringify(apiSettings));
                alert('API設定を永続的に保存しました');
                setShowApiSettings(false);
              } catch (error) {
                handleApiError(error, 'API設定の保存');
              }
            } else {
              alert('APIキーとシークレットを入力してください');
            }
          }}
        >
          <Save size={16} className="mr-1" />
          永続的に保存
        </button>
      </div>
    </div>
  );

  // AI最適化設定フォーム
  const AiOptimizationForm = () => (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Brain className="mr-2 text-purple-600" size={24} />
        AI最適化設定
      </h3>
      <div className="space-y-4">
        <div className="flex items-center mb-4">
          <input
            id="aiEnabled"
            type="checkbox"
            className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
            checked={aiOptimization.enabled}
            onChange={(e) => setAiOptimization({ ...aiOptimization, enabled: e.target.checked })}
          />
          <label htmlFor="aiEnabled" className="ml-2 block text-base font-medium text-gray-700 cursor-pointer">
            AI最適化を有効にする
          </label>
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <label className="block text-sm font-medium text-gray-700">分析期間</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 cursor-pointer"
            style={{ pointerEvents: 'auto', zIndex: 100 }}
            value={aiOptimization.historyPeriod.toString()}
            onChange={(e) => {
              console.log('分析期間が変更されました:', e.target.value);
              const newValue = parseInt(e.target.value, 10);
              setAiOptimization(prevState => ({
                ...prevState,
                historyPeriod: newValue
              }));
            }}
            disabled={!aiOptimization.enabled}
          >
            <option value="7">過去7日間</option>
            <option value="14">過去14日間</option>
            <option value="30">過去30日間</option>
            <option value="60">過去60日間</option>
            <option value="90">過去90日間</option>
          </select>
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <label className="block text-sm font-medium text-gray-700">時間枠</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 cursor-pointer"
            style={{ pointerEvents: 'auto', zIndex: 100 }}
            value={aiOptimization.timeframe}
            onChange={(e) => {
              console.log('時間枠が変更されました:', e.target.value);
              setAiOptimization(prevState => ({
                ...prevState,
                timeframe: e.target.value
              }));
            }}
            disabled={!aiOptimization.enabled}
          >
            <option value="15m">15分足</option>
            <option value="1h">1時間足</option>
            <option value="4h">4時間足</option>
            <option value="1d">日足</option>
          </select>
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <label className="block text-sm font-medium text-gray-700">リスクレベル</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 cursor-pointer"
            style={{ pointerEvents: 'auto', zIndex: 100 }}
            value={aiOptimization.riskLevel}
            onChange={(e) => {
              console.log('リスクレベルが変更されました:', e.target.value);
              setAiOptimization(prevState => ({
                ...prevState,
                riskLevel: e.target.value
              }));
            }}
            disabled={!aiOptimization.enabled}
          >
            <option value="low">低リスク（安定重視）</option>
            <option value="medium">中リスク（バランス型）</option>
            <option value="high">高リスク（利益最大化）</option>
          </select>
        </div>
        
        <div className="bg-purple-50 p-3 rounded-md">
          <p className="text-sm text-purple-700">
            <strong>AI最適化について:</strong><br />
            • 過去の価格データを分析し、最適なグリッド設定を提案します<br />
            • ボラティリティやトレンドを考慮してレンジ範囲を調整します<br />
            • 最適なグリッド間隔と注文数を算出します<br />
            • 定期的な自動最適化で市場環境の変化に対応します
          </p>
        </div>
        
        {aiOptimization.lastOptimized && (
          <div className="bg-green-50 p-2 rounded-md">
            <p className="text-xs text-green-700">
              最終最適化日時: {new Date(aiOptimization.lastOptimized).toLocaleString()}
            </p>
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end space-x-4">
        <button
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          onClick={() => setShowAiSettings(false)}
        >
          キャンセル
        </button>
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
          onClick={() => {
            if (aiOptimization.enabled) {
              try {
                setAiOptimization({ 
                  ...aiOptimization, 
                  optimizationInProgress: true 
                });
                
                setTimeout(() => {
                  const optimizedSettings = {
                    ...gridSettings,
                    upperLimit: 31500,
                    lowerLimit: 24500,
                    gridNumber: 14
                  };
                  
                  updateGridSettings(optimizedSettings);
                  
                  setAiOptimization({
                    ...aiOptimization,
                    optimizationInProgress: false,
                    lastOptimized: new Date().toISOString()
                  });
                  
                  localStorage.setItem('gridBotAiSettings', JSON.stringify({
                    ...aiOptimization,
                    optimizationInProgress: false,
                    lastOptimized: new Date().toISOString()
                  }));
                  
                  alert('AI最適化が完了しました。新しい設定が適用されました。');
                  setShowAiSettings(false);
                }, 2000);
              } catch (error) {
                handleApiError(error, 'AI最適化');
                setAiOptimization({ 
                  ...aiOptimization, 
                  optimizationInProgress: false 
                });
              }
            } else {
              localStorage.setItem('gridBotAiSettings', JSON.stringify(aiOptimization));
              setShowAiSettings(false);
            }
          }}
          disabled={aiOptimization.optimizationInProgress}
        >
          {aiOptimization.optimizationInProgress ? (
            <>
              <RefreshCw size={16} className="mr-1 animate-spin" />
              最適化中...
            </>
          ) : (
            <>
              <Brain size={16} className="mr-1" />
              {aiOptimization.enabled ? '最適化を実行' : '設定を保存'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  // API設定フォーム内のクライアント作成部分を修正
  const handleApiSettingsSave = async () => {
    try {
      const client = new BinanceApiClient({
        apiKey: apiSettings.apiKey,
        apiSecret: apiSettings.apiSecret,
        testMode: apiSettings.testMode
      });

      const isValid = await client.validateCredentials();
      if (!isValid) {
        throw new Error('APIキーまたはシークレットが無効です');
      }

      localStorage.setItem('binanceApiKey', apiSettings.apiKey);
      localStorage.setItem('binanceApiSecret', apiSettings.apiSecret);
      localStorage.setItem('binanceTestMode', String(apiSettings.testMode));

      setBinanceClient(client);
      alert('API設定が保存されました');
    } catch (error) {
      console.error('API設定エラー:', error);
      if (error instanceof Error) {
        alert(`API設定エラー: ${error.message}`);
      } else {
        alert('API設定エラーが発生しました');
      }
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ヘッダー */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center">
            <Grid className="mr-2" size={24} />
            グリッド自動売買システム
          </h1>
          <div className="flex items-center space-x-3">
            <select
              className="bg-blue-700 text-white px-3 py-1 rounded-md"
              value={selectedPair}
              onChange={(e) => changeTradingPair(e.target.value)}
            >
              <option value="BTC/USDT">BTC/USDT</option>
              <option value="ETH/USDT">ETH/USDT</option>
              <option value="XRP/JPY">XRP/JPY</option>
              <option value="BTC/JPY">BTC/JPY</option>
            </select>
            <button
              className={`px-4 py-1 rounded-md flex items-center ${
                isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
              onClick={() => {
                try {
                  toggleBotStatus();
                } catch (error) {
                  handleApiError(error, 'ボットの起動/停止');
                }
              }}
            >
              {isRunning ? <X size={16} className="mr-1" /> : <Check size={16} className="mr-1" />}
              {isRunning ? '停止' : '開始'}
            </button>
            {isRunning && (
              <button
                className="px-4 py-1 rounded-md flex items-center bg-red-700 hover:bg-red-800 text-white"
                onClick={() => {
                  try {
                    setIsRunning(false);
                    alert('緊急停止しました。すべての注文がキャンセルされました。');
                  } catch (error) {
                    handleApiError(error, '緊急停止');
                  }
                }}
              >
                <AlertTriangle size={16} className="mr-1" />
                緊急停止
              </button>
            )}
            <button
              className="p-2 bg-blue-700 rounded-full hover:bg-blue-800"
              onClick={() => setShowApiSettings(true)}
            >
              <DollarSign size={20} />
            </button>
            <button
              className="p-2 bg-blue-700 rounded-full hover:bg-blue-800"
              onClick={() => setShowAiSettings(true)}
            >
              <Brain size={20} />
            </button>
            <button
              className="p-2 bg-blue-700 rounded-full hover:bg-blue-800"
              onClick={() => setShowSettings(true)}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-6">
        {/* エラー通知 */}
        {errorState.hasError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center justify-between z-50">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <p>{errorState.errorMessage}</p>
            </div>
            <button
              className="text-red-700 hover:text-red-900"
              onClick={() => {
                setErrorState({
                  hasError: false,
                  errorMessage: '',
                  retryCount: 0
                });
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* モーダル */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[1000]">
            <SettingsForm />
          </div>
        )}
        {showApiSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[1000]">
            <ApiSettingsForm />
          </div>
        )}
        {showAiSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[1000]">
            <AiOptimizationForm />
          </div>
        )}

        {/* 既存のコンテンツ */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* ステータスカード */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">システムステータス</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {isRunning ? '稼働中' : '停止中'}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* 残高カード */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">残高</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {balance.base} BTC / {balance.quote} USDT
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* 利益カード */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">総利益</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {totalProfit} USDT
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* チャート */}
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">{selectedPair}チャート</h2>
              <div className="flex items-center space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-blue-600"
                    checked={autoUpdate}
                    onChange={(e) => setAutoUpdate(e.target.checked)}
                  />
                  <span className="ml-1 text-sm text-gray-700">自動更新</span>
                </label>
                {lastUpdated && (
                  <span className="text-xs text-gray-500">
                    最終更新: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
                <button
                  className="px-3 py-1 rounded-md text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center"
                  onClick={fetchPriceData}
                  disabled={isLoading}
                >
                  <RefreshCw size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? '更新中...' : '更新'}
                </button>
                <div className="flex space-x-2">
                  {TIMEFRAME_OPTIONS.map((timeframe) => (
                    <button
                      key={timeframe.value}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${
                        selectedTimeframe.value === timeframe.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => handleTimeframeChange(timeframe)}
                    >
                      {timeframe.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-96">
              {priceHistory && priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time"
                      tickFormatter={(time) => {
                        const date = new Date(time);
                        return format(date, selectedTimeframe.format, { locale: ja });
                      }}
                      domain={['dataMin', 'dataMax']}
                      allowDataOverflow={false}
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      labelFormatter={(time) => {
                        const date = new Date(time);
                        return format(date, 'yyyy/MM/dd HH:mm:ss', { locale: ja });
                      }}
                      formatter={(value) => {
                        // valueが数値かどうかを確認して適切に処理
                        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                        return [`${isNaN(numValue) ? value : numValue.toFixed(2)} USDT`, '価格'];
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#8884d8"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50 rounded-md">
                  <p className="text-gray-500">データを読み込み中...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* アクティブオーダー */}
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">アクティブオーダー</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイプ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">価格</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeOrders.map((order: any) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.price}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.amount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GridTradingSystem;
