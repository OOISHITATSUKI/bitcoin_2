const TEST_API_BASE_URL = 'https://testnet.binance.vision/api/v3';
const MAIN_API_BASE_URL = 'https://api.binance.com/api/v3';

interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  testMode: boolean;
}

interface BinanceError extends Error {
  code?: number;
  msg?: string;
}

class BinanceApiClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private readonly DEBUG = true;

  constructor(config: BinanceConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.testMode ? TEST_API_BASE_URL : MAIN_API_BASE_URL;
    this.debug('BinanceApiClientの初期化:', {
      apiKeyLength: this.apiKey.length,
      apiSecretLength: this.apiSecret.length,
      testMode: config.testMode
    });
  }

  private debug(...args: any[]) {
    if (this.DEBUG) {
      console.log('[BinanceAPI]', ...args);
    }
  }

  private error(...args: any[]) {
    console.error('[BinanceAPI Error]', ...args);
  }

  private async generateSignature(queryString: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.apiSecret);
      const messageData = encoder.encode(queryString);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageData
      );

      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      this.error('署名生成エラー:', error);
      throw new Error('署名の生成に失敗しました');
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    try {
      const timestamp = Date.now().toString();
      const queryParams = new URLSearchParams({
        ...params,
        timestamp
      });
      
      const queryString = queryParams.toString();
      const signature = await this.generateSignature(queryString);
      
      const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
      this.debug('リクエストURL:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-MBX-APIKEY': this.apiKey
          },
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          this.error('APIエラーレスポンス:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`APIリクエストが失敗しました (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        this.debug('レスポンスデータ:', data);
        return data;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('リクエストがタイムアウトしました');
        }
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          throw new Error('ネットワーク接続エラーが発生しました。インターネット接続とCORS設定を確認してください。');
        }
        throw error;
      }
    } catch (error) {
      this.error('リクエストエラー:', error);
      throw this.handleError(error, 'APIリクエストに失敗しました');
    }
  }

  private handleError(error: any, defaultMessage: string): BinanceError {
    if (error instanceof Error) {
      const binanceError = error as BinanceError;
      if (binanceError.code) {
        this.error(`Binance APIエラー ${binanceError.code}:`, binanceError.msg);
        return new Error(`Binance APIエラー (${binanceError.code}): ${binanceError.msg}`);
      }
      if (error.message.includes('Failed to fetch')) {
        return new Error('ネットワーク接続エラーが発生しました。インターネット接続を確認してください。');
      }
      return error;
    }
    return new Error(defaultMessage);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const timestamp = Date.now().toString();
      const queryString = `timestamp=${timestamp}`;
      const signature = await this.generateSignature(queryString);
      
      const url = `${this.baseUrl}/account?${queryString}&signature=${signature}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.error('認証エラー:', errorText);
        return false;
      }

      const data = await response.json();
      return true;
    } catch (error) {
      this.error('認証検証エラー:', error);
      return false;
    }
  }

  async getAccountBalance() {
    try {
      this.debug('残高取得を開始します...');
      const data = await this.makeRequest('/account');
      
      const balances = data.balances || [];
      this.debug('取得した残高データ:', balances);

      const btcBalance = balances.find((b: any) => b.asset === 'BTC');
      const usdtBalance = balances.find((b: any) => b.asset === 'USDT');

      this.debug('BTC残高:', btcBalance);
      this.debug('USDT残高:', usdtBalance);

      if (!btcBalance && !usdtBalance) {
        this.error('BTCまたはUSDTの残高が見つかりませんでした');
      }

      return {
        base: parseFloat(btcBalance?.free || '0'),
        quote: parseFloat(usdtBalance?.free || '0')
      };
    } catch (error) {
      this.error('残高取得中にエラーが発生しました:', error);
      throw this.handleError(error, '残高の取得に失敗しました');
    }
  }

  async getCurrentPrice(symbol: string) {
    try {
      this.debug('価格取得を開始します:', symbol);
      const data = await this.makeRequest('/ticker/price', { symbol });
      return parseFloat(data.price);
    } catch (error) {
      this.error('価格取得中にエラーが発生しました:', error);
      throw this.handleError(error, '価格の取得に失敗しました');
    }
  }
}

export default BinanceApiClient; 