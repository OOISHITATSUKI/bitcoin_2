import axios from 'axios';

// APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// Axiosインスタンスの作成
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// エラーハンドリング
const handleApiError = (error: unknown) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    console.error('API Error:', axiosError.response?.data);
    return {
      error: true,
      message: axiosError.response?.data?.message || 'APIリクエストに失敗しました',
    };
  }
  
  if (error instanceof Error) {
    console.error('Unexpected Error:', error);
    return {
      error: true,
      message: error.message || '予期せぬエラーが発生しました',
    };
  }
  
  console.error('Unknown Error:', error);
  return {
    error: true,
    message: '予期せぬエラーが発生しました',
  };
};

// API関数
export const api = {
  // 残高情報の取得
  getBalance: async (symbol: string) => {
    try {
      const response = await apiClient.get(`/api/balance/${symbol}`);
      return {
        error: false,
        data: response.data,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 価格情報の取得
  getPrice: async (symbol: string) => {
    try {
      const response = await apiClient.get(`/api/price/${symbol}`);
      return {
        error: false,
        data: response.data,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  // アカウント情報の取得
  getAccountInfo: async () => {
    try {
      const response = await apiClient.get('/api/account');
      return {
        error: false,
        data: response.data,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
}; 