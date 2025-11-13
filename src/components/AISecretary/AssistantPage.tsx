import React from 'react';

const AssistantPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            AI 비서 어시스턴트
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI 비서와 대화할 수 있는 페이지입니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssistantPage;