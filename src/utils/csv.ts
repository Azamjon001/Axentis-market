// 📄 Общий помощник экспорта таблиц в CSV (открывается в Excel).
// BOM (﻿) нужен, чтобы кириллица не превращалась в кракозябры,
// разделитель `;` — потому что Excel в русской локали ждёт именно его.
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv =
    '﻿' +
    rows
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = filename.includes('.') ? filename : `${filename}_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
