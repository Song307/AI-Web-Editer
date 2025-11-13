import React from 'react';
import { BasicInfoStepProps } from './types';

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  name,
  setName,
  gender,
  setGender,
  personality,
  setPersonality,
  onNext,
  isValid
}) => {
  return (
    <div className="space-y-4">
      {/* Name & Gender in one row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Name Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            비서 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 김비서"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all text-sm"
          />
        </div>

        {/* Gender Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            성별
          </label>
          <div className="flex gap-2">
            {[
              { value: 'female', label: '여성', emoji: '👩' },
              { value: 'male', label: '남성', emoji: '👨' }
            ].map(({ value, label, emoji }) => (
              <button
                key={value}
                onClick={() => setGender(value as 'male' | 'female')}
                className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                  gender === value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <span className="mr-1">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Personality Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          성격 및 특징
        </label>
        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          placeholder="예: 깔끔한 직장상사, 차분하고 신뢰감 있는, 밝고 친근한..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all resize-none text-sm"
        />
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        disabled={!isValid}
        className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed text-sm"
      >
        다음 →
      </button>
    </div>
  );
};

export default BasicInfoStep;