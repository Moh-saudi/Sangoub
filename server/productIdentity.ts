/** Prefer the real catalog ID; legacy mobile cart IDs may append selections after _. */
export function productCandidateIds(value: unknown): string[] {
 if (typeof value !== 'string' || !/^[\w-]{1,128}$/.test(value)) return [];
 const separator=value.lastIndexOf('_');
 return [...new Set([value, ...(separator>0 ? [value.slice(0,separator),value.split('_')[0]] : [])])].filter(Boolean);
}
