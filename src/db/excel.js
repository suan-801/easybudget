/**
 * 엑셀 내보내기 / 불러오기
 *
 * 내보내기: 전체 records 를 xlsx 파일로 저장합니다.
 * 불러오기: 파일 유효성 검사 → 행 파싱 → category/paymentMethod 이름 매핑.
 *
 * [불러오기 필수 열] 날짜 | 구분 | 금액 | 카테고리 | 결제수단 | 메모
 * 열 이름·순서가 정확히 일치해야 합니다 (내보내기 파일 재사용 권장).
 */
import * as XLSX from 'xlsx';

const REQUIRED_COLUMNS = ['날짜', '구분', '금액', '카테고리', '결제수단', '메모'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * 거래 내역을 xlsx 파일로 내보냅니다.
 * @param {object[]} records
 * @param {object[]} categories
 * @param {object[]} paymentMethods
 * @returns {string} 저장된 파일명
 */
export function exportToExcel(records, categories, paymentMethods) {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const methodMap = new Map(paymentMethods.map((m) => [m.id, m]));

  const rows = records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({
      날짜: r.date,
      구분: r.type === 'income' ? '수입' : '지출',
      금액: r.amount,
      카테고리: catMap.get(r.categoryId)?.name ?? '',
      결제수단: methodMap.get(r.paymentMethodId)?.name ?? '',
      메모: r.memo ?? '',
      반복: r.repeat ?? 'none',
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, // 날짜
    { wch: 6 },  // 구분
    { wch: 14 }, // 금액
    { wch: 14 }, // 카테고리
    { wch: 12 }, // 결제수단
    { wch: 30 }, // 메모
    { wch: 10 }, // 반복
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '가계부');

  const fileName = `손쉬운가계부_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

// ---------------------------------------------------------------------------
// Import — Step 1: Parse & Validate
// ---------------------------------------------------------------------------

/**
 * xlsx/csv 파일을 파싱하고 유효성을 검사합니다.
 *
 * @param {File} file
 * @returns {Promise<{ valid: true, rows: object[] } | { valid: false, error: string }>}
 *
 * rows 각 항목:
 *   { date, type, amount, categoryName, paymentMethodName, memo, repeat, yearMonth }
 */
export function parseExcelFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (raw.length === 0) {
          resolve({ valid: false, error: '파일에 데이터가 없습니다.' });
          return;
        }

        // 필수 열 확인
        const headers = Object.keys(raw[0]);
        const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          resolve({
            valid: false,
            error: `필수 열이 없습니다: ${missing.join(', ')}\n내보내기로 생성된 파일 형식을 사용해 주세요.`,
          });
          return;
        }

        const rows = [];
        const errors = [];

        for (let i = 0; i < raw.length; i++) {
          const row = raw[i];
          const lineNum = i + 2; // 헤더 행 제외

          // 날짜 검증
          const dateStr = String(row['날짜']).trim();
          if (!DATE_RE.test(dateStr)) {
            errors.push(`${lineNum}행: 날짜 형식 오류 (YYYY-MM-DD 필요) — "${dateStr}"`);
            continue;
          }

          // 구분 검증
          const typeRaw = String(row['구분']).trim();
          const type = typeRaw === '수입' ? 'income' : typeRaw === '지출' ? 'expense' : null;
          if (!type) {
            errors.push(`${lineNum}행: 구분은 '수입' 또는 '지출' — "${typeRaw}"`);
            continue;
          }

          // 금액 검증
          const amount = Number(String(row['금액']).replace(/,/g, ''));
          if (!Number.isFinite(amount) || amount <= 0) {
            errors.push(`${lineNum}행: 금액이 올바르지 않습니다 — "${row['금액']}"`);
            continue;
          }

          rows.push({
            date: dateStr,
            type,
            amount,
            categoryName: String(row['카테고리']).trim(),
            paymentMethodName: String(row['결제수단']).trim(),
            memo: String(row['메모']).trim(),
            repeat: String(row['반복'] ?? 'none').trim(),
            yearMonth: dateStr.substring(0, 7),
          });
        }

        if (errors.length > 0) {
          resolve({ valid: false, error: errors.join('\n') });
          return;
        }

        resolve({ valid: true, rows });
      } catch (err) {
        resolve({ valid: false, error: `파일을 읽을 수 없습니다: ${err.message}` });
      }
    };

    reader.onerror = () => resolve({ valid: false, error: '파일 읽기 중 오류가 발생했습니다.' });
    reader.readAsArrayBuffer(file);
  });
}

// ---------------------------------------------------------------------------
// Import — Step 2: Map names → IDs
// ---------------------------------------------------------------------------

/**
 * parseExcelFile 결과의 rows 를 DB 저장 가능한 record 객체로 변환합니다.
 * 카테고리/결제 수단 이름이 DB에 없으면 null 로 처리됩니다.
 *
 * @param {object[]} rows        parseExcelFile 의 rows
 * @param {object[]} categories  DB 의 전체 카테고리 목록
 * @param {object[]} paymentMethods  DB 의 전체 결제 수단 목록
 * @returns {object[]} addRecord 에 넘길 수 있는 record 배열
 */
export function mapImportedRows(rows, categories, paymentMethods) {
  return rows.map((row) => {
    const cat = categories.find((c) => c.name === row.categoryName);
    const method = paymentMethods.find((m) => m.name === row.paymentMethodName);

    return {
      date: row.date,
      type: row.type,
      amount: row.amount,
      categoryId: cat?.id ?? null,
      paymentMethodId: method?.id ?? null,
      memo: row.memo,
      repeat: row.repeat || 'none',
      yearMonth: row.yearMonth,
      assetId: null, // 불러오기 시 자산 자동 연동 없음 (수동으로 설정)
    };
  });
}
