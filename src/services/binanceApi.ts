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

export interface Balance {
  base: number;
  quote: number;
}

interface RawBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface Order {
  symbol: string;
  orderId: number;
  price: string;
  quantity: string;
  side: 'BUY' | 'SELL';
  status: string;
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
      if (error instanceof Error) {
        throw new Error(`署名の生成に失敗しました: ${error.message}`);
      } else {
        throw new Error('署名の生成に失敗しました');
      }
    }
  }

  private async makeRequest(endpoint: string, method: string = 'GET', body?: any) {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[BinanceAPI Error]', error);
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('APIリクエストに失敗しました');
      }
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
      if (error instanceof Error) {
        console.error('認証検証エラー:', error.message);
      } else {
        console.error('認証検証エラーが発生しました');
      }
      return false;
    }
  }

  async getAccountBalance(): Promise<Balance> {
    try {
      const response = await this.makeRequest('/balance');
      const balances = response as RawBalance[];
      
      // BTCとUSDTの残高を取得
      const btcBalance = balances.find(b => b.asset === 'BTC')?.free || '0';
      const usdtBalance = balances.find(b => b.asset === 'USDT')?.free || '0';
      
      return {
        base: parseFloat(btcBalance),
        quote: parseFloat(usdtBalance)
      };
    } catch (error) {
      console.error('Error in fetchBalance:', error);
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('残高の取得に失敗しました');
      }
    }
  }

  async getCurrentPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    try {
      return await this.makeRequest(`/ticker?symbol=${symbol}`);
    } catch (error) {
      console.error('Error in getCurrentPrice:', error);
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('現在価格の取得に失敗しました');
      }
    }
  }

  async createOrder(orderParams: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: string;
    quantity: string;
    price?: string;
  }): Promise<Order> {
    try {
      return await this.makeRequest('/orders', 'POST', orderParams);
    } catch (error) {
      console.error('Error in createOrder:', error);
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('注文の作成に失敗しました');
      }
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    try {
      return await this.makeRequest(`/orders/${orderId}?symbol=${symbol}`, 'DELETE');
    } catch (error) {
      console.error('Error in cancelOrder:', error);
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('注文のキャンセルに失敗しました');
      }
    }
  }
}

export { BinanceApiClient }; 