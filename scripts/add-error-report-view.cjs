const fs = require('fs');

const path = 'd:/Sangoub/src/components/BulkProductImportModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the inner modal body with conditional view for importResult
const oldModalBody = `        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">`;

const newModalBody = `        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* ════════════════════════════════════════════════════════════
              VIEW B: POST-IMPORT ACTIONABLE ERROR REPORT
              ════════════════════════════════════════════════════════════ */}
          {importResult?.completed ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-700 font-bold block">نجاح الاستيراد</span>
                    <h3 className="text-lg font-black text-emerald-900 font-mono">
                      {importResult.successCount} صنف معتمد
                    </h3>
                    <span className="text-[10px] text-emerald-600">تم حفظها وتفعيلها في متجرك</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-700 font-bold block">تحتاج تصحيح بالإكسيل</span>
                    <h3 className="text-lg font-black text-amber-900 font-mono">
                      {importResult.failedCount} صنف به أخطاء
                    </h3>
                    <span className="text-[10px] text-amber-700">لم تُحفظ — طالع التفاصيل وطريقة الحل أدناه</span>
                  </div>
                </div>
              </div>

              {/* Explanatory Notice */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed flex items-start gap-2.5">
                <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-slate-900 font-bold mb-0.5">كيف تصحح هذه الأخطاء في ملفك؟</strong>
                  تم تسجيل الأصناف الصحيحة في متجرك بالفعل. يمكنك مراجعة سبب المشكلة أمام كل صنف أدناه وتعديله في ملف الإكسيل، أو تنزيل ملف الأخطاء الجاهز بالأسفل وإعادة رفعه بعد التعديل.
                </div>
              </div>

              {/* Actionable Error Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-black text-slate-900 text-xs">قائمة الأصناف التي تحتوي أخطاء وطريقة تصحيحها:</span>
                  <span className="text-[11px] text-slate-500 font-mono font-bold">{importResult.errors.length} خطأ</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] sticky top-0">
                      <tr>
                        <th className="p-3 w-20 text-center">رقم الصف</th>
                        <th className="p-3 w-40">اسم الصنف</th>
                        <th className="p-3">سبب المشكلة</th>
                        <th className="p-3">طريقة تصحيح الخطأ في الإكسيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                      {importResult.errors.map((err, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-amber-800 bg-amber-50/50">
                            الصف #{err.rowIndex + 1}
                          </td>
                          <td className="p-3 font-bold text-slate-900">{err.productName}</td>
                          <td className="p-3 text-rose-700 font-bold">{err.errorReason}</td>
                          <td className="p-3 text-slate-600 bg-slate-50/50 leading-relaxed">
                            💡 {err.suggestedFix}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <>`;

content = content.replace(oldModalBody, newModalBody);

// Close the conditional fragment before the footer
const oldModalFooter = `        {/* Footer */}
        <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleStartImport}
            disabled={importing || validCount === 0}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            {importing ? 'جارٍ الاستيراد…' : \`بدء استيراد \${validCount} صنف\`}
          </button>
        </footer>`;

const newModalFooter = `            </>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {importResult?.completed ? (
            <>
              <button
                type="button"
                onClick={handleExportErrorRows}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <FileDown size={15} />
                <span>تحميل ملف الأصناف الخاطئة (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSuccess(importResult.successCount);
                  onClose();
                }}
                className="px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                إنهاء ومتابعة الأصناف المعتمدة ({importResult.successCount})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleStartImport}
                disabled={importing || validCount === 0}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                {importing ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                {importing ? 'جارٍ الاستيراد…' : \`بدء استيراد \${validCount} صنف\`}
              </button>
            </>
          )}
        </footer>`;

const normalize = s => s.replace(/\r\n/g, '\n');
if (normalize(content).includes(normalize(oldModalFooter))) {
  content = normalize(content).replace(normalize(oldModalFooter), normalize(newModalFooter));
  console.log('Successfully added conditional report footer');
} else {
  console.error('Failed to match oldModalFooter');
}

// Also add the filter toggle for error rows in the preview step
const oldPreviewHeader = `              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    تمت قراءة <strong className="text-slate-950 font-black">{parsedRows.length}</strong> صف في الملف:
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    {validCount} صالح للاستيراد ✓
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800">
                      {invalidCount} به أخطاء ✗
                    </span>
                  )}
                </div>
              </div>`;

const newPreviewHeader = `              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    تمت قراءة <strong className="text-slate-950 font-black">{parsedRows.length}</strong> صف في الملف:
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    {validCount} صالح للاستيراد ✓
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800">
                      {invalidCount} به أخطاء ✗
                    </span>
                  )}
                </div>

                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterOnlyErrors(!filterOnlyErrors)}
                    className={\`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer \${
                      filterOnlyErrors
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }\`}
                  >
                    {filterOnlyErrors ? 'عرض جميع الصفوف' : \`عرض الصفوف التي بها أخطاء فقط (\${invalidCount})\`}
                  </button>
                )}
              </div>`;

if (normalize(content).includes(normalize(oldPreviewHeader))) {
  content = normalize(content).replace(normalize(oldPreviewHeader), normalize(newPreviewHeader));
  console.log('Added filterOnlyErrors toggle button');
}

// Update tbody mapping to respect filterOnlyErrors
const oldTbodyMap = `{parsedRows.map(row => (`;
const newTbodyMap = `{(filterOnlyErrors ? parsedRows.filter(r => !r.isValid) : parsedRows).map(row => (`;

if (normalize(content).includes(normalize(oldTbodyMap))) {
  content = normalize(content).replace(normalize(oldTbodyMap), normalize(newTbodyMap));
  console.log('Updated table mapping to filter errors');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully finished updating BulkProductImportModal.tsx');

