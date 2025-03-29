const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const port = 4000;

// CORS設定の詳細化
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-MBX-APIKEY', 'Authorization'],
  credentials: true
}));

app.use(express.json());

const BINANCE_API_URL = 'https://api.binance.com';

// デバッグログ用の関数
function debug(message, data) {
  console.log(`[ProxyServer] ${message}`, data);
}

function generateSignature(queryString, apiSecret) {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

app.get('/api/balance', async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.query;
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({
        error: 'API KeyとSecretが必要です'
      });
    }

    const timestamp = Date.now().toString();
    const queryString = `timestamp=${timestamp}`;
    const signature = generateSignature(queryString, apiSecret);

    debug('Binanceへのリクエスト準備:', {
      url: `${BINANCE_API_URL}/api/v3/account`,
      timestamp,
      signature: signature.slice(0, 10) + '...'
    });

    const response = await axios({
      method: 'get',
      url: `${BINANCE_API_URL}/api/v3/account?${queryString}&signature=${signature}`,
      headers: {
        'X-MBX-APIKEY': apiKey,
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    debug('Binanceからのレスポンス:', {
      status: response.status,
      data: response.data
    });

    res.json(response.data);
  } catch (error) {
    debug('エラー発生:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      error: 'Binance APIエラー',
      details: error.response?.data || error.message
    });
  }
});

app.get('/api/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    debug('価格取得リクエスト:', { symbol });

    const response = await axios({
      method: 'get',
      url: `${BINANCE_API_URL}/api/v3/ticker/price?symbol=${symbol}`,
      headers: {
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    debug('価格取得レスポンス:', response.data);
    res.json(response.data);
  } catch (error) {
    debug('価格取得エラー:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      error: '価格取得に失敗しました',
      details: error.response?.data || error.message
    });
  }
});

app.listen(port, () => {
  console.log(`プロキシサーバーが http://localhost:${port} で起動しました`);
}); 