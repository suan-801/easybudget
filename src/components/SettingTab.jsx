import React, { useState } from 'react';
import { Settings, Plus, Trash2, FileDown, FileUp, AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext.jsx';

export default function SettingTab({
  categories,
  paymentMethods,
  records,
  assets,
  recurringRules,
  baseDay,
  onAddCategory,
  onDeleteCategory,
  onAddPaymentMethod,
  onDeletePaymentMethod,
  onRemoveRecurringRule,
  onSetBaseDay,
  onImportData,
  onResetAllData
}) {
  const { editCategory } = useApp();

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('expense');
  const [newCatEmoji, setNewCatEmoji] = useState('💸');

  const [newPayName, setNewPayName] = useState('');
  const [tempBaseDay, setTempBaseDay] = useState(baseDay || 1);

  // 이모지 인라인 피커 상태
  const [activeEmojiPickerCatId, setActiveEmojiPickerCatId] = useState(null);

  // 이모지 선택 리스트
  const emojis = [
    '💸', '🍚', '☕', '🚌', '🛍️', '🏠', '💊', '🎬', '📚', '💰', '💵', '🎁', '📈', '📌', 
    '🍽️', '🍿', '🚗', '🎮', '💡', '🍔', '❤️', '🎒', '🏥', '💼', '📁', '💳'
  ];

  // 카테고리 추가
  const handleAddCat = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (categories.some(c => c.name === newCatName && c.type === newCatType)) {
      alert('이미 존재하는 카테고리 이름입니다.');
      return;
    }

    onAddCategory({
      id: Date.now().toString(),
      name: newCatName,
      type: newCatType,
      emoji: newCatEmoji
    });
    setNewCatName('');
  };

  // 결제 수단 추가
  const handleAddPay = (e) => {
    e.preventDefault();
    if (!newPayName.trim()) return;
    if (paymentMethods.some(p => p.name === newPayName)) {
      alert('이미 존재하는 결제 수단입니다.');
      return;
    }

    onAddPaymentMethod({
      id: Date.now().toString(),
      name: newPayName
    });
    setNewPayName('');
  };

  // 카테고리 안전 삭제 처리
  const handleCategoryDelete = (id) => {
    if (confirm('이 카테고리를 삭제하시겠습니까?')) {
      onDeleteCategory(id).catch(err => {
        alert(err.message || '카테고리 삭제에 실패했습니다.');
      });
    }
  };

  // 결제 수단 안전 삭제 처리
  const handlePaymentMethodDelete = (id) => {
    if (confirm('이 결제 수단을 삭제하시겠습니까?')) {
      onDeletePaymentMethod(id).catch(err => {
        alert(err.message || '결제 수단 삭제에 실패했습니다.');
      });
    }
  };

  // 인라인 이모지 교체 핸들러
  const handleEmojiChange = async (catId, selectedEmoji) => {
    try {
      await editCategory(catId, { icon: selectedEmoji });
      setActiveEmojiPickerCatId(null);
    } catch (err) {
      alert('이모지 수정 실패: ' + err.message);
    }
  };

  // 기준일 변경 저장
  const handleSaveBaseDay = () => {
    onSetBaseDay(Number(tempBaseDay));
    alert(`분석 기간 기준일이 매월 ${tempBaseDay}일로 설정되었습니다.`);
  };

  // 데이터 엑셀 내보내기
  const handleExportExcel = () => {
    if (records.length === 0) {
      alert('내보낼 데이터가 없습니다. 먼저 내역을 추가해 주세요.');
      return;
    }

    const recordRows = records.map(r => ({
      '날짜': r.date,
      '구분': r.type === 'income' ? '수입' : '지출',
      '금액': r.amount,
      '카테고리': r.category,
      '결제수단': r.paymentMethod,
      '메모': r.memo || '',
      '반복설정': r.recurringPeriod === 'none' ? '없음' : r.recurringPeriod
    }));

    const assetRows = assets.map(a => ({
      '자산이름': a.name,
      '자산유형': a.type,
      '초기잔액': a.initialBalance,
      '현재잔액': a.balance
    }));

    const wb = XLSX.utils.book_new();
    const wsRecords = XLSX.utils.json_to_sheet(recordRows);
    const wsAssets = XLSX.utils.json_to_sheet(assetRows);

    XLSX.utils.book_append_sheet(wb, wsRecords, '가계부내역');
    XLSX.utils.book_append_sheet(wb, wsAssets, '자산정보');

    XLSX.writeFile(wb, '손쉬운가계부_백업.xlsx');
  };

  // 데이터 엑셀 불러오기
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        if (!workbook.SheetNames.includes('가계부내역')) {
          alert('올바른 가계부 엑셀 템플릿 파일이 아닙니다. ("가계부내역" 시트 누락)');
          return;
        }

        const wsRecords = workbook.Sheets['가계부내역'];
        const recordsJson = XLSX.utils.sheet_to_json(wsRecords);

        const sample = recordsJson[0];
        if (sample && (sample['날짜'] === undefined || sample['금액'] === undefined || sample['카테고리'] === undefined)) {
          alert('엑셀 파일 규격이 맞지 않습니다. 필수 필드("날짜", "금액", "카테고리")를 확인하세요.');
          return;
        }

        const importedRecords = recordsJson.map((row, idx) => ({
          id: `imported-${Date.now()}-${idx}`,
          date: row['날짜'],
          type: row['구분'] === '수입' ? 'income' : 'expense',
          amount: Number(row['금액']) || 0,
          category: row['카테고리'],
          paymentMethod: row['결제수단'] || '미지정',
          memo: row['메모'] || '',
          isRecurring: row['반복설정'] && row['반복설정'] !== '없음',
          recurringPeriod: row['반복설정'] || 'none',
          assetId: null
        }));

        let importedAssets = [];
        if (workbook.SheetNames.includes('자산정보')) {
          const wsAssets = workbook.Sheets['자산정보'];
          const assetsJson = XLSX.utils.sheet_to_json(wsAssets);
          importedAssets = assetsJson.map((row, idx) => ({
            id: `imported-asset-${Date.now()}-${idx}`,
            name: row['자산이름'],
            type: row['자산유형'] || 'bank',
            initialBalance: Number(row['초기잔액']) || 0,
            balance: Number(row['현재잔액']) || Number(row['초기잔액']) || 0
          }));
        }

        if (confirm(`성공적으로 데이터를 파싱했습니다.\n내역: ${importedRecords.length}건\n자산: ${importedAssets.length}건\n기존 데이터를 모두 지우고 이 데이터로 덮어쓰시겠습니까?`)) {
          onImportData({
            records: importedRecords,
            assets: importedAssets
          });
        }
      } catch (err) {
        console.error(err);
        alert('엑셀 파일을 불러오는 도중 에러가 발생했습니다. 포맷을 확인해 주세요.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  return (
    // 모바일에서의 가로 삐져나옴 방지를 위해 패딩(p-3.5 sm:p-5) 및 rounded 유연화
    <div className="flex flex-col gap-5 pb-24 animate-fade-in text-left bg-gray-100/70 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl min-h-screen border border-gray-200/50 shadow-inner w-full max-w-full overflow-hidden">
      {/* 1. 경고 및 백업 안내 카드 */}
      <div className="bg-red-50 border border-red-100 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl flex gap-3 shadow-xs">
        <AlertTriangle className="text-red-500 shrink-0" size={18} />
        <div>
          <span className="text-[11px] sm:text-xs font-bold text-red-800">데이터 유실 경고</span>
          <p className="text-[10px] sm:text-[11px] text-red-600 mt-1 leading-normal">
            본 가계부는 서버에 데이터를 저장하지 않고 브라우저 로컬 저장소(IndexedDB)를 사용합니다. 브라우저 캐시 및 사용 기록을 삭제하시면 가계부 내역이 함께 유실됩니다. 데이터 안전을 위해 아래 **[엑셀 내보내기]** 기능을 사용하여 수동으로 정기적인 백업을 권장합니다.
          </p>
        </div>
      </div>

      {/* 2. 데이터 백업 / 복구 */}
      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-toss border border-gray-150/60 w-full overflow-hidden">
        <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-1.5">
          <Settings size={16} className="text-toss-blue" />
          데이터 백업 및 가져오기
        </h3>
        
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-100 text-gray-700 hover:bg-gray-100 active:scale-98 py-3 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <FileDown size={14} className="text-gray-500" />
            엑셀 백업
          </button>
          
          <label className="flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-100 text-gray-700 hover:bg-gray-100 active:scale-98 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs">
            <FileUp size={14} className="text-gray-500" />
            백업 가져오기
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImportExcel}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 3. 분석 기준일 설정 */}
      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-toss border border-gray-150/60 w-full overflow-hidden">
        <h3 className="font-bold text-gray-800 text-sm mb-1.5 flex items-center gap-1.5">
          <CalendarDays size={16} className="text-toss-blue" />
          분석 기간 기준일 설정
        </h3>
        <p className="text-[10px] text-gray-400 mb-4 leading-normal">
          한 달 소비 통계를 분석할 때 기준이 되는 시작 날짜를 설정합니다. (기본값: 매월 1일)
        </p>
        
        <div className="flex gap-2.5">
          <div className="relative w-32 sm:w-36 shrink-0">
            <select
              value={tempBaseDay}
              onChange={(e) => setTempBaseDay(e.target.value)}
              className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-toss-blue rounded-xl py-2 px-3 text-xs font-bold text-gray-800 shadow-xs"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>매월 {day}일</option>
              ))}
              <option value="31">매월 말일</option>
            </select>
          </div>
          <button
            onClick={handleSaveBaseDay}
            className="flex-1 sm:flex-none bg-toss-blue text-white hover:bg-toss-blue-dark active:scale-95 px-3 py-2 rounded-xl text-xs font-bold shadow-toss-3d transition-all text-center"
          >
            변경 저장
          </button>
        </div>
      </div>

      {/* 4. 카테고리 관리 (모바일 삐져나옴 원천 차단 개편) */}
      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-toss border border-gray-150/60 w-full overflow-hidden">
        <h3 className="font-bold text-gray-800 text-sm mb-3">카테고리 관리</h3>
        
        {/* 새 카테고리 등록 양식 - 모바일에서 유연하게 wrap 되도록 flex-wrap 설정 */}
        <form onSubmit={handleAddCat} className="flex flex-wrap gap-1.5 mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-150/40 w-full overflow-hidden">
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-[10px] font-bold py-1 px-1.5 shadow-xs cursor-pointer focus:ring-1 focus:ring-toss-blue w-[56px] shrink-0"
          >
            <option value="expense">지출</option>
            <option value="income">수입</option>
          </select>
          <select
            value={newCatEmoji}
            onChange={(e) => setNewCatEmoji(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-xs py-1 px-1 shadow-xs cursor-pointer focus:ring-1 focus:ring-toss-blue w-[44px] shrink-0"
          >
            {emojis.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input
            type="text"
            required
            placeholder="카테고리 이름"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 min-w-[70px] bg-white border border-gray-200 focus:ring-2 focus:ring-toss-blue rounded-lg py-1 px-2 text-xs text-gray-800 shadow-xs"
          />
          <button
            type="submit"
            className="bg-toss-blue text-white hover:bg-toss-blue-dark px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-toss-3d shrink-0"
          >
            추가
          </button>
        </form>

        {/* 카테고리 목록 리스트 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[250px] overflow-y-auto pr-1 w-full">
          {/* 지출 카테고리 */}
          <div className="w-full">
            <span className="text-[10px] font-bold text-expense block mb-2 border-b border-red-50 pb-1">지출 카테고리 (아이콘 클릭 시 변경)</span>
            <div className="flex flex-col gap-1 w-full">
              {categories.filter(c => c.type === 'expense').map(c => {
                const isPickerOpen = activeEmojiPickerCatId === c.id;
                return (
                  <div key={c.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded-lg group text-xs relative w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* 이모지 인라인 피커 트리거 */}
                      <span 
                        onClick={() => setActiveEmojiPickerCatId(isPickerOpen ? null : c.id)}
                        className="cursor-pointer hover:bg-gray-150 p-1 rounded-md transition-colors text-sm select-none border border-transparent hover:border-gray-200 shrink-0"
                        title="아이콘 교체"
                      >
                        {c.emoji}
                      </span>
                      <span className="font-semibold text-gray-700 truncate">{c.name}</span>
                      
                      {/* 미니 이모지 격자 팝오버 - 가로 폭 넘치지 않게 left-0 및 z-index 설정 */}
                      {isPickerOpen && (
                        <div className="absolute left-0 top-9 z-30 bg-white border border-gray-250 p-2 rounded-xl grid grid-cols-5 gap-1 shadow-xl animate-scale-up max-w-[210px]">
                          {emojis.map(emo => (
                            <span 
                              key={emo} 
                              onClick={() => handleEmojiChange(c.id, emo)}
                              className="cursor-pointer hover:bg-gray-100 p-1 text-center text-sm transition-all active:scale-90"
                            >
                              {emo}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleCategoryDelete(c.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 수입 카테고리 */}
          <div className="w-full">
            <span className="text-[10px] font-bold text-income block mb-2 border-b border-emerald-50 pb-1">수입 카테고리 (아이콘 클릭 시 변경)</span>
            <div className="flex flex-col gap-1 w-full">
              {categories.filter(c => c.type === 'income').map(c => {
                const isPickerOpen = activeEmojiPickerCatId === c.id;
                return (
                  <div key={c.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded-lg group text-xs relative w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span 
                        onClick={() => setActiveEmojiPickerCatId(isPickerOpen ? null : c.id)}
                        className="cursor-pointer hover:bg-gray-150 p-1 rounded-md transition-colors text-sm select-none border border-transparent hover:border-gray-200 shrink-0"
                        title="아이콘 교체"
                      >
                        {c.emoji}
                      </span>
                      <span className="font-semibold text-gray-700 truncate">{c.name}</span>
                      
                      {isPickerOpen && (
                        <div className="absolute left-0 top-9 z-30 bg-white border border-gray-250 p-2 rounded-xl grid grid-cols-5 gap-1 shadow-xl animate-scale-up max-w-[210px]">
                          {emojis.map(emo => (
                            <span 
                              key={emo} 
                              onClick={() => handleEmojiChange(c.id, emo)}
                              className="cursor-pointer hover:bg-gray-100 p-1 text-center text-sm transition-all active:scale-90"
                            >
                              {emo}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleCategoryDelete(c.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. 결제 수단 관리 */}
      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-toss border border-gray-150/60 w-full overflow-hidden">
        <h3 className="font-bold text-gray-800 text-sm mb-3">결제 수단 관리</h3>
        
        {/* 새 결제수단 등록 양식 */}
        <form onSubmit={handleAddPay} className="flex gap-1.5 mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-150/40 w-full overflow-hidden">
          <input
            type="text"
            required
            placeholder="결제 수단 이름 (예: 카드)"
            value={newPayName}
            onChange={(e) => setNewPayName(e.target.value)}
            className="flex-1 bg-white border border-gray-200 focus:ring-2 focus:ring-toss-blue rounded-lg py-1 px-2 text-xs text-gray-800 shadow-xs"
          />
          <button
            type="submit"
            className="bg-toss-blue text-white hover:bg-toss-blue-dark px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-toss-3d shrink-0"
          >
            추가
          </button>
        </form>

        {/* 결제 수단 리스트 - 모바일(초소형)에서는 1열, 360px 이상부터 2열, 태블릿 이상은 3열 정렬하여 잘림 방지 */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1 w-full">
          {paymentMethods.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 px-2.5 bg-gray-50 hover:bg-gray-100/70 rounded-xl group text-xs w-full overflow-hidden border border-gray-100">
              <span className="font-bold text-gray-700 truncate flex-1 pr-1">{p.name}</span>
              <button
                type="button"
                onClick={() => handlePaymentMethodDelete(p.id)}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 6. 반복 규칙 목록 관리 */}
      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-toss border border-gray-150/60 w-full overflow-hidden">
        <h3 className="font-bold text-gray-800 text-sm mb-1.5 flex items-center gap-1.5">
          <RefreshCw size={16} className="text-toss-blue" />
          반복 가계부 규칙 관리
        </h3>
        <p className="text-[10px] text-gray-400 mb-4 leading-normal">
          현재 등록되어 작동 중인 자동 반복 생성 규칙입니다. 도래일에 자산 잔액에서 자동 가감됩니다.
        </p>

        {recurringRules && recurringRules.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-1.5">
            <span className="text-xs">등록된 반복 규칙이 없습니다.</span>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-150 max-h-[230px] overflow-y-auto pr-1 w-full">
            {recurringRules && recurringRules.map(rule => {
              const periodLabel = rule.period === 'daily' ? '일' : rule.period === 'weekly' ? '주' : '달';
              const endLabel = rule.endType === 'none' 
                ? '종료조건 없음' 
                : rule.endType === 'date' 
                ? `${rule.endDate} 종료` 
                : `${rule.endCount}회 실행 후 종료`;
              const catName = categories.find(c => String(c.id) === String(rule.categoryId))?.name || '미분류';
              
              return (
                <div key={rule.id} className="flex justify-between items-center py-3 text-xs group w-full overflow-hidden">
                  <div className="flex flex-col gap-0.5 text-left min-w-0 flex-1 pr-2">
                    <span className="font-bold text-gray-800 truncate">
                      {rule.memo || '반복 설정'} ({rule.type === 'income' ? '수입' : '지출'})
                    </span>
                    <span className="text-[10px] text-gray-400 truncate">
                      규칙: {rule.interval}{periodLabel}마다 / 시작: {rule.startDate} / {endLabel}
                    </span>
                    <span className="text-[9.5px] text-toss-blue font-bold truncate">
                      금액: {rule.amount.toLocaleString()}원 | 분류: {catName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('이 반복 규칙을 삭제하시겠습니까? (더 이상 미래의 도래일에 내역이 자동 생성되지 않습니다)')) {
                        onRemoveRecurringRule(rule.id);
                      }
                    }}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. 데이터 전체 초기화 버튼 */}
      <div className="flex justify-end pt-2 w-full pr-1">
        <button
          onClick={() => {
            if (confirm('가계부의 모든 수입/지출 내역과 자산 목록, 설정이 초기화되며 복구할 수 없습니다. 계속하시겠습니까?')) {
              onResetAllData();
            }
          }}
          className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
        >
          가계부 전체 초기화
        </button>
      </div>
    </div>
  );
}
