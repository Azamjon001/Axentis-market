import * as XLSX from 'xlsx';

/**
 * ⚡ ОПТИМИЗИРОВАННЫЙ ПАРСЕР EXCEL
 * Решает проблему "DataCloneError: out of memory" при импорте больших файлов
 */

export interface ParsedProduct {
  name: string;
  quantity: number;
  price: number;
  barcode?: string;
}

export interface ParseOptions {
  maxRows?: number;
  maxFileSize?: number; // в байтах
  skipHeader?: boolean;
}

/**
 * Парсит Excel файл с оптимизацией памяти
 */
export async function parseExcelForProducts(
  file: File,
  options: ParseOptions = {}
): Promise<ParsedProduct[]> {
  const {
    maxRows = 10000,
    maxFileSize = 5 * 1024 * 1024, // 5MB
    skipHeader = true
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);

        // Проверка размера файла
        if (data.byteLength > maxFileSize) {
          reject(new Error(`Файл слишком большой (${(data.byteLength / 1024 / 1024).toFixed(1)}MB). Максимум: ${(maxFileSize / 1024 / 1024).toFixed(0)}MB`));
          return;
        }

        // ⚡ Оптимизированное чтение с минимальными настройками
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: false,
          cellNF: false,
          cellStyles: false,
          sheetStubs: false
        });

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: '',
          blankrows: false,
          raw: false // Преобразуем всё в строки
        }) as any[][];

        // ⚡ Очищаем workbook из памяти сразу после использования
        (workbook as any).Sheets = null;
        (workbook as any).SheetNames = null;

        // Проверка количества строк
        if (jsonData.length > maxRows) {
          reject(new Error(`Слишком много строк (${jsonData.length}). Максимум: ${maxRows}`));
          return;
        }

        // Парсим данные
        const products: ParsedProduct[] = [];
        const startRow = skipHeader && jsonData[0] && typeof jsonData[0][0] === 'string' && isNaN(parseFloat(jsonData[0][1] as string)) ? 1 : 0;

        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 3) continue;

          const name = String(row[0] || '').trim();
          const quantity = parseInt(String(row[1] || '0'));
          const price = parseFloat(String(row[2] || '0'));
          const barcode = row[3] ? String(row[3]).trim() : undefined;

          if (name && !isNaN(quantity) && !isNaN(price) && quantity >= 0 && price >= 0) {
            const product: ParsedProduct = { name, quantity, price };
            if (barcode) product.barcode = barcode;
            products.push(product);
          }
        }

        // ⚡ Очищаем jsonData из памяти
        (jsonData as any).length = 0;

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Парсит Excel файл для импорта штрих-кодов
 */
export async function parseExcelForBarcodes(
  file: File,
  options: ParseOptions = {}
): Promise<string[]> {
  const {
    maxRows = 10000,
    maxFileSize = 5 * 1024 * 1024 // 5MB
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);

        // Проверка размера файла
        if (data.byteLength > maxFileSize) {
          reject(new Error(`Файл слишком большой (${(data.byteLength / 1024 / 1024).toFixed(1)}MB). Максимум: ${(maxFileSize / 1024 / 1024).toFixed(0)}MB`));
          return;
        }

        // ⚡ Оптимизированное чтение
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: false,
          cellNF: false,
          cellStyles: false,
          sheetStubs: false
        });

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: '',
          blankrows: false,
          raw: false
        }) as any[][];

        // ⚡ Очищаем workbook
        (workbook as any).Sheets = null;
        (workbook as any).SheetNames = null;

        // Проверка количества строк
        if (jsonData.length > maxRows) {
          reject(new Error(`Слишком много строк (${jsonData.length}). Максимум: ${maxRows}`));
          return;
        }

        // Извлекаем штрих-коды
        const barcodes: string[] = [];
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const barcode = String(row[0] || '').trim();
          if (barcode) {
            barcodes.push(barcode);
          }
        }

        // ⚡ Очищаем jsonData
        (jsonData as any).length = 0;

        resolve(barcodes);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };

    reader.readAsArrayBuffer(file);
  });
}
