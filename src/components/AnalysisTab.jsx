import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Info } from 'lucide-react';

// 차트용 토스 감성 파스텔톤 컬러 팔레트
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

  // 당해 연도 추출 (가계부 분석 범위는 주로 당해 연도)
  const currentYear = new Date().getFullYear();

  // 1. 전체 수입/지출 데이터 필터링
  const filteredRecords = records.filter(r => r.type === analysisType);

  // 2. 비중 차트용 데이터 가공 (카테고리별 혹은 결제 수단별)
  const getPieData = () => {
    const map = {};
    filteredRecords.forEach(r => {
      const key = groupBy === 'category' ? r.category : r.paymentMethod;
      if (!map[key]) map[key] = 0;
      map[key] += Number(r.amount);
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

  // 3. 특정 항목(예: '식비')의 월별 지출/수입 추이 데이터 가공
  const getMonthlyTrendData = (itemName) => {
    // 1월부터 12월까지 초기화
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      monthIndex: i,
      amount: 0
    }));

    records.forEach(r => {
      const date = new Date(r.date);
      // 당해 연도에 해당하며, 수입/지출 유형이 일치하고, 카테고리/결제수단 조건이 일치하는 경우
      if (date.getFullYear() === currentYear && r.type === analysisType) {
        const itemKey = groupBy === 'category' ? r.category : r.paymentMethod;
        if (itemKey === itemName) {
          const m = date.getMonth();
          months[m].amount += Number(r.amount);
        }
      }
    });

    return months;
  };

  // 4. 월별 전체 수입 / 지출 합산 트렌드 데이터 가공
  const getOverallMonthlyData = () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      monthIndex: i,
      income: 0,
      expense: 0
    }));

    records.forEach(r => {
      const date = new Date(r.date);
      if (date.getFullYear() === currentYear) {
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

  // 파이 차트 커스텀 툴팁
  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalAmount > 0 ? ((data.value / totalAmount) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white p-3 rounded-xl border border-gray-200/40 text-xs shadow-md">
          <p className="font-bold text-gray-800">{data.name}</p>
          <p className="text-toss-blue font-semibold mt-1">{formatAmount(data.value)}</p>
          <p className="text-gray-400 mt-0.5">{percentage}% 비중</p>
        </div>
      );
    }
    return null;
  };

  // 단일 항목 막대 차트 커스텀 툴팁
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl border border-gray-200/40 text-xs shadow-md">
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

  // 막대 그래프 클릭 시 이벤트 (해당 월 상세 화면으로 이동)
  const handleBarClick = (data) => {
    if (data && data.monthIndex !== undefined) {
      // 부모 컴포넌트에 해당 년, 월 전달하여 필터링 및 탭 이동 수행
      onSelectMonth(currentYear, data.monthIndex);
    }
  };

  return (
    <div className="flex flex-col pb-24 animate-fade-in text-left">
      {/* 1. 분석 필터 컨트롤러 */}
      <div className="py-2.5 flex flex-col md:flex-row justify-between items-center gap-3">
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

      {/* 2. 원형 차트 영역 (상단) */}
      <div className="py-4 flex flex-col items-center justify-center min-h-[260px] bg-white rounded-2xl border border-gray-150/40 p-4">
        <h3 className="font-bold text-gray-800 text-sm self-start mb-2 flex items-center gap-1.5 select-none">
          <PieChartIcon size={16} className="text-toss-blue" />
          {analysisType === 'expense' ? '지출' : '수입'} 비중 분포
        </h3>
        {pieData.length === 0 ? (
          <div className="text-gray-400 text-sm flex flex-col items-center gap-2 py-12">
            <Info size={32} className="text-gray-300" />
            <span>차트를 렌더링할 데이터가 부족합니다.</span>
          </div>
        ) : (
          <div className="w-full h-[240px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-10px]">
              <span className="block text-[10px] font-bold text-gray-400 tracking-wider">TOTAL</span>
              <span className="text-base font-extrabold text-gray-800 block truncate max-w-[140px] mx-auto">
                {Number(totalAmount).toLocaleString('ko-KR')}원
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 3. 비중 목록 영역 (중단) */}
      <div className="py-4 flex flex-col bg-white rounded-2xl border border-gray-150/40 p-5">
        <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-1.5 select-none">
          <PieChartIcon size={16} className="text-toss-blue" />
          {analysisType === 'expense' ? '지출' : '수입'} 비중 상세 목록
        </h3>
        
        {/* 잘림 방지를 위해 리스트 컨테이너에 px-1 추가 */}
        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1 pl-1 py-1">
          {pieData.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Info size={24} className="text-gray-300" />
              <span className="text-xs">데이터가 존재하지 않습니다.</span>
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
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    selectedGroupItem === item.name 
                      ? 'bg-blue-50/50 border-toss-blue/35 shadow-sm' 
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                  style={{ boxSizing: 'border-box' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                    <span className="text-xs text-gray-400 font-medium shrink-0">{catEmoji}</span>
                    <span className="text-xs font-bold text-gray-700 truncate">{item.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold text-gray-800">{formatAmount(item.value)}</div>
                    <div className="text-[10px] text-gray-400 font-bold">{pct}%</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <div className="border-t border-gray-100 pt-4 mt-4 flex justify-between items-center px-1">
          <span className="text-xs font-bold text-gray-400">총합</span>
          <span className="text-sm font-extrabold text-gray-800">{formatAmount(totalAmount)}</span>
        </div>
      </div>

      {/* 디바이더 밴드 */}
      <div className="-mx-5 h-2.5 bg-[#F2F4F6] my-5"></div>

      {/* 4. 월별 성과 추이 차트 영역 (하단) */}
      <div className="py-4 bg-white rounded-2xl border border-gray-150/40 p-5 animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 select-none">
              <TrendingUp size={16} className="text-toss-blue" />
              {selectedGroupItem ? (
                <span>{selectedGroupItem} - 월별 소비 추이 ({currentYear}년)</span>
              ) : (
                <span>월별 전체 소비 추이 ({currentYear}년)</span>
              )}
            </h3>
            <p className="text-[10px] text-gray-400 mt-1 select-none">
              {selectedGroupItem ? '막대 그래프를 클릭하면 해당 월의 가계부 달력 뷰로 이동합니다.' : '수입/지출 비교를 통해 소비 패턴을 점검해 보세요.'}
            </p>
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
                  onClick={(data) => handleBarClick(data)}
                />
              ) : (
                <>
                  <Bar
                    dataKey="income"
                    name="수입"
                    fill="#00D387"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => handleBarClick(data)}
                  />
                  <Bar
                    dataKey="expense"
                    name="지출"
                    fill="#FF6B6B"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => handleBarClick(data)}
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
