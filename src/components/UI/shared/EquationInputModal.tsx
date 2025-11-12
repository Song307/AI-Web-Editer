import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import ModalHeader from './ModalHeader';
import ModalBody from './ModalBody';
import ModalFooter from './ModalFooter';
import Button from './Button';

interface EquationInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (equation: string, isBlock: boolean) => void;
}

const EquationInputModal: React.FC<EquationInputModalProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [equation, setEquation] = useState('');
  const [isBlock, setIsBlock] = useState(false);
  const [preview, setPreview] = useState('');

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setEquation('');
      setIsBlock(false);
      setPreview('');
    }
  }, [isOpen]);

  // 수식 입력 시 미리보기 업데이트
  useEffect(() => {
    if (equation.trim()) {
      try {
        // KaTeX를 사용한 수식 렌더링 (실제로는 KaTeX 컴포넌트 사용)
        setPreview(equation);
      } catch (error) {
        setPreview('수식 형식이 잘못되었습니다');
      }
    } else {
      setPreview('');
    }
  }, [equation]);

  const handleInsert = () => {
    if (equation.trim()) {
      onInsert(equation.trim(), isBlock);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleInsert();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal size="medium" onClose={onClose}>
      <ModalHeader fileName="수식 입력" onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          {/* 수식 타입 선택 */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="equationType"
                checked={!isBlock}
                onChange={() => setIsBlock(false)}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">인라인 수식 ($...$)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="equationType"
                checked={isBlock}
                onChange={() => setIsBlock(true)}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">블록 수식 ($$...$$)</span>
            </label>
          </div>

          {/* 수식 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LaTeX 수식 입력
            </label>
            <textarea
              value={equation}
              onChange={(e) => setEquation(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isBlock ? "예: \\frac{a}{b} + \\sqrt{c}" : "예: x^2 + y^2 = z^2"}
              className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-none"
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              LaTeX 문법을 사용하세요. Ctrl+Enter로 삽입, ESC로 취소
            </p>
          </div>

          {/* 미리보기 */}
          {preview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                미리보기
              </label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                <div className="text-center">
                  {isBlock ? (
                    <div className="text-lg">
                      $$\({preview}\)$$
                    </div>
                  ) : (
                    <span className="text-lg">
                      $\({preview}\)$
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 도움말 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p><strong>자주 사용하는 기호:</strong></p>
            <p>분수: \frac a b • 제곱근: \sqrt x • 첨자: x_sub • 위첨자: x^sup</p>
            <p>• 그리스 문자: \alpha, \beta, \gamma, \pi, \sigma</p>
            <p>• 연산자: \sum, \int, \lim, \infty</p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleInsert}
          disabled={!equation.trim()}
        >
          삽입
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default EquationInputModal;