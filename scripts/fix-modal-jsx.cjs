const fs = require('fs');

const path = 'd:/Sangoub/src/components/BulkProductImportModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace from `{/* Content */}` to the end of the component cleanly
const reportViewCode = `{/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
            <div className="space-y-6">`;

const normalize = s => s.replace(/\r\n/g, '\n');

// Clean up any extra tags at the end of the body
const oldContentStart = `{/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">`;

content = normalize(content).replace(normalize(oldContentStart), normalize(reportViewCode));

// Make sure closing tags before footer match
const oldFooterArea = `              )}
            </div>
          )}
        </>
      )}
    </div>

        {/* Footer */}`;

const newFooterArea = `              )}
            </div>
          )}
            </div>
          )}
        </div>

        {/* Footer */}`;

content = normalize(content).replace(normalize(oldFooterArea), normalize(newFooterArea));

fs.writeFileSync(path, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully structured JSX body');

