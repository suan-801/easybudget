/**
 * AppContext — 프론트엔드 전용 React Context
 *
 * 모든 컴포넌트에서 useApp() 훅으로 접근합니다.
 * 백엔드 IndexedDB 데이터 규격과 프론트엔드 컴포넌트 간의 맵핑 및
 * 앱 접속 시점의 도래일 계산 반복 내역 자동 주입 스케줄러를 처리합니다.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  initDB,
  getAllAssets,
  getAllCategories,
  getAllPaymentMethods,
  getAllRecords,
  getRecordsByYearMonth,
  getAll, // database.js의 원본 getAll 노출
} from '../db/database.js';

import {
  addRecord,
  updateRecord,
  deleteRecord,
  addAsset,
  updateAsset,
  deleteAsset,
  addCategory,
  updateCategory,
  deleteCategory,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  addRecurringRule,
  updateRecurringRule,
  deleteRecurringRule, // 신규 반복 규칙 CRUD
} from '../db/assetEngine.js';

import { exportToExcel, parseExcelFile, mapImportedRows } from '../db/excel.js';

const AppContext = createContext(null);

// ==========================================
// [데이터 맵핑 헬퍼 함수 정의]
// ==========================================

function _mapRecords(recs, cats, methods) {
  return recs.map((r) => {
    const cat = cats.find((c) => c.id === r.categoryId || String(c.id) === String(r.categoryId));
    const pay = methods.find((p) => p.id === r.paymentMethodId || String(p.id) === String(r.paymentMethodId));
    return {
      ...r,
      category: cat ? cat.name : '미분류',
      paymentMethod: pay ? pay.name : '미지정',
      isRecurring: r.repeat && r.repeat !== 'none',
      recurringPeriod: r.repeat || 'none'
    };
  });
}

function _mapAssets(assetList) {
  return assetList.map((a) => ({
    ...a,
    balance: a.currentBalance ?? a.initialBalance ?? 0
  }));
}

function _mapCategories(cats) {
  return cats
    .map((c) => ({
      ...c,
      emoji: c.icon || '📌'
    }))
    .sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 9999;
      const orderB = b.order !== undefined ? b.order : 9999;
      return orderA - orderB;
    });
}

// ==========================================
// [자동 반복 내역 주입 스케줄러 알고리즘]
// ==========================================

function getNextTargetDate(baseDateStr, period, interval) {
  const date = new Date(baseDateStr);
  if (period === 'daily') {
    date.setDate(date.getDate() + interval);
  } else if (period === 'weekly') {
    date.setDate(date.getDate() + (interval * 7));
  } else if (period === 'monthly') {
    date.setMonth(date.getMonth() + interval);
  }
  return date;
}

async function processRecurringRules(rules) {
  const todayStr = new Date().toISOString().split('T')[0];
  let anyGenerated = false;

  for (const rule of rules) {
    let currentDate = rule.lastGeneratedDate 
      ? getNextTargetDate(rule.lastGeneratedDate, rule.period, rule.interval)
      : new Date(rule.startDate);
      
    let genCount = rule.generatedCount || 0;
    let lastGenDate = rule.lastGeneratedDate;

    while (true) {
      const curStr = currentDate.toISOString().split('T')[0];
      
      // 오늘 날짜보다 미래라면 생성 중지
      if (curStr > todayStr) break;
      
      // 종료날짜 조건 체크
      if (rule.endType === 'date' && rule.endDate && curStr > rule.endDate) {
        break;
      }
      
      // 실행 횟수 조건 체크
      if (rule.endType === 'count' && rule.endCount && genCount >= rule.endCount) {
        break;
      }

      // 내역 실제 데이터 주입
      const recordData = {
        type: rule.type,
        amount: Number(rule.amount),
        date: curStr,
        categoryId: rule.categoryId,
        paymentMethodId: rule.paymentMethodId,
        assetId: rule.assetId,
        memo: rule.memo ? `${rule.memo} (반복)` : '반복 내역 자동 주입',
        repeat: `${rule.interval}${rule.period === 'daily' ? '일' : rule.period === 'weekly' ? '주' : '달'}마다`
      };
      
      await addRecord(recordData);
      
      anyGenerated = true;
      genCount += 1;
      lastGenDate = curStr;

      // 다음 발생 예정일 계산
      currentDate = getNextTargetDate(curStr, rule.period, rule.interval);
    }

    // 규칙 상태 변경 사항을 DB에 업데이트
    if (lastGenDate !== rule.lastGeneratedDate) {
      await updateRecurringRule(rule.id, {
        lastGeneratedDate: lastGenDate,
        generatedCount: genCount
      });
    }
  }
  return anyGenerated;
}

export function AppProvider({ children }) {
  const now = new Date();
  const [isReady, setIsReady] = useState(false);
  const [dbError, setDbError] = useState(null);

  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  const [records, setRecords] = useState([]);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]); // 신규 반복 규칙 목록 상태

  // DB 초기화 및 반복 스케줄러 작동
  useEffect(() => {
    initDB()
      .then(() =>
        Promise.all([
          getRecordsByYearMonth(now.getFullYear(), now.getMonth() + 1),
          getAllAssets(),
          getAllCategories(),
          getAllPaymentMethods(),
          getAll('recurringRules')
        ])
      )
      .then(async ([recs, assetList, cats, methods, rules]) => {
        const mappedCats = _mapCategories(cats);
        const mappedAssets = _mapAssets(assetList);
        
        setCategories(mappedCats);
        setPaymentMethods(methods);
        setAssets(mappedAssets);
        setRecurringRules(rules);

        // 앱 실행 시 반복 도래일 체크 및 인서트
        let finalRecs = recs;
        try {
          const anyGen = await processRecurringRules(rules);
          if (anyGen) {
            finalRecs = await getRecordsByYearMonth(now.getFullYear(), now.getMonth() + 1);
            setAssets(_mapAssets(await getAllAssets()));
            // 변경된 규칙 상태 갱신
            setRecurringRules(await getAll('recurringRules'));
          }
        } catch (err) {
          console.error('반복 내역 주입 실패:', err);
        }

        setRecords(_sortRecords(_mapRecords(finalRecs, mappedCats, methods)));
        setIsReady(true);
      })
      .catch((err) => setDbError(err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 연/월 변경 시 해당 월 내역 재조회 및 맵핑
  useEffect(() => {
    if (!isReady) return;
    getRecordsByYearMonth(currentYear, currentMonth).then((recs) =>
      setRecords(_sortRecords(_mapRecords(recs, categories, paymentMethods)))
    );
  }, [currentYear, currentMonth, isReady, categories, paymentMethods]);

  function _sortRecords(recs) {
    return recs.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  const _refreshRecords = useCallback(async () => {
    const recs = await getRecordsByYearMonth(currentYear, currentMonth);
    setRecords(_sortRecords(_mapRecords(recs, categories, paymentMethods)));
  }, [currentYear, currentMonth, categories, paymentMethods]);

  const _refreshAssets = useCallback(async () => {
    const assetList = await getAllAssets();
    setAssets(_mapAssets(assetList));
  }, []);

  // ---------------------------------------------------------------------------
  // Record operations
  // ---------------------------------------------------------------------------

  const createRecord = useCallback(
    async (data) => {
      const cat = categories.find((c) => c.name === data.category && c.type === data.type);
      const pay = paymentMethods.find((p) => p.name === data.paymentMethod);
      
      const parsedAssetId = data.assetId 
        ? (isNaN(Number(data.assetId)) ? data.assetId : Number(data.assetId)) 
        : null;

      const recordData = {
        type: data.type,
        amount: Number(data.amount),
        date: data.date,
        categoryId: cat ? cat.id : null,
        paymentMethodId: pay ? pay.id : null,
        assetId: parsedAssetId,
        memo: data.memo || '',
        repeat: data.recurringPeriod || 'none'
      };

      await addRecord(recordData);
      await Promise.all([_refreshRecords(), _refreshAssets()]);
    },
    [categories, paymentMethods, _refreshRecords, _refreshAssets]
  );

  const editRecord = useCallback(
    async (id, data) => {
      const cat = categories.find((c) => c.name === data.category && c.type === data.type);
      const pay = paymentMethods.find((p) => p.name === data.paymentMethod);
      
      const parsedAssetId = data.assetId 
        ? (isNaN(Number(data.assetId)) ? data.assetId : Number(data.assetId)) 
        : null;

      const changes = {
        type: data.type,
        amount: Number(data.amount),
        date: data.date,
        categoryId: cat ? cat.id : null,
        paymentMethodId: pay ? pay.id : null,
        assetId: parsedAssetId,
        memo: data.memo || '',
        repeat: data.recurringPeriod || 'none'
      };

      await updateRecord(id, changes);
      await Promise.all([_refreshRecords(), _refreshAssets()]);
    },
    [categories, paymentMethods, _refreshRecords, _refreshAssets]
  );

  const removeRecord = useCallback(
    async (id) => {
      await deleteRecord(id);
      await Promise.all([_refreshRecords(), _refreshAssets()]);
    },
    [_refreshRecords, _refreshAssets]
  );

  // ---------------------------------------------------------------------------
  // Asset operations
  // ---------------------------------------------------------------------------

  const createAsset = useCallback(async (data) => {
    const assetData = {
      name: data.name,
      type: data.type,
      initialBalance: Number(data.balance ?? data.initialBalance ?? 0)
    };
    await addAsset(assetData);
    await _refreshAssets();
  }, [_refreshAssets]);

  const editAsset = useCallback(async (id, data) => {
    const changes = {
      name: data.name,
      type: data.type,
      initialBalance: Number(data.initialBalance ?? data.balance ?? 0)
    };
    await updateAsset(id, changes);
    await _refreshAssets();
  }, [_refreshAssets]);

  const removeAsset = useCallback(async (id) => {
    await deleteAsset(id);
    await _refreshAssets();
  }, [_refreshAssets]);

  // ---------------------------------------------------------------------------
  // Category operations
  // ---------------------------------------------------------------------------

  const createCategory = useCallback(async (data) => {
    const catData = {
      name: data.name,
      type: data.type,
      icon: data.emoji || '📌'
    };
    await addCategory(catData);
    const cats = await getAllCategories();
    setCategories(_mapCategories(cats));
  }, []);

  const editCategory = useCallback(async (id, changes) => {
    await updateCategory(id, changes);
    const cats = await getAllCategories();
    setCategories(_mapCategories(cats));
  }, []);

  const removeCategory = useCallback(async (id) => {
    await deleteCategory(id);
    const cats = await getAllCategories();
    setCategories(_mapCategories(cats));
  }, []);

  const reorderCategories = useCallback(async (orderedIds) => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      await updateCategory(id, { order: i });
    }
    const cats = await getAllCategories();
    setCategories(_mapCategories(cats));
  }, []);

  // ---------------------------------------------------------------------------
  // PaymentMethod operations
  // ---------------------------------------------------------------------------

  const createPaymentMethod = useCallback(async (data) => {
    await addPaymentMethod(data);
    setPaymentMethods(await getAllPaymentMethods());
  }, []);

  const editPaymentMethod = useCallback(async (id, changes) => {
    await updatePaymentMethod(id, changes);
    setPaymentMethods(await getAllPaymentMethods());
  }, []);

  const removePaymentMethod = useCallback(async (id) => {
    await deletePaymentMethod(id);
    setPaymentMethods(await getAllPaymentMethods());
  }, []);

  // ---------------------------------------------------------------------------
  // RecurringRule operations (신규 반복 규칙 API 노출)
  // ---------------------------------------------------------------------------

  const createRecurringRule = useCallback(async (data) => {
    const cat = categories.find((c) => c.name === data.category && c.type === data.type);
    const pay = paymentMethods.find((p) => p.name === data.paymentMethod);
    const asset = assets.find((a) => a.name === data.assetName);

    const ruleData = {
      type: data.type,
      amount: Number(data.amount),
      categoryId: cat ? cat.id : null,
      paymentMethodId: pay ? pay.id : null,
      assetId: asset ? asset.id : null,
      memo: data.memo || '',
      period: data.period, // 'daily' | 'weekly' | 'monthly'
      interval: Number(data.interval || 1),
      startDate: data.startDate,
      endType: data.endType, // 'none' | 'date' | 'count'
      endDate: data.endDate || null,
      endCount: data.endCount ? Number(data.endCount) : null
    };

    await addRecurringRule(ruleData);
    setRecurringRules(await getAll('recurringRules'));
    
    // 규칙을 추가했으므로 도래일 체크를 한 번 더 구동
    try {
      const anyGen = await processRecurringRules(await getAll('recurringRules'));
      if (anyGen) {
        await Promise.all([_refreshRecords(), _refreshAssets()]);
      }
    } catch (err) {
      console.error(err);
    }
  }, [categories, paymentMethods, assets, _refreshRecords, _refreshAssets]);

  const removeRecurringRule = useCallback(async (id) => {
    await deleteRecurringRule(id);
    setRecurringRules(await getAll('recurringRules'));
  }, []);

  // ---------------------------------------------------------------------------
  // Statistics helpers
  // ---------------------------------------------------------------------------

  const monthlyStats = computeMonthlyStats(records);
  const recordsByDate = groupByDate(records);

  const getStatsByCategory = useCallback(
    (recs) => groupByCategory(recs ?? records, categories),
    [records, categories]
  );

  const getStatsByPaymentMethod = useCallback(
    (recs) => groupByPaymentMethod(recs ?? records, paymentMethods),
    [records, paymentMethods]
  );

  const getMonthlyBarData = useCallback(async (monthCount = 6) => {
    const allRecs = await getAllRecords();
    return buildMonthlyBarData(allRecs, monthCount);
  }, []);

  const getDrilldownBarData = useCallback(async (groupKey, groupId, monthCount = 6) => {
    const allRecs = await getAllRecords();
    return buildDrilldownBarData(allRecs, groupKey, groupId, monthCount);
  }, []);

  // ---------------------------------------------------------------------------
  // Excel operations
  // ---------------------------------------------------------------------------

  const handleExport = useCallback(async () => {
    const allRecs = await getAllRecords();
    return exportToExcel(allRecs, categories, paymentMethods);
  }, [categories, paymentMethods]);

  const handleImport = useCallback(
    async (file) => {
      const result = await parseExcelFile(file);
      if (!result.valid) throw new Error(result.error);

      const mapped = mapImportedRows(result.rows, categories, paymentMethods);
      for (const row of mapped) {
        await addRecord(row);
      }

      await Promise.all([_refreshRecords(), _refreshAssets()]);
      return mapped.length;
    },
    [categories, paymentMethods, _refreshRecords, _refreshAssets]
  );

  // ---------------------------------------------------------------------------

  const value = {
    isReady,
    dbError,
    currentYear,
    currentMonth,
    setCurrentYear,
    setCurrentMonth,
    records,
    assets,
    categories,
    paymentMethods,
    recurringRules,
    createRecurringRule,
    removeRecurringRule,
    monthlyStats,
    recordsByDate,
    createRecord,
    editRecord,
    removeRecord,
    createAsset,
    editAsset,
    removeAsset,
    createCategory,
    editCategory,
    removeCategory,
    reorderCategories,
    createPaymentMethod,
    editPaymentMethod,
    removePaymentMethod,
    getStatsByCategory,
    getStatsByPaymentMethod,
    getMonthlyBarData,
    getDrilldownBarData,
    handleExport,
    handleImport,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp() 는 <AppProvider> 내부에서만 호출할 수 있습니다.');
  return ctx;
}
