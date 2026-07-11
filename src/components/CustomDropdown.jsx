import React, { useState, useEffect, useRef } from 'react';

/**
 * CustomDropdown
 * 
 * @param {Array} options - 드롭다운 항목 목록. 각 항목은 { value/id/name, label/name, emoji } 형태를 가질 수 있습니다.
 * @param {any} value - 현재 선택된 값
 * @param {Function} onSelect - 항목 선택 시 실행할 콜백 함수 (선택된 항목의 value가 전달됨)
 * @param {string} placeholder - 선택되지 않았을 때 노출할 문구
 * @param {boolean} showQuickAddBtn - 간편 추가 버튼 노출 여부
 * @param {Function} onQuickAddClick - 간편 추가 버튼 클릭 콜백
 * @param {boolean} quickAddOpen - 간편 추가 폼 활성화 여부
 * @param {string} className - 추가 스타일 클래스
 * @param {string} size - 드롭다운 크기 ('sm' | 'md')
 */
export default function CustomDropdown({
  options = [],
  value,
  onSelect,
  placeholder = '선택해주세요',
  showQuickAddBtn = false,
  onQuickAddClick = null,
  quickAddOpen = false,
  className = '',
  size = 'md',
  direction = 'down' // 'down' | 'up'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 유연한 데이터 매핑 지원 ({ id, name, emoji } 또는 { value, label, emoji })
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      const optVal = opt.value !== undefined ? opt.value : (opt.id !== undefined ? opt.id : opt.name);
      const optLabel = opt.label !== undefined ? opt.label : opt.name;
      return {
        value: optVal,
        label: optLabel,
        emoji: opt.emoji,
        // 기존 CalendarTab.jsx의 원본 구조도 들고 있게 함
        id: opt.id,
        name: opt.name
      };
    }
    return { value: opt, label: String(opt) };
  });

  // 매칭 기준을 value, id, name 중 하나라도 일치하면 선택된 항목으로 간주
  const selectedOption = normalizedOptions.find(
    (opt) => opt.value === value || opt.id === value || opt.name === value
  );

  const paddingClass = size === 'sm' ? 'py-1.5 px-2.5 text-xs rounded-lg' : 'py-2.5 px-3.5 text-sm rounded-xl';
  const listPositionClass = direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';

  return (
    <div className={`relative w-full text-left ${className}`} ref={dropdownRef}>
      <div className="flex gap-2 w-full">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`flex-1 bg-gray-50 hover:bg-gray-100/70 active:scale-[0.99] border border-transparent focus:ring-2 focus:ring-toss-blue ${paddingClass} text-gray-800 font-bold flex items-center justify-between cursor-pointer transition-all select-none`}
        >
          <span className="truncate">
            {selectedOption ? (
              <span className="flex items-center gap-1.5">
                {selectedOption.emoji && <span className="text-base shrink-0">{selectedOption.emoji}</span>}
                <span>{selectedOption.label}</span>
              </span>
            ) : (
              <span className="text-gray-300 font-bold">{placeholder}</span>
            )}
          </span>
          <span className="text-gray-400 text-[10px] transform transition-transform duration-200 select-none">
            {isOpen ? '▲' : '▼'}
          </span>
        </div>

        {showQuickAddBtn && (
          <button
            type="button"
            onClick={onQuickAddClick}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3.5 rounded-xl text-sm font-bold transition-all shrink-0 active:scale-95"
          >
            {quickAddOpen ? '닫기' : '+ 추가'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className={`absolute left-0 right-0 ${listPositionClass} z-40 bg-white border border-gray-150/70 p-1.5 rounded-xl shadow-lg max-h-[180px] overflow-y-auto animate-scale-up`}>
          {normalizedOptions.length === 0 ? (
            <div className="py-3 text-center text-xs text-gray-400 select-none font-bold">
              등록된 항목이 없습니다.
            </div>
          ) : (
            normalizedOptions.map((opt, idx) => (
              <div
                key={opt.value !== undefined ? opt.value : idx}
                onClick={() => {
                  onSelect(opt.value);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  (selectedOption && selectedOption.value === opt.value)
                    ? 'bg-blue-50/70 text-toss-blue'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.emoji && <span className="text-sm shrink-0">{opt.emoji}</span>}
                <span className="truncate">{opt.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
