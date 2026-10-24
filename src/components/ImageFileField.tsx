import { useEffect, useId, useRef, useState } from "react";
import { validateCatalogImage } from "../lib/catalogImages";

export function ImageFileField({ name, label, disabled }: { name: string; label: string; disabled: boolean }) {
  const fieldId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { setFile(null); setError(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  return <div className="admin-image-field">
    <label htmlFor={fieldId}>{label}</label>
    <input id={fieldId} aria-describedby={`${fieldId}-hint`} aria-invalid={Boolean(error)} ref={input} tabIndex={-1} type="file" name={name} disabled={disabled}
      accept="image/jpeg,image/png,image/webp" className="admin-image-native"
      onChange={(event) => {
        const selected = event.target.files?.[0];
        setError(""); setFile(null);
        if (!selected) return;
        try { validateCatalogImage(selected); setFile(selected); }
        catch (e) { setError((e as Error).message); event.target.value = ""; }
      }} />
    <button type="button" className="admin-image-choose" disabled={disabled} onClick={() => input.current?.click()}>اختيار صورة</button>
    <span id={`${fieldId}-hint`} className="block text-xs text-slate-500">JPG، PNG أو WebP — حتى 5 ميجابايت</span>
    {error && <span role="alert" className="block text-red-600">{error}</span>}
    {preview && <><p className="admin-image-file-name">{file?.name}</p><div className="admin-image-preview"><img src={preview} alt={`معاينة ${label}`} /><button type="button" disabled={disabled} onClick={() => { if (input.current) input.current.value = ""; setFile(null); setError(""); }}>إزالة الصورة المختارة</button></div></>}
  </div>;
}
