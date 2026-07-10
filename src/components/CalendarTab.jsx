import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Info } from 'lucide-react';

export default function CalendarTab({
  records,
  assets,
  categories,
  paymentMethods,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onAddCategory,
  onAddPaymentMethod,
  onAddAsset,
  onCreateRecurringRule
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // 모달 일반 폼 상태
  const [formType, setFormType] = useState('expense'); // 'income' | 'expense'
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('');
  const [formAsset, setFormAsset] = useState('');
  const [formMemo, setFormMemo] = useState('');

  // 결제수단별 기본 자산 연동 매핑용
  const [useDefaultAsset, setUseDefaultAsset] = useState(false);

  // 정밀 반복 설정 폼 상태
  const [isRecurringChecked, setIsRecurringChecked] = useState(false);
  const [recPeriod, setRecPeriod] = useState('monthly'); // 'daily' | 'weekly' | 'monthly'
  const [recInterval, setRecInterval] = useState('1');
  const [recStartDate, setRecStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [recEndType, setRecEndType] = useState('none'); // 'none' | 'date' | 'count'
  const [recEndDate, setRecEndDate] = useState('');
  const [recEndCount, setRecEndCount] = useState('10');

  // 즉시 추가 팝업 상태 (인라인 추가용)
  const [showQuickAdd, setShowQuickAdd] = useState(null); // 'category' | 'paymentMethod' | 'asset' | null
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddAssetBalance, setQuickAddAssetBalance] = useState('');
  const [quickAddEmoji, setQuickAddEmoji] = useState('💸'); // 카테고리 추가 시 기본 이모지 선택

  // 이모지 선택 리스트
  const quickAddEmojis = [
    '💸', '🍚', '☕', '🚌', '🛍️', '🏠', '💊', '🎬', '📚', '💰', '💵', '🎁', '📈', '📌', 
    '🍽️', '🍿', '🚗', '🎮', '💡', '🍔', '❤️', '🎒', '🏥', '💼', '📁', '💳'
  ];

  // 날짜 관련 유틸리티
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // 금액 포맷 (3자리 콤마)
  const formatAmount = (num) => {
    return Number(num).toLocaleString('ko-KR');
  };

  // 2번 피드백: 모바일 좁은 달력 칸에서 가로 잘림을 방지하기 위한 반응형 금액 포맷터
  const formatCalAmount = (num) => {
    const val = Number(num);
    if (val >= 10000) {
      const man = val / 10000;
      // 100.5만, 120만 등 만 단위 간소화 (소수점은 첫째자리까지만)
      return man % 1 === 0 ? `${man}만` : `${man.toFixed(1)}만`;
    }
    return val.toLocaleString('ko-KR');
  };

  // 1번 피드백: DB/스펙상의 반복 주기 명칭 한글로 보정
  const getRepeatLabel = (rep) => {
    if (!rep || rep === 'none') return null;
    if (rep === 'weekly') return '매주';
    if (rep === 'monthly') return '매월';
    if (rep === 'yearly') return '매년';
    return rep; // 예: "1개월마다", "3주마다"
  };

  // 날짜 문자열 변환 (YYYY-MM-DD)
  const formatDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 특정 날짜의 레코드 필터링
  const getRecordsForDate = (dateStr) => {
    return records.filter(r => r.date === dateStr);
  };

  // 특정 날짜의 수입/지출 합산 (캘린더 셀 표기용)
  const getDateStats = (dateStr) => {
    const dateRecords = getRecordsForDate(dateStr);
    let income = 0;
    let expense = 0;
    dateRecords.forEach(r => {
      if (r.type === 'income') income += Number(r.amount);
      else expense += Number(r.amount);
    });
    return { income, expense };
  };

  // 이번 달 전체 수입/지출 통계
  const getMonthStats = () => {
    let income = 0;
    let expense = 0;
    records.forEach(r => {
      const rDate = new Date(r.date);
      if (rDate.getFullYear() === year && rDate.getMonth() === month) {
        if (r.type === 'income') income += Number(r.amount);
        else expense += Number(r.amount);
      }
    });
    return { income, expense };
  };

  const { income: monthIncome, expense: monthExpense } = getMonthStats();

  // 달력 격자 채우기
  const calendarCells = [];
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    calendarCells.push({ day: d, isCurrentMonth: false, date: new Date(year, month - 1, d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
  }
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  const remaining = totalCells - calendarCells.length;
  for (let d = 1; d <= remaining; d++) {
    calendarCells.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) });
  }

  // 모달 열기 (등록 모드)
  const openAddModal = (dateObj) => {
    const dateStr = formatDateString(dateObj || selectedDate);
    setEditingRecord(null);
    setFormType('expense');
    setFormAmount('');
    setFormDate(dateStr);
    
    // 기본 선택 세팅
    const expCategories = categories.filter(c => c.type === 'expense');
    setFormCategory(expCategories[0]?.name || '');
    
    const defaultPayMethod = paymentMethods[0]?.name || '';
    setFormPaymentMethod(defaultPayMethod);
    setFormMemo('');

    // 결제수단별 기본 연동자산 확인 및 세팅
    const currentMap = JSON.parse(localStorage.getItem('paymentMethodAssetMap') || '{}');
    if (defaultPayMethod && currentMap[defaultPayMethod]) {
      setFormAsset(currentMap[defaultPayMethod]);
      setUseDefaultAsset(true);
    } else {
      setFormAsset(assets[0]?.name || '');
      setUseDefaultAsset(false);
    }

    // 반복 설정 초기화
    setIsRecurringChecked(false);
    setRecPeriod('monthly');
    setRecInterval('1');
    setRecStartDate(dateStr);
    setRecEndType('none');
    setRecEndDate('');
    setRecEndCount('10');

    // 인라인 팝업 상태 해제
    setShowQuickAdd(null);
    setQuickAddName('');
    setQuickAddAssetBalance('');
    setQuickAddEmoji('💸');

    setIsModalOpen(true);
  };

  // 모달 열기 (수정 모드)
  const openEditModal = (record) => {
    setEditingRecord(record);
    setFormType(record.type);
    setFormAmount(String(record.amount));
    setFormDate(record.date);
    setFormCategory(record.category);
    setFormPaymentMethod(record.paymentMethod);
    setFormAsset(record.assetId ? assets.find(a => String(a.id) === String(record.assetId))?.name || '' : '');
    setFormMemo(record.memo || '');
    
    // 수정 시에는 반복 스케줄러 자체는 건드리지 않음
    setIsRecurringChecked(false);
    
    // 결제수단 맵핑
    const currentMap = JSON.parse(localStorage.getItem('paymentMethodAssetMap') || '{}');
    if (record.paymentMethod && currentMap[record.paymentMethod]) {
      setUseDefaultAsset(true);
    } else {
      setUseDefaultAsset(false);
    }

    setShowQuickAdd(null);
    setQuickAddName('');
    setQuickAddAssetBalance('');
    setQuickAddEmoji('💸');

    setIsModalOpen(true);
  };

  // 결제수단 변경 시 기본 지정 자산 자동 불러오기
  const handlePaymentMethodChange = (methodName) => {
    setFormPaymentMethod(methodName);
    const currentMap = JSON.parse(localStorage.getItem('paymentMethodAssetMap') || '{}');
    if (currentMap[methodName]) {
      setFormAsset(currentMap[methodName]);
      setUseDefaultAsset(true);
    } else {
      setUseDefaultAsset(false);
    }
  };

  // 내역 저장 핸들러
  const handleSaveRecord = async (e) => {
    e.preventDefault();
    if (!formAmount || Number(formAmount) <= 0) {
      alert('금액을 입력해주세요.');
      return;
    }
    if (!formCategory) {
      alert('카테고리를 선택해주세요.');
      return;
    }

    const selectedAssetObj = assets.find(a => a.name === formAsset);

    // 1. 결제수단-자산 기본 연동 맵 갱신
    if (useDefaultAsset && formPaymentMethod && formAsset) {
      const currentMap = JSON.parse(localStorage.getItem('paymentMethodAssetMap') || '{}');
      currentMap[formPaymentMethod] = formAsset;
      localStorage.setItem('paymentMethodAssetMap', JSON.stringify(currentMap));
    } else if (!useDefaultAsset && formPaymentMethod) {
      const currentMap = JSON.parse(localStorage.getItem('paymentMethodAssetMap') || '{}');
      delete currentMap[formPaymentMethod];
      localStorage.setItem('paymentMethodAssetMap', JSON.stringify(currentMap));
    }

    // 2. 반복 설정이 켜져 있는 경우 -> 반복 규칙(Rule) 생성
    if (isRecurringChecked && !editingRecord) {
      const ruleData = {
        type: formType,
        amount: Number(formAmount),
        category: formCategory,
        paymentMethod: formPaymentMethod,
        assetName: formAsset,
        memo: formMemo,
        period: recPeriod,
        interval: Number(recInterval),
        startDate: recStartDate,
        endType: recEndType,
        endDate: recEndDate,
        endCount: recEndCount
      };
      
      try {
        await onCreateRecurringRule(ruleData);
        alert('반복 가계부 규칙이 성공적으로 등록되었습니다.');
      } catch (err) {
        alert('반복 규칙 등록 실패: ' + err.message);
      }
    } else {
      // 일반 내역 생성 및 수정
      const recordData = {
        id: editingRecord ? editingRecord.id : Date.now().toString(),
        type: formType,
        amount: Number(formAmount),
        date: formDate,
        category: formCategory,
        paymentMethod: formPaymentMethod,
        assetId: selectedAssetObj ? selectedAssetObj.id : null,
        memo: formMemo,
        isRecurring: false,
        recurringPeriod: 'none'
      };

      if (editingRecord) {
        await onUpdateRecord(recordData);
      } else {
        await onAddRecord(recordData);
      }
    }
    setIsModalOpen(false);
  };

  // 금액 입력 필터링
  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setFormAmount(value);
  };

  // 즉시 추가 팝업 저장 핸들러
  const handleQuickAdd = () => {
    if (!quickAddName.trim()) return;

    if (showQuickAdd === 'category') {
      onAddCategory({
        id: Date.now().toString(),
        name: quickAddName,
        type: formType,
        emoji: quickAddEmoji
      });
      setFormCategory(quickAddName);
    } else if (showQuickAdd === 'paymentMethod') {
      onAddPaymentMethod({
        id: Date.now().toString(),
        name: quickAddName
      });
      setFormPaymentMethod(quickAddName);
    } else if (showQuickAdd === 'asset') {
      const initialBal = Number(quickAddAssetBalance.replace(/[^0-9]/g, '')) || 0;
      onAddAsset({
        id: Date.now().toString(),
        name: quickAddName,
        type: 'bank',
        balance: initialBal,
        initialBalance: initialBal
      });
      setFormAsset(quickAddName);
    }

    setQuickAddName('');
    setQuickAddAssetBalance('');
    setQuickAddEmoji('💸');
    setShowQuickAdd(null);
  };

  // 선택된 날짜의 통계 계산
  const getSelectedDateStats = () => {
    const dateStr = formatDateString(selectedDate);
    return getDateStats(dateStr);
  };

  const selectedDateStr = formatDateString(selectedDate);
  const selectedDateRecords = getRecordsForDate(selectedDateStr);
  const { income: selectedDateIncome, expense: selectedDateExpense } = getSelectedDateStats();

  // 반복 적용 정보 내용 요약 메시지 생성
  const getRecurringSummaryText = () => {
    const periodLabel = recPeriod === 'daily' ? '일' : recPeriod === 'weekly' ? '주' : '개월';
    const endLabel = recEndType === 'none' 
      ? '종료일 미지정' 
      : recEndType === 'date' 
      ? `${recEndDate || '미선택'} 종료` 
      : `${recEndCount}회 실행 후 종료`;
    return `적용 규칙: ${recInterval}${periodLabel}마다, 시작일 ${recStartDate}, 종료 조건: ${endLabel}`;
  };

  return (
    <div className="flex flex-col pb-24 text-left">
      {/* 1. 당월 요약 영역 */}
      <div className="py-2.5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <span className="text-lg font-bold text-gray-800 select-none">
            {year}년 {month + 1}월
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>
        
        <div className="flex gap-6 text-sm select-none">
          <div className="flex flex-col items-center md:items-end">
            <span className="text-gray-400 text-xs">수입 합계</span>
            <span className="text-income font-bold text-base">+{formatAmount(monthIncome)}원</span>
          </div>
          <div className="h-8 w-px bg-gray-200 block"></div>
          <div className="flex flex-col items-center md:items-end">
            <span className="text-gray-400 text-xs">지출 합계</span>
            <span className="text-expense font-bold text-base">-{formatAmount(monthExpense)}원</span>
          </div>
        </div>
      </div>


      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 2. 격자 달력 뷰 */}
      <div className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 text-center py-3 bg-gray-50/50 select-none">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
            <span key={idx} className={`text-xs font-semibold ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-toss-blue' : 'text-gray-500'}`}>
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-100/55">
          {calendarCells.map((cell, idx) => {
            const dateStr = formatDateString(cell.date);
            const { income, expense } = getDateStats(dateStr);
            const isSelected = selectedDateStr === dateStr;
            const isToday = formatDateString(new Date()) === dateStr;
            
            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(cell.date)}
                className={`bg-white min-h-[75px] p-1.5 flex flex-col justify-between cursor-pointer transition-all hover:bg-gray-50 ${
                  cell.isCurrentMonth ? 'text-gray-900' : 'text-gray-300'
                } ${isSelected ? 'ring-2 ring-toss-blue ring-inset bg-blue-50/10' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    isToday ? 'bg-toss-blue text-white' : ''
                  }`}>
                    {cell.day}
                  </span>
                </div>
                
                {/* 2번 피드백: 모바일 좁은 달력 격자에서 글자가 잘리지 않도록 폰트 크기 및 간소화된 포맷터 적용 */}
                <div className="flex flex-col text-[8.5px] md:text-[9.5px] font-bold tracking-tighter text-right mt-1 leading-tight select-none">
                  {income > 0 && cell.isCurrentMonth && (
                    <span className="text-income truncate">+{formatCalAmount(income)}</span>
                  )}
                  {expense > 0 && cell.isCurrentMonth && (
                    <span className="text-expense truncate">-{formatCalAmount(expense)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 3. 하단 상세 내역 영역 (일자별 +합, -합 작게 노출) */}
      <div className="py-2">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
            <CalendarIcon size={18} className="text-toss-blue" />
            {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 상세 내역
          </h3>
          <button
            onClick={() => openAddModal(selectedDate)}
            className="flex items-center gap-1 bg-toss-blue text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-toss-blue-dark active:scale-95 transition-all"
          >
            <Plus size={14} />
            내역 추가
          </button>
        </div>
        
        {/* 일자별 합계 작게 노출 */}
        <div className="text-[10px] text-gray-400 font-bold mb-4 flex gap-2.5 select-none">
          <span className="text-income">수입 합계: +{formatAmount(selectedDateIncome)}원</span>
          <span className="text-gray-300">|</span>
          <span className="text-expense">지출 합계: -{formatAmount(selectedDateExpense)}원</span>
        </div>

        {selectedDateRecords.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Info size={28} className="text-gray-300" />
            <p className="text-sm">기록된 수입/지출 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100/70">
            {selectedDateRecords.map((record) => {
              const recordAsset = assets.find(a => String(a.id) === String(record.assetId));
              const catEmoji = categories.find(c => c.name === record.category)?.emoji || (record.type === 'income' ? '💰' : '💸');
              return (
                <div key={record.id} className="flex flex-col py-3.5 border-b border-gray-100/50 group animate-fade-in text-left">
                  {/* 1행: 카테고리 정보 및 금액 */}
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-base shrink-0 select-none">
                        {catEmoji}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-extrabold text-sm sm:text-base text-gray-800 truncate">{record.category}</span>
                        {record.repeat && record.repeat !== 'none' && (
                          <span className="bg-blue-50 text-toss-blue text-[9px] font-bold px-1.5 py-0.5 rounded-md select-none shrink-0">
                            {getRepeatLabel(record.repeat)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`font-extrabold text-sm sm:text-base shrink-0 ${record.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {record.type === 'income' ? '+' : '-'}{formatAmount(record.amount)}원
                    </span>
                  </div>

                  {/* 2행: 결제/자산/메모 및 수정/삭제 액션 버튼 */}
                  <div className="flex justify-between items-center mt-2 pl-[46px] w-full">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0 flex-1 pr-2">
                      <span className="truncate shrink-0">{record.paymentMethod}</span>
                      {recordAsset && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-gray-300 shrink-0"></span>
                          <span className="truncate shrink-0">{recordAsset.name}</span>
                        </>
                      )}
                      {record.memo && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-gray-300 shrink-0"></span>
                          <span className="text-gray-500 font-medium truncate italic">
                            "{record.memo}"
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* 액션 버튼 (상시 노출) */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(record)}
                        className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                        title="수정"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('이 내역을 삭제하시겠습니까? (연동 자산 잔액도 복구됩니다)')) {
                            onDeleteRecord(record.id);
                          }
                        }}
                        className="p-1 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 입력/수정 모달 팝업 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-gray-150/40 overflow-y-auto max-h-[90vh] animate-scale-up">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">
                {editingRecord ? '내역 수정' : '신규 내역 등록'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-medium">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveRecord} className="p-5 flex flex-col gap-4 text-left">
              {/* 구분 (수입/지출) */}
              <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('expense');
                    const expCats = categories.filter(c => c.type === 'expense');
                    if (!expCats.some(c => c.name === formCategory)) {
                      setFormCategory(expCats[0]?.name || '');
                    }
                  }}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    formType === 'expense' ? 'bg-white text-expense shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
                  }`}
                >
                  지출 (-)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('income');
                    const incCats = categories.filter(c => c.type === 'income');
                    if (!incCats.some(c => c.name === formCategory)) {
                      setFormCategory(incCats[0]?.name || '');
                    }
                  }}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    formType === 'income' ? 'bg-white text-income shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
                  }`}
                >
                  수입 (+)
                </button>
              </div>

              {/* 금액 입력 (원 기호와 글자 겹침 방지 pr-12 적용) */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">금액</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={formAmount ? Number(formAmount).toLocaleString('ko-KR') : ''}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-3 pl-4 pr-12 font-bold text-lg text-right text-gray-800 placeholder-gray-300"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-600 select-none">원</span>
                </div>
              </div>

              {/* 날짜 선택 */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">날짜</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2.5 px-3 text-sm text-gray-800"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">카테고리</label>
                <div className="flex gap-2">
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="flex-1 bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2.5 px-3 text-sm text-gray-800"
                  >
                    {categories
                      .filter((c) => c.type === formType)
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddName('');
                      setShowQuickAdd(showQuickAdd === 'category' ? null : 'category');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3.5 rounded-xl text-sm font-bold transition-all"
                  >
                    {showQuickAdd === 'category' ? '닫기' : '+ 추가'}
                  </button>
                </div>

                {/* 카테고리 바로 밑에 추가 양식 노출 및 아이콘 선택 */}
                {showQuickAdd === 'category' && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 mt-2 flex gap-2 items-center animate-slide-down">
                    <select
                      value={quickAddEmoji}
                      onChange={(e) => setQuickAddEmoji(e.target.value)}
                      className="bg-white border border-gray-250 rounded-lg text-xs py-1 px-1.5 focus:ring-1 focus:ring-toss-blue cursor-pointer"
                    >
                      {quickAddEmojis.map(emo => (
                        <option key={emo} value={emo}>{emo}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="새 카테고리 이름"
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      className="flex-1 bg-white border border-gray-250 focus:ring-1 focus:ring-toss-blue rounded-lg py-1 px-2.5 text-xs text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAdd}
                      className="bg-toss-blue text-white px-3.5 py-1 rounded-lg text-xs font-bold hover:bg-toss-blue-dark transition-colors shrink-0"
                    >
                      저장
                    </button>
                  </div>
                )}
              </div>

              {/* 결제 수단 */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">결제 수단</label>
                <div className="flex gap-2">
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value)}
                    className="flex-1 bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2.5 px-3 text-sm text-gray-800"
                  >
                    {paymentMethods.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddName('');
                      setShowQuickAdd(showQuickAdd === 'paymentMethod' ? null : 'paymentMethod');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3.5 rounded-xl text-sm font-bold transition-all"
                  >
                    {showQuickAdd === 'paymentMethod' ? '닫기' : '+ 추가'}
                  </button>
                </div>

                {/* 결제 수단 바로 밑에 추가 양식 노출 */}
                {showQuickAdd === 'paymentMethod' && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 mt-2 flex gap-2 items-center animate-slide-down">
                    <input
                      type="text"
                      placeholder="새 결제 수단 이름"
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      className="flex-1 bg-white border border-gray-250 focus:ring-1 focus:ring-toss-blue rounded-lg py-1 px-2.5 text-xs text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAdd}
                      className="bg-toss-blue text-white px-3.5 py-1 rounded-lg text-xs font-bold hover:bg-toss-blue-dark transition-colors shrink-0"
                    >
                      저장
                    </button>
                  </div>
                )}
              </div>

              {/* 연동 자산 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-400">연동 자산</label>
                  
                  {/* 기본 결제수단-자산 설정 토글 */}
                  {formPaymentMethod && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-gray-500 font-bold select-none">
                      <input
                        type="checkbox"
                        checked={useDefaultAsset}
                        onChange={(e) => setUseDefaultAsset(e.target.checked)}
                        className="rounded-sm border-gray-300 text-toss-blue focus:ring-toss-blue w-3.5 h-3.5"
                      />
                      이 결제수단의 기본 자산으로 지정
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={formAsset}
                    onChange={(e) => setFormAsset(e.target.value)}
                    className="flex-1 bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2.5 px-3 text-sm text-gray-800"
                  >
                    <option value="">연동 안 함</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddName('');
                      setQuickAddAssetBalance('');
                      setShowQuickAdd(showQuickAdd === 'asset' ? null : 'asset');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3.5 rounded-xl text-sm font-bold transition-all"
                  >
                    {showQuickAdd === 'asset' ? '닫기' : '+ 추가'}
                  </button>
                </div>

                {/* 연동 자산 바로 밑에 추가 양식 노출 */}
                {showQuickAdd === 'asset' && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 mt-2 flex flex-col gap-2 animate-slide-down">
                    <span className="text-[10px] font-bold text-toss-blue">새 자산 등록</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="자산 이름"
                        value={quickAddName}
                        onChange={(e) => setQuickAddName(e.target.value)}
                        className="flex-1 bg-white border border-gray-250 focus:ring-1 focus:ring-toss-blue rounded-lg py-1 px-2 text-xs text-gray-800"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="초기잔액(원)"
                        value={quickAddAssetBalance ? Number(quickAddAssetBalance).toLocaleString('ko-KR') : ''}
                        onChange={(e) => setQuickAddAssetBalance(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-24 bg-white border border-gray-250 focus:ring-1 focus:ring-toss-blue rounded-lg py-1 px-2 text-xs text-gray-850 text-right font-semibold"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAdd}
                        className="bg-toss-blue text-white px-3.5 py-1 rounded-lg text-xs font-bold hover:bg-toss-blue-dark transition-colors shrink-0"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 메모 입력 */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">메모</label>
                <input
                  type="text"
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  placeholder="메모를 입력하세요"
                  className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2.5 px-3 text-sm text-gray-800 placeholder-gray-300"
                />
              </div>

              {/* 정교화된 가계부 반복 등록 영역 */}
              {!editingRecord && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/50 flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={isRecurringChecked}
                      onChange={(e) => setIsRecurringChecked(e.target.checked)}
                      className="rounded border-gray-300 text-toss-blue focus:ring-toss-blue w-4 h-4"
                    />
                    이 거래를 규칙에 따라 반복 등록 (스케줄러)
                  </label>

                  {isRecurringChecked && (
                    <div className="flex flex-col gap-3.5 mt-1 border-t border-gray-200/40 pt-3.5 animate-slide-down">
                      {/* 주기 및 간격 */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-1">반복 주기</label>
                          <select
                            value={recPeriod}
                            onChange={(e) => setRecPeriod(e.target.value)}
                            className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-toss-blue rounded-xl py-1.5 px-2.5 text-xs text-gray-800"
                          >
                            <option value="daily">매일</option>
                            <option value="weekly">매주</option>
                            <option value="monthly">매달</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-1">반복 간격</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={recInterval}
                              onChange={(e) => setRecInterval(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-toss-blue rounded-xl py-1.5 pl-2.5 pr-8 text-xs font-bold text-gray-800"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500">
                              {recPeriod === 'daily' ? '일' : recPeriod === 'weekly' ? '주' : '달'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 시작일 */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">시작일</label>
                        <input
                          type="date"
                          value={recStartDate}
                          onChange={(e) => setRecStartDate(e.target.value)}
                          className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-toss-blue rounded-xl py-1.5 px-2.5 text-xs text-gray-800"
                        />
                      </div>

                      {/* 종료 방법 */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">종료 방식</label>
                        <div className="flex gap-2">
                          {['none', 'date', 'count'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setRecEndType(type)}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                recEndType === type ? 'bg-toss-blue text-white' : 'bg-white border border-gray-200 text-gray-400'
                              }`}
                            >
                              {type === 'none' ? '미지정' : type === 'date' ? '종료일' : '횟수'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 종료일 또는 횟수 입력 */}
                      {recEndType === 'date' && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-1">종료일 선택</label>
                          <input
                            type="date"
                            value={recEndDate}
                            onChange={(e) => setRecEndDate(e.target.value)}
                            className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-toss-blue rounded-xl py-1.5 px-2.5 text-xs text-gray-800"
                          />
                        </div>
                      )}
                      {recEndType === 'count' && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-1">실행할 반복 횟수</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={recEndCount}
                              onChange={(e) => setRecEndCount(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-toss-blue rounded-xl py-1.5 pl-2.5 pr-8 text-xs font-bold text-gray-800"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500">회</span>
                          </div>
                        </div>
                      )}

                      {/* 파란 가로 모서리가 둥근 네모 상자 내 정보 요약 노출 */}
                      <div className="bg-blue-50/70 text-toss-blue rounded-xl px-4 py-3 text-xs font-extrabold select-none text-center">
                        {getRecurringSummaryText()}
                      </div>

                      {/* 안내 문구 */}
                      <p className="text-[9px] text-gray-400 leading-normal bg-gray-100 p-2.5 rounded-xl border border-gray-200/55 select-none">
                        ⚠️ 생성된 반복 설정은 수정할 수 없습니다. 종료 또는 삭제가 가능하니 설정 변경 희망 시 삭제 후 새로운 반복 설정을 만들어주세요.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 제출 버튼 */}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-sm hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-toss-blue text-white font-bold py-3 rounded-xl text-sm hover:bg-toss-blue-dark active:scale-95 transition-all"
                >
                  {editingRecord ? '변경 내용 적용' : '내역 추가 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
