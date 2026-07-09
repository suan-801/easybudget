import React, { useState } from 'react';
import { Wallet, Landmark, CreditCard, Layers, Plus, Trash2, Edit2, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function AssetTab({
  assets,
  records,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  // 폼 입력 상태
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('bank'); // 'cash' | 'bank' | 'card' | 'etc'
  const [assetBalance, setAssetBalance] = useState('');

  // 클릭하여 선택된 자산 ID (8번 피드백: 당월 수입/지출 내역 노출용)
  const [selectedAssetId, setSelectedAssetId] = useState(null);

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

  // 당월 필터 데이터 추출 (8번 피드백)
  const getSelectedAssetMonthlyRecords = () => {
    if (!selectedAssetId) return [];
    const todayYM = new Date().toISOString().substring(0, 7); // YYYY-MM
    return records.filter(r => 
      (r.assetId === selectedAssetId || String(r.assetId) === String(selectedAssetId)) &&
      r.date.substring(0, 7) === todayYM
    );
  };

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
    <div className="flex flex-col gap-5 pb-24 animate-fade-in text-left">
      {/* 1. 전체 자산 총액 요약 카드 */}
      <div className="bg-gradient-to-br from-toss-blue to-toss-blue-dark p-6 rounded-2xl text-white shadow-toss-3d flex flex-col justify-between min-h-[140px]">
        <div>
          <span className="text-white/70 text-xs font-bold tracking-wider">나의 순자산 총액</span>
          <h2 className="text-2xl font-extrabold mt-1 tracking-tight">
            {formatAmount(totalBalance)}
          </h2>
        </div>
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10">
          <span className="text-[10px] text-white/60 font-bold">로컬 브라우저에 안전하게 보관 중</span>
          <button
            onClick={openAddForm}
            className="bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
          >
            <Plus size={14} />
            자산 추가
          </button>
        </div>
      </div>

      {/* 2. 자산 추가/수정 양식 (접이식/인라인 폼) */}
      {isFormOpen && (
        <div className="bg-white p-5 rounded-2xl shadow-toss border border-blue-100/50 animate-slide-down">
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
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2 px-3 text-xs text-gray-800"
                >
                  <option value="bank">예적금/은행계좌</option>
                  <option value="cash">현금</option>
                  <option value="card">체크·신용카드</option>
                  <option value="etc">기타 자산</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1">
                  {editingAsset ? '초기 설정 잔액' : '초기 잔액 설정'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="0"
                    value={assetBalance}
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
                className="bg-toss-blue text-white hover:bg-toss-blue-dark px-4 py-2 rounded-xl font-bold shadow-toss-3d"
              >
                {editingAsset ? '수정 완료' : '추가하기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. 자산 개별 목록 */}
      <div className="bg-white p-5 rounded-2xl shadow-toss">
        <h3 className="font-bold text-gray-800 text-sm mb-4">개별 자산 현황 (자산 선택 시 당월 내역 상세 노출)</h3>
        
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
              const linkedCount = records.filter(r => String(r.assetId) === String(asset.id)).length;
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
        <div className="bg-white p-5 rounded-2xl shadow-toss border border-blue-50/50 animate-slide-down">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-3 mb-4 gap-2.5">
            <div>
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Layers size={16} className="text-toss-blue" />
                {selectedAsset.name} — 당월 연동 내역
              </h4>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                이번 달에 발생하여 이 자산의 잔액에 반영된 거래 내역입니다. (총 {monthlyRecords.length}건)
              </span>
            </div>
            
            <div className="flex gap-3 text-[10px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200/50">
              <span className="text-income flex items-center gap-0.5">
                <ArrowUpRight size={12} />
                수입: +{formatAmount(assetIncome)}
              </span>
              <span className="text-gray-200">|</span>
              <span className="text-expense flex items-center gap-0.5">
                <ArrowDownRight size={12} />
                지출: -{formatAmount(assetExpense)}
              </span>
            </div>
          </div>

          {monthlyRecords.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-1.5">
              <Info size={22} className="text-gray-300" />
              <p className="text-xs">당월 이 자산에 연동된 수입/지출 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 max-h-[250px] overflow-y-auto pr-1">
              {monthlyRecords.map((record) => (
                <div key={record.id} className="flex justify-between items-center py-3 text-xs">
                  <div className="flex flex-col gap-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-800">{record.category}</span>
                      <span className="text-gray-400 text-[10px]">{record.date.substring(5)}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      <span>{record.paymentMethod}</span>
                      {record.memo && <span className="italic ml-1">"{record.memo}"</span>}
                    </div>
                  </div>
                  
                  <span className={`font-bold ${record.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {record.type === 'income' ? '+' : '-'}{formatAmount(record.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

