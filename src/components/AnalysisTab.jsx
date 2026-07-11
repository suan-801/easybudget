import React, { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { BarChart3, TrendingUp, Info } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import CustomDropdown from './CustomDropdown';

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
  
   const { currentYear, currentMonth, setCurrentYear, setCurrentMonth, getAllRecords, assets, paymentMethods } = useApp();
   const selectedYear = currentYear;
   const selectedMonth = currentMonth === null ? null : currentMonth - 1; // 0-indexed로 내부 연산 대응 (null인 경우 전체 조회 대응)

   // 자산 ID를 활용해 자산 명칭을 탐색하는 안전 헬퍼
   const getAssetName = (assetId) => {
     if (!assetId) return '자산 미지정';
     const asset = assets.find(a => String(a.id) === String(assetId));
     return asset ? asset.name : '자산 미지정';
   };

   const [yearRecords, setYearRecords] = useState([]);

   // 연도 혹은 가계부 기록이 바뀔 때 해당 연도의 전체 가계부 내역을 로드합니다.
   useEffect(() => {
     getAllRecords().then(allRecs => {
       const mapped = allRecs.map(r => {
         const cat = categories.find(c => c.id === r.categoryId || String(c.id) === String(r.categoryId));
         const pay = paymentMethods.find(p => p.id === r.paymentMethodId || String(p.id) === String(r.paymentMethodId));
         return {
           ...r,
           category: cat ? cat.name : '미분류',
           paymentMethod: pay ? pay.name : '미지정'
         };
       });
       setYearRecords(mapped);
     });
   }, [currentYear, records, categories, paymentMethods, getAllRecords]);

  // 1. 전체 수입/지출 데이터 필터링
  const filteredRecords = records.filter(r => r.type === analysisType);

  // 2. 비중 차트용 데이터 가공 (선택된 년 및 월 기준)
  const getPieData = () => {
    const map = {};
    const targetRecords = yearRecords.filter(r => r.type === analysisType);
    
    targetRecords.forEach(r => {
      const date = new Date(r.date);
      const recordYear = date.getFullYear();
      const recordMonth = date.getMonth();
      const matchesYear = recordYear === selectedYear;
      const matchesMonth = selectedMonth === null ? true : recordMonth === selectedMonth;
      if (matchesYear && matchesMonth) {
        const key = groupBy === 'category' 
          ? r.category 
          : groupBy === 'paymentMethod' 
            ? r.paymentMethod 
            : getAssetName(r.assetId);
        if (!map[key]) map[key] = 0;
        map[key] += Number(r.amount);
      }
    });

    const data = Object.keys(map).map(name => ({
      name,
      value: map[name]
    }));

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

    yearRecords.forEach(r => {
      const date = new Date(r.date);
      if (date.getFullYear() === selectedYear && r.type === analysisType) {
        const itemKey = groupBy === 'category' 
          ? r.category 
          : groupBy === 'paymentMethod' 
            ? r.paymentMethod 
            : getAssetName(r.assetId);
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

    yearRecords.forEach(r => {
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

    months.forEach(m => {
      m.profit = m.income - m.expense;
    });

    return months;
  };

  const trendData = selectedGroupItem ? getMonthlyTrendData(selectedGroupItem) : [];
  const overallTrendData = getOverallMonthlyData();

  // 5. 선택된 년도의 1월~12월 월별 잔액 리스트 가공
  const getMonthlyBalanceList = () => {
    const list = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      name: `${i + 1}월`,
      income: 0,
      expense: 0,
      balance: 0
    }));

    yearRecords.forEach(r => {
      const date = new Date(r.date);
      if (date.getFullYear() === selectedYear) {
        const m = date.getMonth();
        if (r.type === 'income') {
          list[m].income += Number(r.amount);
        } else if (r.type === 'expense') {
          list[m].expense += Number(r.amount);
        }
      }
    });

    list.forEach(m => {
      m.balance = m.income - m.expense;
    });

    return list;
  };

  const monthlyBalanceList = getMonthlyBalanceList();

  // 금액 포맷터
  const formatAmount = (num) => {
    return Number(num).toLocaleString('ko-KR') + '원';
  };

  // 잔액 차트용 만 단위 간소화 포맷터
  const formatChartAmount = (num) => {
    const val = Number(num);
    if (val === 0) return '0';
    
    const isPositive = val > 0;
    const absVal = Math.abs(val);
    const prefix = isPositive ? '+' : '-';
    
    if (absVal >= 10000) {
      const man = absVal / 10000;
      return man % 1 === 0 ? `${prefix}${man}만` : `${prefix}${man.toFixed(1)}만`;
    }
    return `${prefix}${absVal.toLocaleString('ko-KR')}`;
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
            순수익: {formatAmount(data.profit)}
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
        svg:focus, rect:focus, path:focus, g:focus, .recharts-wrapper:focus, .recharts-surface:focus, .recharts-tooltip-wrapper:focus, .recharts-legend-wrapper:focus, .recharts-sector:focus {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* 1. 상단 타이틀 및 연도 선택 */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-extrabold text-gray-800 flex items-center gap-1.5 select-none">
          <TrendingUp size={18} className="text-toss-blue" />
          월별 잔액 리포트
        </h2>
        <CustomDropdown
          options={yearOptions.map(y => ({ value: y, label: `${y}년` }))}
          value={selectedYear}
          onSelect={(value) => {
            setCurrentYear(Number(value));
            setSelectedGroupItem(null);
          }}
          size="sm"
          className="w-24"
        />
      </div>

      {/* 2. 월별 잔액 리포트 가로 스크롤 리스트 */}
      <div className="flex overflow-x-auto gap-2.5 pb-3 mb-2 scroll-smooth -mx-5 px-5 select-none scrollbar-thin">
        {monthlyBalanceList.map((item) => {
          const isSelected = item.monthIndex === selectedMonth;
          const isPositive = item.balance > 0;
          const isNegative = item.balance < 0;
          const amtColor = isPositive ? 'text-income' : isNegative ? 'text-expense' : 'text-gray-400';
          const amtPrefix = isPositive ? '+' : '';
          
          return (
            <div
              key={item.monthIndex}
              onClick={() => {
                if (isSelected) {
                  setCurrentMonth(null);
                } else {
                  setCurrentMonth(item.monthIndex + 1);
                }
                setSelectedGroupItem(null);
              }}
              className={`flex flex-col items-center justify-between p-3 rounded-2xl min-w-[90px] border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-blue-50/70 border-toss-blue/50 shadow-xs'
                  : 'bg-gray-50/60 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <span className={`text-[11px] font-bold ${isSelected ? 'text-toss-blue' : 'text-gray-400'}`}>
                {item.name}
              </span>
              <span className={`text-xs font-extrabold mt-1.5 ${amtColor} truncate max-w-[85px]`}>
                {amtPrefix}{formatAmount(item.balance).replace('원', '')}
              </span>
            </div>
          );
        })}
      </div>

      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-4"></div>

      {/* 3. 비중 상세 목록 및 가로 바 그래프 (중단) */}
      <div className="py-1 flex flex-col w-full">
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 select-none mb-3">
          <BarChart3 size={16} className="text-toss-blue" />
          {selectedMonth === null ? `${selectedYear}년 전체` : `${selectedMonth + 1}월`} {analysisType === 'expense' ? '지출' : '수입'} 비중 및 상세 현황
        </h3>

        {/* 4. 분석 필터 컨트롤러 */}
        <div className="py-2 flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
          {/* 수입 / 지출 선택 */}
          <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {
                setAnalysisType('expense');
                setSelectedGroupItem(null);
              }}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
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
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                analysisType === 'income' ? 'bg-white text-income shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
              }`}
            >
              수입 분석
            </button>
          </div>

          {/* 카테고리 / 결제 수단 / 자산 분류 기준 */}
          <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {
                setGroupBy('category');
                setSelectedGroupItem(null);
              }}
              className={`flex-1 sm:flex-none px-3.5 sm:px-6 py-2 rounded-lg text-[13px] sm:text-sm font-bold transition-all ${
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
              className={`flex-1 sm:flex-none px-3.5 sm:px-6 py-2 rounded-lg text-[13px] sm:text-sm font-bold transition-all ${
                groupBy === 'paymentMethod' ? 'bg-white text-toss-blue shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
              }`}
            >
              결제 수단별
            </button>
            <button
              onClick={() => {
                setGroupBy('asset');
                setSelectedGroupItem(null);
              }}
              className={`flex-1 sm:flex-none px-3.5 sm:px-6 py-2 rounded-lg text-[13px] sm:text-sm font-bold transition-all ${
                groupBy === 'asset' ? 'bg-white text-toss-blue shadow-[0_1px_3px_rgba(0,0,0,0.03)]' : 'text-gray-400'
              }`}
            >
              자산별
            </button>
          </div>
        </div>
        
        <div className="flex flex-col gap-3.5 pr-1 pl-1 py-1">
          {pieData.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Info size={24} className="text-gray-300" />
              <span className="text-xs">{selectedMonth === null ? '해당 연도의' : '이번 달'} 데이터가 존재하지 않습니다.</span>
            </div>
          ) : (
            pieData.map((item, index) => {
              const pct = totalAmount > 0 ? ((item.value / totalAmount) * 100).toFixed(1) : 0;
              const color = COLORS[index % COLORS.length];
              
              const getEmoji = () => {
                if (groupBy === 'category') {
                  return categories.find(c => c.name === item.name)?.emoji || '📁';
                } else if (groupBy === 'paymentMethod') {
                  return '💳';
                } else {
                  // 자산별
                  const assetObj = assets.find(a => a.name === item.name);
                  if (!assetObj) return '📂';
                  switch (assetObj.type) {
                    case 'cash': return '💵';
                    case 'bank': return '🏦';
                    case 'card': return '💳';
                    default: return '📂';
                  }
                }
              };
              const catEmoji = getEmoji();
              
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
          <span className="text-xs font-bold text-gray-400 select-none">총합 ({selectedMonth === null ? `${selectedYear}년 전체` : `${selectedMonth + 1}월`})</span>
          <span className="text-sm font-extrabold text-gray-800">{formatAmount(totalAmount)}</span>
        </div>
      </div>

      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 5. 월별 성과 추이 차트 영역 (하단) */}
      <div className="py-2 w-full animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 select-none">
              <TrendingUp size={16} className="text-toss-blue" />
              {selectedGroupItem ? (
                <span>{selectedGroupItem} - 월별 소비 추이 ({selectedYear}년)</span>
              ) : (
                <span>월별 전체 수입/지출 비교 ({selectedYear}년)</span>
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
              <Tooltip content={selectedGroupItem ? <CustomBarTooltip /> : <CustomOverallTooltip />} cursor={{ fill: '#F9FAFB' }} wrapperStyle={{ outline: 'none' }} />
              
              {selectedGroupItem ? (
                <Bar
                  dataKey="amount"
                  fill={analysisType === 'expense' ? '#F04452' : '#00D387'}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  style={{ outline: 'none' }}
                >
                  {trendData.map((entry, index) => {
                    const isSelected = entry.monthIndex === selectedMonth;
                    const baseColor = analysisType === 'expense' ? '#F04452' : '#00D387';
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isSelected ? baseColor : `${baseColor}60`}
                      />
                    );
                  })}
                </Bar>
              ) : (
                <>
                  <Bar
                    dataKey="income"
                    name="수입"
                    fill="#00D387"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    style={{ outline: 'none' }}
                  >
                    {overallTrendData.map((entry, index) => {
                      const isSelected = entry.monthIndex === selectedMonth;
                      return (
                        <Cell
                          key={`cell-income-${index}`}
                          fill={isSelected ? '#00D387' : '#00D38755'}
                        />
                      );
                    })}
                  </Bar>
                  <Bar
                    dataKey="expense"
                    name="지출"
                    fill="#FF6B6B"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    style={{ outline: 'none' }}
                  >
                    {overallTrendData.map((entry, index) => {
                      const isSelected = entry.monthIndex === selectedMonth;
                      return (
                        <Cell
                          key={`cell-expense-${index}`}
                          fill={isSelected ? '#FF6B6B' : '#FF6B6B55'}
                        />
                      );
                    })}
                  </Bar>
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
