import React, { useState } from 'react';
import CalendarTab from './components/CalendarTab';
import AnalysisTab from './components/AnalysisTab';
import AssetTab from './components/AssetTab';
import SettingTab from './components/SettingTab';
import { useApp } from './context/AppContext';
import { Settings, TrendingUp } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'analysis' | 'asset' | 'setting'
  const [previousTab, setPreviousTab] = useState('calendar'); // 설정에서 뒤로가기용 탭 기억
  
  // AppContext에서 상태 및 API 획득
  const {
    isReady,
    dbError,
    records,
    assets,
    categories,
    paymentMethods,
    recurringRules, // 신규
    createRecord,
    editRecord,
    removeRecord,
    createAsset,
    editAsset,
    removeAsset,
    createCategory,
    removeCategory,
    reorderCategories,
    createPaymentMethod,
    removePaymentMethod,
    createRecurringRule, // 신규
    removeRecurringRule, // 신규
    handleExport,
    handleImport,
    currentYear,
    currentMonth,
    setCurrentYear,
    setCurrentMonth
  } = useApp();

  const [baseDay, setBaseDay] = useState(() => {
    return Number(localStorage.getItem('easybudget_base_day') || 1);
  });

  const handleSetBaseDay = (day) => {
    setBaseDay(day);
    localStorage.setItem('easybudget_base_day', day);
  };

  // 로딩 및 에러 스크린
  if (dbError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
        <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center max-w-sm">
          <h2 className="text-lg font-bold text-red-500 mb-2">데이터베이스 오류</h2>
          <p className="text-sm text-gray-500 mb-4">{dbError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-toss-blue text-white py-2.5 rounded-xl font-bold text-xs"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-toss-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-bold text-gray-500">데이터를 로드하는 중...</p>
        </div>
      </div>
    );
  }

  // 탭 변경 래퍼 핸들러
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== 'setting') {
      setPreviousTab(tab);
    }
  };

  // 설정 버튼 토글 핸들러 (1번 피드백 반영)
  const handleToggleSetting = () => {
    if (activeTab === 'setting') {
      setActiveTab(previousTab);
    } else {
      setPreviousTab(activeTab);
      setActiveTab('setting');
    }
  };

  // 엑셀 업로드 호환 핸들러
  const handleImportData = async ({ records: importedRecords, assets: importedAssets }) => {
    try {
      if (importedAssets && importedAssets.length > 0) {
        for (const a of importedAssets) {
          await createAsset({
            name: a.name,
            type: a.type,
            balance: a.initialBalance
          });
        }
      }
      if (importedRecords && importedRecords.length > 0) {
        for (const r of importedRecords) {
          await createRecord({
            type: r.type,
            amount: r.amount,
            date: r.date,
            category: r.category,
            paymentMethod: r.paymentMethod,
            assetId: null,
            memo: r.memo,
            recurringPeriod: r.recurringPeriod
          });
        }
      }
      alert('백업 데이터 가져오기가 완료되었습니다.');
    } catch (err) {
      console.error(err);
      alert('데이터를 저장하는 도중 오류가 발생했습니다.');
    }
  };

  // 전체 데이터 초기화 핸들러
  const handleResetAllData = async () => {
    for (const r of records) {
      await removeRecord(r.id);
    }
    for (const a of assets) {
      await removeAsset(a.id);
    }
    alert('가계부 데이터가 초기화되었습니다.');
    window.location.reload();
  };

  // 현재 탭 렌더링
  const renderTabContent = () => {
    switch (activeTab) {
      case 'calendar':
        return (
          <CalendarTab
            records={records}
            assets={assets}
            categories={categories}
            paymentMethods={paymentMethods}
            onAddRecord={createRecord}
            onUpdateRecord={(record) => editRecord(record.id, record)}
            onDeleteRecord={removeRecord}
            onAddCategory={createCategory}
            onAddPaymentMethod={createPaymentMethod}
            onAddAsset={createAsset}
            // 신규 반복 설정 생성 전달
            onCreateRecurringRule={createRecurringRule}
          />
        );
      case 'analysis':
        return (
          <AnalysisTab
            records={records}
            categories={categories}
            onSwitchTab={handleTabChange}
            onSelectMonth={(year, monthIdx) => {
              setCurrentYear(year);
              setCurrentMonth(monthIdx + 1);
              handleTabChange('calendar');
            }}
          />
        );
      case 'asset':
        return (
          <AssetTab
            assets={assets}
            records={records}
            onAddAsset={createAsset}
            onUpdateAsset={(asset) => editAsset(asset.id, asset)}
            onDeleteAsset={removeAsset}
          />
        );
      case 'setting':
        return (
          <SettingTab
            categories={categories}
            paymentMethods={paymentMethods}
            records={records}
            assets={assets}
            recurringRules={recurringRules} // 신규
            baseDay={baseDay}
            onAddCategory={createCategory}
            onDeleteCategory={removeCategory}
            onReorderCategories={reorderCategories}
            onAddPaymentMethod={createPaymentMethod}
            onDeletePaymentMethod={removePaymentMethod}
            onRemoveRecurringRule={removeRecurringRule} // 신규
            onSetBaseDay={handleSetBaseDay}
            onImportData={handleImportData}
            onResetAllData={handleResetAllData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans max-w-lg mx-auto border-x border-gray-200/30 relative">
      {/* 1. 상단 공통 헤더 */}
      <header className="sticky top-0 bg-white/85 backdrop-blur-md border-b border-gray-200/25 px-5 py-4 flex justify-between items-center z-10">
        <h1 
          onClick={() => handleTabChange('calendar')} 
          className="text-lg font-extrabold text-toss-blue tracking-tight cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <TrendingUp size={22} className="text-toss-blue" />
          손쉬운 가계부
        </h1>
        <button
          id="header-setting"
          onClick={handleToggleSetting}
          className={`p-2 rounded-xl transition-all ${
            activeTab === 'setting' ? 'bg-blue-50 text-toss-blue' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-150'
          }`}
          title="설정"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* 2. 메인 바디 영역 */}
      <main className="flex-1 px-5 py-5 overflow-y-auto">
        {renderTabContent()}
      </main>

      {/* 3. 하단 고정 네비게이션 탭 바 */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white/90 backdrop-blur-md border-t border-gray-200/30 flex justify-around py-2.5 z-15 safe-pb">
        <button
          id="tab-calendar"
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold w-16 transition-colors ${
            activeTab === 'calendar' ? 'text-toss-blue' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
          </svg>
          달력
        </button>
        <button
          id="tab-analysis"
          onClick={() => setActiveTab('analysis')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold w-16 transition-colors ${
            activeTab === 'analysis' ? 'text-toss-blue' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
          </svg>
          분석
        </button>
        <button
          id="tab-asset"
          onClick={() => setActiveTab('asset')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold w-16 transition-colors ${
            activeTab === 'asset' ? 'text-toss-blue' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6m18 0V4.5A2.25 2.25 0 0 0 18.75 2.25h-13.5A2.25 2.25 0 0 0 3 4.5V6" />
          </svg>
          자산
        </button>
      </nav>
    </div>
  );
}


