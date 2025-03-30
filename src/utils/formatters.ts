// 数値をカンマ区切りでフォーマット
export const formatNumber = (num: number, decimals = 2): string => {
  return num.toLocaleString('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// 通貨をフォーマット
export const formatCurrency = (value: number, currency = 'USD', decimals = 2): string => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

// 仮想通貨の金額をフォーマット（少数量対応）
export const formatCrypto = (value: number, symbol = 'BTC'): string => {
  // 金額が小さい場合は適切な小数点以下桁数を使用
  const decimals = value < 0.001 ? 8 : value < 1 ? 6 : 4;
  return `${value.toFixed(decimals)} ${symbol}`;
};

// 日時のフォーマット
export const formatDate = (date: Date | string | number): string => {
  const d = new Date(date);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}; 