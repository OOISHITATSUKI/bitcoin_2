import React, { useState } from 'react';
import { GridSettings } from '../hooks/useGridSettings';

interface GridSettingsFormProps {
  settings: GridSettings;
  onUpdate: (settings: Partial<GridSettings>) => void;
  onSave: () => boolean;
  onCancel: () => void;
}

const GridSettingsForm: React.FC<GridSettingsFormProps> = ({ 
  settings, 
  onUpdate, 
  onSave, 
  onCancel 
}) => {
  // 入力フィールドのフォーカス状態
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // 数値入力の処理
  const handleNumberInput = (field: keyof GridSettings, value: string) => {
    // 空文字の場合は処理しない
    if (value === '') return;
    
    // カンマを取り除いて数値変換
    const numericValue = parseFloat(value.replace(/,/g, ''));
    
    // 有効な数値の場合のみ更新
    if (!isNaN(numericValue)) {
      onUpdate({ [field]: numericValue });
    }
  };

  // フォーム送信処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave()) {
      // 保存成功
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
      <h2 className="text-lg font-semibold mb-4">グリッド設定</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">上限価格</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={focusedField === 'upperLimit' 
              ? settings.upperLimit.toString() 
              : settings.upperLimit.toLocaleString()}
            onChange={(e) => handleNumberInput('upperLimit', e.target.value)}
            onFocus={() => setFocusedField('upperLimit')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">下限価格</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={focusedField === 'lowerLimit' 
              ? settings.lowerLimit.toString() 
              : settings.lowerLimit.toLocaleString()}
            onChange={(e) => handleNumberInput('lowerLimit', e.target.value)}
            onFocus={() => setFocusedField('lowerLimit')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">グリッド本数</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={focusedField === 'gridNumber' 
              ? settings.gridNumber.toString() 
              : settings.gridNumber.toLocaleString()}
            onChange={(e) => handleNumberInput('gridNumber', e.target.value)}
            onFocus={() => setFocusedField('gridNumber')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">初期投資額</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={focusedField === 'initialInvestment' 
              ? settings.initialInvestment.toString() 
              : settings.initialInvestment.toLocaleString()}
            onChange={(e) => handleNumberInput('initialInvestment', e.target.value)}
            onFocus={() => setFocusedField('initialInvestment')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">ストップロス</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={focusedField === 'stopLoss' 
              ? settings.stopLoss.toString() 
              : settings.stopLoss.toLocaleString()}
            onChange={(e) => handleNumberInput('stopLoss', e.target.value)}
            onFocus={() => setFocusedField('stopLoss')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">利確レベル</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={focusedField === 'takeProfitLevel' 
              ? settings.takeProfitLevel.toString() 
              : settings.takeProfitLevel.toLocaleString()}
            onChange={(e) => handleNumberInput('takeProfitLevel', e.target.value)}
            onFocus={() => setFocusedField('takeProfitLevel')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
      </div>
      
      <div className="mt-6 flex justify-end space-x-4">
        <button
          type="button"
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          onClick={onCancel}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          保存
        </button>
      </div>
    </form>
  );
};

export default GridSettingsForm; 