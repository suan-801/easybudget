import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Info } from 'lucide-react';

// 차트 및 프로그레스바용 토스 감성 파스텔톤 컬러 팔레트
const COLORS = [
  '#3182F6', // 토스 블루
  '#00D387', // 수입 그린
  '#FF6B6B', // 부드러운 레드
  '#F5A623', // 오렌지
  '#7B61FF', // 퍼플
  '#4A90E2', // 라이트 블루
  '#FF8A65', // 연어 핑크
  '#9B51E0', // 딥 퍼플
  '#27AE60', // 포레스트 그린
];

export default function AnalysisTab({ records, categories, onSwitchTab, onSelectMonth }) {
  const [analysisType, setAnalysisType] = useState('expense'); // 'expense' | 'income'
  const [groupBy, setGroupBy] = useState('category'); // 'category' | 'paymentMethod'
  const [selectedGroupItem, setSelectedGroupItem] = useState(null); // 클릭하여 상세 분석할 항목명
  
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear()); // 연도 선택 상태
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 월 선택 상태 (0-indexed)

  // 1. 전체 수입/지출 데이터 필터링
  const filteredRecords = records.filter(r => r.type === analysisType);

  // 2. 비중 차트용 데이터 가공 (선택된 년 및 월 기준)
  const getPieData = () => {
    const map = {};
    filteredRecords.forEach(r => {
      const date = new Date(r.date);
      // 연도와 월이 모두 일치하는 경우만 비중에 반영 (월별 상세 분석 구현)
      if (date.getFullYear() === selectedYear && date.getMonth() === selectedMonth) {
        const key = groupBy === 'category' ? r.category : r.paymentMethod;
        if (!map[key]) map[key] = 0;
        map[key] += Number(r.amount);
      }
    });

    const data = Object.keys(map).map(name => ({
      name,
      value: map[name]
    }));

    // 큰 순서대로 정렬
    return data.sort((a, b) => b.value - a.value);
  };

  const pieData = getPieData();
  const totalAmount = pieData.reduce((sum, item) => sum + item.value, 0);

  // 3. 특정 항목(예: '식비')의 연간 월별 지출/수입 추이 데이터 가공 (선택된 연도 기준)
  const getMonthlyTrendData = (itemName) => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      monthIndex: i,
      amount: 0
    }));

    records.forEach(r => {
      const date = new Date(r.date);
      if (date.getFullYear() === selectedYear && r.type === analysisType) {
        const itemKey = groupBy === 'category' ? r.category : r.paymentMethod;
        if (itemKey === itemName) {
          const m = date.getMonth();
          months[m].amount += Number(r.amount);
        }
      }
    });

    return months;
  };

  // 4. 연간 월별 전체 수입 / 지출 합산 트렌드 데이터 가공 (선택된 연도 기준)
  const getOverallMonthlyData = () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      monthIndex: i,
      income: 0,
      expense: 0
    }));

    records.forEach(r => {
      const date = new Date(r.date);
      if (date.getFullYear() === selectedYear) {
        const m = date.getMonth();
        if (r.type === 'income') {
          months[m].income += Number(r.amount);
        } else if (r.type === 'expense') {
          months[m].expense += Number(r.amount);
        }
      }
    });

    return months;
  };

  const trendData = selectedGroupItem ? getMonthlyTrendData(selectedGroupItem) : [];
  const overallTrendData = getOverallMonthlyData();

  // 금액 포맷터
  const formatAmount = (num) => {
    return Number(num).toLocaleString('ko-KR') + '원';
  };

  // 단일 항목 막대 차트 커스텀 툴팁
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl border border-gray-150/40 text-xs shadow-md">
          <p className="font-bold text-gray-800">{payload[0].payload.name}</p>
          <p className="text-toss-blue font-semibold mt-1">총액: {formatAmount(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  // 전체 수입/지출 비교 막대 차트 커스텀 툴팁
  const CustomOverallTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl border border-gray-200/40 text-xs shadow-md">
          <p className="font-bold text-gray-800">{data.name} 전체 성과</p>
          <p className="text-income font-semibold mt-1">수입: {formatAmount(data.income)}</p>
          <p className="text-expense font-semibold mt-0.5">지출: {formatAmount(data.expense)}</p>
          <p className="text-toss-blue font-bold mt-1 border-t border-gray-150 pt-1">
            순소비: {formatAmount(data.income - data.expense)}
          </p>
        </div>
      );
    }
    return null;
  };

  // 가계부 데이터가 생성된 연도 범위 목록 생성 (연도 드롭다운 옵션용)
  const getYearOptions = () => {
    const years = new Set();
    years.add(new Date().getFullYear()); // 기본값으로 올해 연도는 무조건 포함
    records.forEach(r => {
      const y = new Date(r.date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a); // 최신 연도가 위로 오도록 정렬
  };

  const yearOptions = getYearOptions();

  return (
    <div className="flex flex-col pb-24 animate-fade-in text-left">
      {/* 차트 선택/포커스 시 검은색 굵은 테두리 아웃라인을 원천 제거하는 인라인 스타일 */}
      <style>{`
        svg:focus, rect:focus, path:focus, g:focus, .recharts-wrapper:focus, .recharts-surface:focus {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* 1. 분석 필터 컨트롤러 */}
      <div className="py-2 flex flex-col md:flex-row justify-between items-center gap-3">
        {/* 수입 / 지출 선택 */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => {
              setAnalysisType('expense');
              setSelectedGroupItem(null);
            }}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              analysisType === 'expense' ? 'bg-white text-expense shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
            }`}
          >
            지출 분석
          </button>
          <button
            onClick={() => {
              setAnalysisType('income');
              setSelectedGroupItem(null);
            }}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              analysisType === 'income' ? 'bg-white text-income shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
            }`}
          >
            수입 분석
          </button>
        </div>

        {/* 카테고리 / 결제 수단 분류 기준 */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => {
              setGroupBy('category');
              setSelectedGroupItem(null);
            }}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              groupBy === 'category' ? 'bg-white text-toss-blue shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
            }`}
          >
            카테고리별
          </button>
          <button
            onClick={() => {
              setGroupBy('paymentMethod');
              setSelectedGroupItem(null);
            }}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              groupBy === 'paymentMethod' ? 'bg-white text-toss-blue shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
            }`}
          >
            결제 수단별
          </button>
        </div>
      </div>

      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 2. 비중 상세 목록 및 가로 바 그래프 (중단) */}
      <div className="py-2 flex flex-col w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 select-none">
            <BarChart3 size={16} className="text-toss-blue" />
            {analysisType === 'expense' ? '지출' : '수입'} 비중 및 상세 현황 ({selectedYear}년 {selectedMonth + 1}월)
          </h3>
          
          {/* 연도 및 월 세부 선택 컨트롤러 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setSelectedGroupItem(null);
              }}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold text-gray-750 cursor-pointer focus:ring-2 focus:ring-toss-blue outline-none"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(Number(e.target.value));
                setSelectedGroupItem(null);
              }}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold text-gray-750 cursor-pointer focus:ring-2 focus:ring-toss-blue outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>{i + 1}월</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex flex-col gap-3.5 pr-1 pl-1 py-1">
          {pieData.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Info size={24} className="text-gray-300" />
              <span className="text-xs">이번 달 데이터가 존재하지 않습니다.</span>
            </div>
          ) : (
            pieData.map((item, index) => {
              const pct = totalAmount > 0 ? ((item.value / totalAmount) * 100).toFixed(1) : 0;
              const color = COLORS[index % COLORS.length];
              const catEmoji = groupBy === 'category' ? categories.find(c => c.name === item.name)?.emoji || '📁' : '💳';
              
              return (
                <div
                  key={item.name}
                  onClick={() => setSelectedGroupItem(selectedGroupItem === item.name ? null : item.name)}
                  className={`flex flex-col gap-2 p-3.5 rounded-xl cursor-pointer transition-all border ${
                    selectedGroupItem === item.name 
                      ? 'bg-blue-50/50 border-toss-blue/35 shadow-xs' 
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                  style={{ boxSizing: 'border-box' }}
                >
                  <div className="flex items-center justify-between min-w-0 w-full select-none">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                      <span className="text-xs text-gray-400 font-medium shrink-0">{catEmoji}</span>
                      <span className="text-xs font-bold text-gray-700 truncate">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-xs font-extrabold text-gray-800">{formatAmount(item.value)}</span>
                      <span className="text-[10px] text-gray-400 font-bold w-10 text-right">{pct}%</span>
                    </div>
                  </div>

                  {/* 세련된 가로 바 그래프 게이지 */}
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${pct}%`, 
                        backgroundColor: color
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <div className="border-t border-gray-100 pt-4 mt-4 flex justify-between items-center px-1">
          <span className="text-xs font-bold text-gray-400 select-none">총합 ({selectedMonth + 1}월)</span>
          <span className="text-sm font-extrabold text-gray-800">{formatAmount(totalAmount)}</span>
        </div>
      </div>

      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 3. 월별 성과 추이 차트 영역 (하단) */}
      <div className="py-2 w-full animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 select-none">
              <TrendingUp size={16} className="text-toss-blue" />
              {selectedGroupItem ? (
                <span>{selectedGroupItem} - 월별 소비 추이 ({selectedYear}년)</span>
              ) : (
                <span>월별 전체 소비 추이 ({selectedYear}년)</span>
              )}
            </h3>
          </div>
          {selectedGroupItem && (
            <button
              onClick={() => setSelectedGroupItem(null)}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold px-2.5 py-1 bg-gray-100 rounded-lg transition-colors"
            >
              전체 보기
            </button>
          )}
        </div>

        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={selectedGroupItem ? trendData : overallTrendData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8B95A1' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8B95A1' }} tickLine={false} axisLine={false} />
              <Tooltip content={selectedGroupItem ? <CustomBarTooltip /> : <CustomOverallTooltip />} cursor={{ fill: '#F9FAFB' }} />
              
              {selectedGroupItem ? (
                <Bar
                  dataKey="amount"
                  fill={analysisType === 'expense' ? '#F04452' : '#00D387'}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  style={{ outline: 'none' }}
                />
              ) : (
                <>
                  <Bar
                    dataKey="income"
                    name="수입"
                    fill="#00D387"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    style={{ outline: 'none' }}
                  />
                  <Bar
                    dataKey="expense"
                    name="지출"
                    fill="#FF6B6B"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    style={{ outline: 'none' }}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
