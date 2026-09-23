/**
 * export-helper.js — 通用数据导出
 * 使用方式:
 *   ExportHelper.exportData({ filename, headers, rows, format })  // format: 'csv' | 'excel'
 *
 * CSV 使用原生 Blob 下载；Excel 按需懒加载 SheetJS 生成真实 .xlsx，
 * 若 CDN 加载失败则自动回退为 CSV，避免导出静默失败。
 */
const ExportHelper = (function () {
  'use strict';

  const SHEETJS_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

  function escapeCell(value) {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(headers, rows) {
    const lines = [headers.map(escapeCell).join(',')];
    rows.forEach(function (row) {
      lines.push(row.map(escapeCell).join(','));
    });
    return lines.join('\r\n');
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob(['\ufeff' + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function loadSheetJS() {
    return new Promise(function (resolve, reject) {
      if (window.XLSX) { resolve(window.XLSX); return; }
      const script = document.createElement('script');
      script.src = SHEETJS_URL;
      script.onload = function () { resolve(window.XLSX); };
      script.onerror = function () { reject(new Error('SheetJS 加载失败')); };
      document.head.appendChild(script);
    });
  }

  /**
   * 导出数据
   * @returns {Promise<'csv'|'excel'|'csv-fallback'>} 实际导出的格式
   */
  async function exportData(options) {
    const headers = options.headers || [];
    const rows = options.rows || [];
    const filename = options.filename || 'export';

    if (options.format !== 'excel') {
      downloadBlob(toCsv(headers, rows), filename + '.csv', 'text/csv;charset=utf-8');
      return 'csv';
    }

    try {
      const XLSX = await loadSheetJS();
      const sheet = XLSX.utils.aoa_to_sheet([headers].concat(rows));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
      XLSX.writeFile(book, filename + '.xlsx');
      return 'excel';
    } catch (e) {
      downloadBlob(toCsv(headers, rows), filename + '.csv', 'text/csv;charset=utf-8');
      return 'csv-fallback';
    }
  }

  /** 生成文件名后缀用的日期，如 20260923 */
  function stamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  return { exportData: exportData, stamp: stamp };
})();

window.ExportHelper = ExportHelper;
