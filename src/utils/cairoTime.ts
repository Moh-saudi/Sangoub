export function cairoDateInput(value: string | number | Date): string {
 const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
 const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
 const part = (name: string) => parts.find(item => item.type === name)?.value;
 return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function cairoInputToIso(value: string): string {
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('راجع موعد الحملة.');
 const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
 const desired = Date.UTC(year, month - 1, day, hour, minute); let instant = desired;
 for (let attempt = 0; attempt < 3; attempt++) {
  const represented = cairoDateInput(instant); const [y, m, d, h, min] = represented.split(/[-T:]/).map(Number);
  const delta = desired - Date.UTC(y, m - 1, d, h, min); instant += delta;
  if (!delta) break;
 }
 if (cairoDateInput(instant) !== value) throw new Error('هذا الموعد غير صالح بتوقيت القاهرة. راجع اليوم والساعة.');
 return new Date(instant).toISOString();
}
