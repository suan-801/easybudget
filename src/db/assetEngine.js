/**
 * 자산 역산 알고리즘 (Asset Balance Engine)
 *
 * 거래 내역(Record) 의 생성/수정/삭제 시 연동된 자산(Asset) 의 잔액을
 * 자동으로 가감합니다. 수정 시에는 기존 효과를 먼저 원복한 뒤 새 효과를
 * 적용하여 이중 계산을 방지합니다.
 *
 * 공식:
 *   지출: currentBalance -= amount
 *   수입: currentBalance += amount
 */
import { dbAdd, dbGet, dbPut, dbDelete, getAll } from './database.js';

// --- Internal helpers -------------------------------------------------------

function _applyToBalance(balance, type, amount) {
  return type === 'income' ? balance + amount : balance - amount;
}

function _reverseFromBalance(balance, type, amount) {
  return type === 'income' ? balance - amount : balance + amount;
}

async function _updateAssetBalance(assetId, type, amount, direction) {
  if (!assetId) return;
  const asset = await dbGet('assets', assetId);
  if (!asset) return;

  const newBalance =
    direction === 'apply'
      ? _applyToBalance(asset.currentBalance, type, amount)
      : _reverseFromBalance(asset.currentBalance, type, amount);

  await dbPut('assets', { ...asset, currentBalance: newBalance, updatedAt: Date.now() });
}

// --- Record CRUD (with asset side-effects) ----------------------------------

/**
 * 거래 내역을 추가하고 연동 자산 잔액을 갱신합니다.
 * @param {{ type, amount, date, memo, categoryId, paymentMethodId, assetId, repeat }} data
 * @returns {Promise<number>} 생성된 record id
 */
export async function addRecord(data) {
  const now = Date.now();
  const record = {
    ...data,
    yearMonth: data.date.substring(0, 7),
    createdAt: now,
    updatedAt: now,
  };

  const id = await dbAdd('records', record);
  await _updateAssetBalance(data.assetId, data.type, data.amount, 'apply');
  return id;
}

/**
 * 거래 내역을 수정합니다.
 * 기존 자산 효과를 원복한 뒤 새 효과를 적용합니다.
 * @param {number} id
 * @param {Partial<typeof data>} changes
 */
export async function updateRecord(id, changes) {
  const old = await dbGet('records', id);
  if (!old) throw new Error(`거래 내역(id=${id})을 찾을 수 없습니다.`);

  // 1. 기존 자산 효과 원복
  await _updateAssetBalance(old.assetId, old.type, old.amount, 'reverse');

  // 2. 내역 업데이트
  const updated = {
    ...old,
    ...changes,
    id,
    yearMonth: (changes.date ?? old.date).substring(0, 7),
    updatedAt: Date.now(),
  };
  await dbPut('records', updated);

  // 3. 새 자산 효과 적용
  await _updateAssetBalance(updated.assetId, updated.type, updated.amount, 'apply');

  return updated;
}

/**
 * 거래 내역을 삭제하고 자산 잔액을 원복합니다.
 * @param {number} id
 */
export async function deleteRecord(id) {
  const record = await dbGet('records', id);
  if (!record) throw new Error(`거래 내역(id=${id})을 찾을 수 없습니다.`);

  await _updateAssetBalance(record.assetId, record.type, record.amount, 'reverse');
  await dbDelete('records', id);
}

// --- Asset CRUD -------------------------------------------------------------

/**
 * 자산을 추가합니다. currentBalance 는 initialBalance 로 초기화됩니다.
 * @param {{ name, icon, initialBalance }} data
 */
export async function addAsset(data) {
  const now = Date.now();
  return dbAdd('assets', {
    ...data,
    currentBalance: data.initialBalance ?? 0,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * 자산 메타데이터(이름, 아이콘 등)를 수정합니다.
 * initialBalance 변경 시 currentBalance 에 차액이 반영됩니다.
 * @param {number} id
 * @param {object} changes
 */
export async function updateAsset(id, changes) {
  const old = await dbGet('assets', id);
  if (!old) throw new Error(`자산(id=${id})을 찾을 수 없습니다.`);

  let { currentBalance } = old;

  // initialBalance 수정 시 차액만큼 currentBalance 조정
  if (changes.initialBalance !== undefined && changes.initialBalance !== old.initialBalance) {
    const diff = changes.initialBalance - old.initialBalance;
    currentBalance = old.currentBalance + diff;
  }

  return dbPut('assets', { ...old, ...changes, id, currentBalance, updatedAt: Date.now() });
}

/**
 * 자산을 삭제합니다. 연결된 거래 내역이 있을 시 연동 정보를 해제(null)한 뒤 삭제합니다.
 * @param {number} id
 */
export async function deleteAsset(id) {
  const records = await getAll('records');
  const linked = records.filter((r) => r.assetId === id || String(r.assetId) === String(id));
  
  // 연동된 모든 가계부 내역의 자산 연동 해제
  for (const r of linked) {
    await dbPut('records', { ...r, assetId: null, updatedAt: Date.now() });
  }
  
  return dbDelete('assets', id);
}

// --- Category CRUD ----------------------------------------------------------

export async function addCategory(data) {
  return dbAdd('categories', { ...data, isDefault: false, createdAt: Date.now() });
}

export async function updateCategory(id, changes) {
  const old = await dbGet('categories', id);
  if (!old) throw new Error(`카테고리(id=${id})를 찾을 수 없습니다.`);
  return dbPut('categories', { ...old, ...changes, id });
}

/**
 * 카테고리를 삭제합니다. 연결된 거래 내역이 있으면 삭제를 거부합니다.
 * @param {number} id
 */
export async function deleteCategory(id) {
  const records = await getAll('records');
  if (records.some((r) => r.categoryId === id)) {
    throw new Error('이 카테고리에 연결된 거래 내역이 있어 삭제할 수 없습니다.');
  }
  return dbDelete('categories', id);
}

// --- PaymentMethod CRUD -----------------------------------------------------

export async function addPaymentMethod(data) {
  return dbAdd('paymentMethods', { ...data, isDefault: false, createdAt: Date.now() });
}

export async function updatePaymentMethod(id, changes) {
  const old = await dbGet('paymentMethods', id);
  if (!old) throw new Error(`결제 수단(id=${id})을 찾을 수 없습니다.`);
  return dbPut('paymentMethods', { ...old, ...changes, id });
}

/**
 * 결제 수단을 삭제합니다. 연결된 거래 내역이 있으면 삭제를 거부합니다.
 * @param {number} id
 */
export async function deletePaymentMethod(id) {
  const records = await getAll('records');
  if (records.some((r) => r.paymentMethodId === id)) {
    throw new Error('이 결제 수단에 연결된 거래 내역이 있어 삭제할 수 없습니다.');
  }
  return dbDelete('paymentMethods', id);
}

// --- RecurringRule CRUD (신규 반복 규칙 관리 스키마) ---------------------------

export async function addRecurringRule(data) {
  const now = Date.now();
  const rule = {
    ...data,
    createdAt: now,
    updatedAt: now,
    lastGeneratedDate: null,
    generatedCount: 0
  };
  return dbAdd('recurringRules', rule);
}

export async function updateRecurringRule(id, changes) {
  const old = await dbGet('recurringRules', id);
  if (!old) throw new Error(`반복 규칙(id=${id})을 찾을 수 없습니다.`);
  return dbPut('recurringRules', { ...old, ...changes, id, updatedAt: Date.now() });
}

export async function deleteRecurringRule(id) {
  return dbDelete('recurringRules', id);
}

