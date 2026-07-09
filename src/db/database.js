const DB_NAME = 'household-budget-db';
const DB_VERSION = 2;

const DEFAULT_CATEGORIES = [
  { name: '식비', type: 'expense', icon: '🍚', parentId: null, isDefault: true },
  { name: '카페/간식', type: 'expense', icon: '☕', parentId: null, isDefault: true },
  { name: '교통', type: 'expense', icon: '🚌', parentId: null, isDefault: true },
  { name: '쇼핑', type: 'expense', icon: '🛍️', parentId: null, isDefault: true },
  { name: '주거/통신', type: 'expense', icon: '🏠', parentId: null, isDefault: true },
  { name: '의료/건강', type: 'expense', icon: '💊', parentId: null, isDefault: true },
  { name: '문화/여가', type: 'expense', icon: '🎬', parentId: null, isDefault: true },
  { name: '교육', type: 'expense', icon: '📚', parentId: null, isDefault: true },
  { name: '기타지출', type: 'expense', icon: '💸', parentId: null, isDefault: true },
  { name: '급여', type: 'income', icon: '💰', parentId: null, isDefault: true },
  { name: '부수입', type: 'income', icon: '💵', parentId: null, isDefault: true },
  { name: '용돈', type: 'income', icon: '🎁', parentId: null, isDefault: true },
  { name: '기타수입', type: 'income', icon: '📈', parentId: null, isDefault: true },
];

const DEFAULT_PAYMENT_METHODS = [
  { name: '현금', icon: '💵', isDefault: true },
  { name: '신용카드', icon: '💳', isDefault: true },
  { name: '체크카드', icon: '🏧', isDefault: true },
  { name: '계좌이체', icon: '🏦', isDefault: true },
  { name: '카카오페이', icon: '💬', isDefault: true },
  { name: '네이버페이', icon: '🟢', isDefault: true },
];

/** @type {IDBDatabase | null} */
let _db = null;
let _seeded = false;

function _createStores(db) {
  if (!db.objectStoreNames.contains('records')) {
    const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
    store.createIndex('date', 'date');
    store.createIndex('type', 'type');
    store.createIndex('categoryId', 'categoryId');
    store.createIndex('paymentMethodId', 'paymentMethodId');
    store.createIndex('assetId', 'assetId');
    // 'YYYY-MM' string for fast month-range queries via getAllByIndex
    store.createIndex('yearMonth', 'yearMonth');
  }

  if (!db.objectStoreNames.contains('assets')) {
    const store = db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
    store.createIndex('name', 'name');
  }

  if (!db.objectStoreNames.contains('categories')) {
    const store = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
    store.createIndex('type', 'type');
    store.createIndex('parentId', 'parentId');
  }

  if (!db.objectStoreNames.contains('paymentMethods')) {
    db.createObjectStore('paymentMethods', { keyPath: 'id', autoIncrement: true });
  }

  if (!db.objectStoreNames.contains('recurringRules')) {
    const store = db.createObjectStore('recurringRules', { keyPath: 'id', autoIncrement: true });
    store.createIndex('startDate', 'startDate');
  }
}

function _openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => _createStores(e.target.result);
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function _seedDefaults() {
  if (_seeded) return;
  _seeded = true;

  const now = Date.now();
  const [cats, methods] = await Promise.all([getAll('categories'), getAll('paymentMethods')]);

  if (cats.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await dbAdd('categories', { ...cat, createdAt: now });
    }
  }
  if (methods.length === 0) {
    for (const method of DEFAULT_PAYMENT_METHODS) {
      await dbAdd('paymentMethods', { ...method, createdAt: now });
    }
  }
}

/** DB를 초기화하고 기본 데이터를 시드합니다. 앱 시작 시 한 번 호출하세요. */
export async function initDB() {
  await _openDB();
  await _seedDefaults();
}

// ---------------------------------------------------------------------------
// Generic CRUD primitives
// ---------------------------------------------------------------------------

export function dbAdd(storeName, data) {
  return _openDB().then((db) =>
    new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).add(data);
      req.onsuccess = () => resolve(req.result); // returns generated id
      req.onerror = () => reject(req.error);
    })
  );
}

export function dbGet(storeName, id) {
  return _openDB().then((db) =>
    new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    })
  );
}

export function dbPut(storeName, data) {
  return _openDB().then((db) =>
    new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })
  );
}

export function dbDelete(storeName, id) {
  return _openDB().then((db) =>
    new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    })
  );
}

export function getAll(storeName) {
  return _openDB().then((db) =>
    new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })
  );
}

export function getAllByIndex(storeName, indexName, value) {
  return _openDB().then((db) =>
    new Promise((resolve, reject) => {
      const req = db
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .index(indexName)
        .getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })
  );
}

// ---------------------------------------------------------------------------
// Read helpers (no business logic)
// ---------------------------------------------------------------------------

/** 전체 거래 내역 반환 */
export const getAllRecords = () => getAll('records');

/**
 * 특정 연월의 거래 내역 반환
 * @param {number} year
 * @param {number} month 1-based
 */
export function getRecordsByYearMonth(year, month) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return getAllByIndex('records', 'yearMonth', key);
}

/** 특정 날짜(YYYY-MM-DD)의 거래 내역 반환 */
export const getRecordsByDate = (dateStr) => getAllByIndex('records', 'date', dateStr);

export const getAllAssets = () => getAll('assets');
export const getAsset = (id) => dbGet('assets', id);

export const getAllCategories = () => getAll('categories');
export const getCategoriesByType = (type) => getAllByIndex('categories', 'type', type);

export const getAllPaymentMethods = () => getAll('paymentMethods');
