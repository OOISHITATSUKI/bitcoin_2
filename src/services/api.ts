import axios from 'axios';

// バックエンドAPIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

// APIクライアントのインスタンス
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// エラーハンドリング
const handleApiError = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response) {
    console.error('API Error:', error.response.data);
    return {
      error: true,
      message: error.response.data.error || '通信エラーが発生しました',
      status: error.response.status
    };
  }
  
  console.error('Unexpected error:', error);
  return {
    error: true,
    message: '予期せぬエラーが発生しました',
    status: 500
  };
};

// API関数
export const api = {
  // 残高情報を取得
  async getBalance(asset = 'USDT') {
    try {
      const response = await apiClient.get(`/balance`, { params: { asset } });
      return { data: response.data, error: false };
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 価格情報を取得
  async getPrice(symbol: string) {
    try {
      const response = await apiClient.get(`/price/${symbol}`);
      return { data: response.data, error: false };
    } catch (error) {
      return handleApiError(error);
    }
  },

  // アカウント情報を取得
  async getAccountInfo() {
    try {
      const response = await apiClient.get('/account');
      return { data: response.data, error: false };
    } catch (error) {
      return handleApiError(error);
    }
  }
}; 