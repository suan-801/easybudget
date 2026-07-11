import React, { useState, useEffect } from 'react';
import { Wallet, Landmark, CreditCard, Layers, Plus, Trash2, Edit2, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import CustomDropdown from './CustomDropdown';
import { useApp } from '../context/AppContext.jsx';

export default function AssetTab({
  assets,
  records,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset
}) {
  const { getAllRecords, categories, paymentMethods } = useApp();
  const [allRecords, setAllRecords] = useState([]);

  useEffect(() => {
    getAllRecords().then(recs => {
      // 카테고리 및 결제수단 명칭 조인 매핑
      const mapped = recs.map(r => {
        const cat = categories.find(c => c.id === r.categoryId || String(c.id) === String(r.categoryId));
        const pay = paymentMethods.find(p => p.id === r.paymentMethodId || String(p.id) === String(r.paymentMethodId));
        return {
          ...r,
          category: cat ? cat.name : '미분류',
          paymentMethod: pay ? pay.name : '미지정'
        };
      });
      setAllRecords(mapped);
    });
  }, [records, categories, paymentMethods, getAllRecords]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  // 폼 입력 상태
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('bank'); // 'cash' | 'bank' | 'card' | 'etc'
  const [assetBalance, setAssetBalance] = useState('');

  // 클릭하여 선택된 자산 ID (8번 피드백: 당월 수입/지출 내역 노출용)
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  const today = new Date();
  const [assetFilterYear, setAssetFilterYear] = useState(today.getFullYear());
  const [assetFilterMonth, setAssetFilterMonth] = useState(today.getMonth()); // 0-indexed

  // 금액 3자리 콤마
  const formatAmount = (num) => {
    return Number(num).toLocaleString('ko-KR') + '원';
  };

  // 자산 유형별 아이콘 및 백그라운드 색상 매핑
  const getAssetIconInfo = (type) => {
    switch (type) {
      case 'cash':
        return { icon: <Wallet size={18} className="text-amber-500" />, bg: 'bg-amber-50', label: '현금' };
      case 'bank':
        return { icon: <Landmark size={18} className="text-toss-blue" />, bg: 'bg-blue-50', label: '예적금/계좌' };
      case 'card':
        return { icon: <CreditCard size={18} className="text-pink-500" />, bg: 'bg-pink-50', label: '카드' };
      default:
        return { icon: <Layers size={18} className="text-purple-500" />, bg: 'bg-purple-50', label: '기타' };
    }
  };

  // 전체 자산 총액 계산
  const totalBalance = assets.reduce((sum, a) => sum + Number(a.balance), 0);

  // 폼 열기 (추가 모드)
  const openAddForm = () => {
    setEditingAsset(null);
    setAssetName('');
    setAssetType('bank');
    setAssetBalance('');
    setIsFormOpen(true);
  };

  // 폼 열기 (수정 모드)
  const openEditForm = (asset) => {
    setEditingAsset(asset);
    setAssetName(asset.name);
    setAssetType(asset.type);
    setAssetBalance(String(asset.initialBalance)); // 초기잔액 기준으로 수정
    setIsFormOpen(true);
  };

  // 자산 등록/수정 저장 핸들러
  const handleSaveAsset = (e) => {
    e.preventDefault();
    if (!assetName.trim()) {
      alert('자산 이름을 입력해주세요.');
      return;
    }
    const balanceVal = Number(assetBalance.replace(/[^0-9]/g, '')) || 0;

    const assetData = {
      id: editingAsset ? editingAsset.id : Date.now().toString(),
      name: assetName,
      type: assetType,
      balance: editingAsset ? editingAsset.balance : balanceVal,
      initialBalance: balanceVal
    };

    if (editingAsset) {
      onUpdateAsset(assetData);
    } else {
      onAddAsset(assetData);
    }
    setIsFormOpen(false);
  };

  // 숫자만 입력 핸들러
  const handleBalanceChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setAssetBalance(value);
  };

  // 선택된 자산의 년/월 필터 데이터 추출
  const getSelectedAssetMonthlyRecords = () => {
    if (!selectedAssetId) return [];
    return allRecords.filter(r => {
      const isLinkedAsset = r.assetId === selectedAssetId || String(r.assetId) === String(selectedAssetId);
      if (!isLinkedAsset) return false;
      
      // 타임존 오차를 피하기 위해 날짜 문자열 직접 파싱
      const yearPart = Number(r.date.substring(0, 4));
      const monthPart = Number(r.date.substring(5, 7)) - 1; // 0-indexed 보정
      
      return yearPart === assetFilterYear && monthPart === assetFilterMonth;
    });
  };

  // 자산 탭용 연도 목록 생성 (최근 3년 + 내년 정도를 포함하는 안전 목록)
  const getAssetYearOptions = () => {
    const years = new Set();
    const currentY = new Date().getFullYear();
    years.add(currentY);
    years.add(currentY - 1);
    years.add(currentY - 2);
    allRecords.forEach(r => {
      const y = new Date(r.date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  const assetYearOptions = getAssetYearOptions();

  const monthlyRecords = getSelectedAssetMonthlyRecords();
  const selectedAsset = assets.find(a => String(a.id) === String(selectedAssetId));

  // 당월 수입/지출 합산
  const getMonthlyRecordStats = () => {
    let income = 0;
    let expense = 0;
    monthlyRecords.forEach(r => {
      if (r.type === 'income') income += Number(r.amount);
      else expense += Number(r.amount);
    });
    return { income, expense };
  };

  const { income: assetIncome, expense: assetExpense } = getMonthlyRecordStats();

  return (
    <div className="flex flex-col pb-60 animate-fade-in text-left">
      {/* 1. 전체 자산 총액 요약 카드 */}
      <div className="bg-toss-blue p-6 rounded-2xl text-white flex flex-col justify-between min-h-[140px]">
        <div>
          <span className="text-white/70 text-xs font-bold tracking-wider">나의 순자산 총액</span>
          <h2 className="text-2xl font-extrabold mt-1 tracking-tight">
            {formatAmount(totalBalance)}
          </h2>
        </div>
        <div className="flex justify-end items-center mt-4 pt-3 border-t border-white/10">
          <button
            onClick={openAddForm}
            className="bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
          >
            <Plus size={14} />
            자산 추가
          </button>
        </div>
      </div>

      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 2. 자산 추가/수정 양식 (접이식/인라인 폼) */}
      {isFormOpen && (
        <div className="py-4 animate-slide-down">
          <h3 className="font-bold text-sm text-gray-800 mb-3.5">
            {editingAsset ? '자산 정보 수정' : '새로운 자산 등록'}
          </h3>
          <form onSubmit={handleSaveAsset} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">자산 이름</label>
                <input
                  type="text"
                  required
                  placeholder="예: 토스 통장, 비상금"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2 px-3 text-xs text-gray-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">자산 구분</label>
                <CustomDropdown
                  options={[
                    { value: 'bank', label: '예적금/은행계좌', emoji: '🏦' },
                    { value: 'cash', label: '현금', emoji: '💵' },
                    { value: 'card', label: '체크·신용카드', emoji: '💳' },
                    { value: 'etc', label: '기타 자산', emoji: '📂' }
                  ]}
                  value={assetType}
                  onSelect={setAssetType}
                  placeholder="자산 구분 선택"
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">
                  {editingAsset ? '초기 설정 잔액' : '초기 잔액 설정'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={assetBalance ? Number(assetBalance).toLocaleString('ko-KR') : ''}
                    onChange={handleBalanceChange}
                    className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2 pl-3 pr-8 text-xs text-right font-bold text-gray-800"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">원</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end text-xs">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="bg-toss-blue text-white hover:bg-toss-blue-dark px-4 py-2 rounded-xl font-bold transition-all"
              >
                {editingAsset ? '수정 완료' : '추가하기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. 자산 개별 목록 */}
      <div className="py-3">
        <h3 className="font-bold text-gray-800 text-sm mb-4">개별 자산 현황</h3>
        
        {assets.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Info size={28} className="text-gray-300" />
            <p className="text-sm">등록된 자산이 없습니다.</p>
            <button
              onClick={openAddForm}
              className="mt-2 text-xs bg-toss-blue text-white px-3 py-1.5 rounded-lg font-bold hover:bg-toss-blue-dark transition-all"
            >
              첫 자산 등록하기
            </button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {assets.map((asset) => {
              const { icon, bg, label } = getAssetIconInfo(asset.type);
              const linkedCount = allRecords.filter(r => String(r.assetId) === String(asset.id)).length;
              const isSelected = selectedAssetId === asset.id;

              return (
                <div 
                  key={asset.id} 
                  onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                  className={`flex justify-between items-center py-4 px-2.5 -mx-2.5 rounded-xl cursor-pointer transition-all hover:bg-gray-50/75 ${
                    isSelected ? 'bg-blue-50/40 ring-1 ring-blue-100/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                      {icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-800">{asset.name}</span>
                        <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          {label}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        초기 잔액: {Number(asset.initialBalance).toLocaleString('ko-KR')}원 
                        {linkedCount > 0 && ` (연동 내역 ${linkedCount}건)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <span className="font-bold text-sm text-gray-800">
                      {formatAmount(asset.balance)}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditForm(asset)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                        title="자산 수정 (초기잔액 변경)"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          let msg = '이 자산을 삭제하시겠습니까?';
                          if (linkedCount > 0) {
                            msg = `이 자산과 연동된 가계부 내역이 ${linkedCount}건 존재합니다. 자산을 삭제하면 가계부 내역과의 연동 정보가 자동 해제됩니다. 계속하시겠습니까?`;
                          }
                          if (confirm(msg)) {
                            onDeleteAsset(asset.id);
                            if (isSelected) setSelectedAssetId(null);
                          }
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="자산 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 선택된 자산의 당월 상세 내역 (8번 피드백: 당월 수입/지출 리스트 노출) */}
      {selectedAssetId && selectedAsset && (
        <>
          {/* 디바이더 밴드 */}
          <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>
          <div className="py-3 animate-slide-down">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-3 mb-4 gap-2.5">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 truncate">
                <Layers size={16} className="text-toss-blue shrink-0" />
                <span className="truncate">{selectedAsset.name} — 연동 내역</span>
              </h4>
              <span className="text-[10px] text-gray-400 block mt-0.5 select-none">
                선택한 년/월에 발생하여 이 자산의 잔액에 반영된 거래 내역입니다. (총 {monthlyRecords.length}건)
              </span>
            </div>
            
            {/* 년도 및 월 선택 컨트롤러 */}
            <div className="flex items-center gap-1.5 shrink-0 z-30 w-full sm:w-auto justify-start sm:justify-end">
              <CustomDropdown
                options={assetYearOptions.map(y => ({ value: y, label: `${y}년` }))}
                value={assetFilterYear}
                onSelect={(value) => setAssetFilterYear(Number(value))}
                size="sm"
                className="w-24"
              />
              <CustomDropdown
                options={Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}월` }))}
                value={assetFilterMonth}
                onSelect={(value) => setAssetFilterMonth(Number(value))}
                size="sm"
                className="w-20"
              />
            </div>
            
            <div className="flex gap-3 text-[10px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-xl shrink-0 w-full sm:w-auto justify-center">
              <span className="text-income flex items-center gap-0.5">
                <ArrowUpRight size={12} />
                수입: +{formatAmount(assetIncome).replace('원', '')}
              </span>
              <span className="text-gray-200">|</span>
              <span className="text-expense flex items-center gap-0.5">
                <ArrowDownRight size={12} />
                지출: -{formatAmount(assetExpense).replace('원', '')}
              </span>
            </div>
          </div>

          {monthlyRecords.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-1.5">
              <Info size={22} className="text-gray-300" />
              <p className="text-xs">{assetFilterYear}년 {assetFilterMonth + 1}월 이 자산에 연동된 거래 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 max-h-[280px] overflow-y-auto pr-1">
              {monthlyRecords.map((record) => (
                <div key={record.id} className="flex justify-between items-center py-3 text-xs">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="font-bold text-gray-800">
                      {record.category}
                    </span>
                    <span className="text-gray-400 text-[10px] font-medium">
                      {record.date.replace(/-/g, '.')}
                      {record.memo ? ` | ${record.memo}` : ''}
                    </span>
                  </div>
                  
                  <span className={`font-extrabold ${record.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {record.type === 'income' ? '+' : '-'}{formatAmount(record.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

