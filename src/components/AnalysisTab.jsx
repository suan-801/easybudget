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

  const trendData = selectedGroupItem ? getMonthlyTrendData(selectedGroupItem) : [];

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
        <div className="bg-white p-3 rounded-xl border border-gray-200/40 text-xs">
          <p className="font-bold text-gray-800">{data.name}</p>
          <p className="text-toss-blue font-semibold mt-1">{formatAmount(data.value)}</p>
          <p className="text-gray-400 mt-0.5">{percentage}% 비중</p>
        </div>
      );
    }
    return null;
  };

  // 막대 차트 커스텀 툴팁
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl border border-gray-200/40 text-xs">
          <p className="font-bold text-gray-800">{payload[0].payload.name}</p>
          <p className="text-toss-blue font-semibold mt-1">총액: {formatAmount(payload[0].value)}</p>
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
    <div className="flex flex-col gap-5 pb-24 animate-fade-in">
      {/* 1. 분석 필터 컨트롤러 */}
      <div className="bg-white p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-3">
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

      {/* 2. 메인 통계 및 원형 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 비중 리스트 카드 */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-1.5">
              <PieChartIcon size={16} className="text-toss-blue" />
              {analysisType === 'expense' ? '지출' : '수입'} 비중 목록
            </h3>
            
            <div className="flex flex-col gap-3.5 max-h-[300px] overflow-y-auto pr-1">
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
                      onClick={() => setSelectedGroupItem(item.name)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${
                        selectedGroupItem === item.name ? 'bg-blue-50/50 ring-1 ring-toss-blue/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                        <span className="text-xs text-gray-400 font-medium">{catEmoji}</span>
                        <span className="text-xs font-bold text-gray-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-800">{formatAmount(item.value)}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{pct}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-4 mt-4 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400">총합</span>
            <span className="text-sm font-extrabold text-gray-800">{formatAmount(totalAmount)}</span>
          </div>
        </div>

        {/* 차트 렌더링 카드 */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl flex flex-col items-center justify-center min-h-[300px]">
          {pieData.length === 0 ? (
            <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
              <Info size={32} className="text-gray-300" />
              <span>차트를 렌더링할 데이터가 부족합니다.</span>
            </div>
          ) : (
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
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
              <div className="text-center -mt-36">
                <span className="block text-[10px] font-bold text-gray-400 tracking-wider">TOTAL</span>
                <span className="text-base font-extrabold text-gray-800 block truncate max-w-[140px] mx-auto">
                  {Number(totalAmount).toLocaleString('ko-KR')}
                </span>
              </div>
              <div className="h-28"></div> {/* 공간 보정용 */}
            </div>
          )}
        </div>
      </div>

      {/* 3. 항목별 월별 추이 차트 (드릴다운 화면) */}
      {selectedGroupItem && (
        <div className="bg-white p-5 rounded-2xl animate-slide-up">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <TrendingUp size={16} className="text-toss-blue" />
                {selectedGroupItem} - 월별 지출 추이 ({currentYear}년)
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">
                막대 그래프를 클릭하면 해당 월의 가계부 달력 뷰로 이동합니다.
              </p>
            </div>
            <button
              onClick={() => setSelectedGroupItem(null)}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold"
            >
              닫기
            </button>
          </div>

          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8B95A1' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B95A1' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar
                  dataKey="amount"
                  fill={analysisType === 'expense' ? '#F04452' : '#00D387'}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => handleBarClick(data)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
