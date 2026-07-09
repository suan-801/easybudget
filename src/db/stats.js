/**
 * 통계 집계 유틸리티
 *
 * 모두 순수 함수(Pure Function)입니다. DB 접근 없이 전달받은 배열만 계산합니다.
 * 차트 컴포넌트에서 records, categories, paymentMethods 를 넘겨 호출하세요.
 */

/**
 * 해당 월의 총 수입/지출/순합 계산
 * @param {object[]} records
 * @returns {{ totalIncome: number, totalExpense: number, net: number }}
 */
export function computeMonthlyStats(records) {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const r of records) {
    if (r.type === 'income') totalIncome += r.amount;
    else totalExpense += r.amount;
  }

  return { totalIncome, totalExpense, net: totalIncome - totalExpense };
}

/**
 * 카테고리별 집계 (Recharts 파이차트용)
 * @param {object[]} records
 * @param {object[]} categories
 * @returns {{ name: string, icon: string, value: number }[]}  value 내림차순 정렬
 */
export function groupByCategory(records, categories) {
  const map = new Map();

  for (const r of records) {
    const cat = categories.find((c) => c.id === r.categoryId);
    const key = cat ? cat.name : '미분류';
    const icon = cat ? cat.icon : '📌';

    if (!map.has(key)) map.set(key, { name: key, icon, value: 0 });
    map.get(key).value += r.amount;
  }

  return [...map.values()].sort((a, b) => b.value - a.value);
}

/**
 * 결제 수단별 집계 (Recharts 파이차트용)
 * @param {object[]} records
 * @param {object[]} paymentMethods
 * @returns {{ name: string, icon: string, value: number }[]}  value 내림차순 정렬
 */
export function groupByPaymentMethod(records, paymentMethods) {
  const map = new Map();

  for (const r of records) {
    const method = paymentMethods.find((m) => m.id === r.paymentMethodId);
    const key = method ? method.name : '미분류';
    const icon = method ? method.icon : '💳';

    if (!map.has(key)) map.set(key, { name: key, icon, value: 0 });
    map.get(key).value += r.amount;
  }

  return [...map.values()].sort((a, b) => b.value - a.value);
}

/**
 * 날짜별 집계 (달력 뷰용)
 * @param {object[]} records
 * @returns {Record<string, { income: number, expense: number, records: object[] }>}
 */
export function groupByDate(records) {
  const map = {};

  for (const r of records) {
    if (!map[r.date]) map[r.date] = { income: 0, expense: 0, records: [] };
    if (r.type === 'income') map[r.date].income += r.amount;
    else map[r.date].expense += r.amount;
    map[r.date].records.push(r);
  }

  return map;
}

/**
 * 최근 N개월 월별 수입/지출 집계 (Recharts 막대그래프용)
 * @param {object[]} allRecords  전체 거래 내역 (연월 무관)
 * @param {number}   monthCount  표시할 개월 수 (기본 6)
 * @returns {{ yearMonth: string, label: string, income: number, expense: number }[]}
 */
export function buildMonthlyBarData(allRecords, monthCount = 6) {
  const now = new Date();
  const result = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getMonth() + 1}월`;

    let income = 0;
    let expense = 0;
    for (const r of allRecords) {
      if (r.yearMonth !== yearMonth) continue;
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    }

    result.push({ yearMonth, label, income, expense });
  }

  return result;
}

/**
 * 특정 카테고리/결제수단의 월별 지출 추이 (분석 탭 드릴다운용)
 * @param {object[]} allRecords
 * @param {'categoryId' | 'paymentMethodId'} groupKey
 * @param {number}   groupId
 * @param {number}   monthCount
 */
export function buildDrilldownBarData(allRecords, groupKey, groupId, monthCount = 6) {
  const filtered = allRecords.filter((r) => r[groupKey] === groupId);
  return buildMonthlyBarData(filtered, monthCount);
}
