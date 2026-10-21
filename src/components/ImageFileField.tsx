import { useEffect, useRef, useState } from "react";
import { validateCatalogImage } from "../lib/catalogImages";

export function ImageFileField({ name, label, disabled }: { name: string; label: string; disabled: boolean }) {
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
  return <label className="block text-sm space-y-2">
    <span>{label}</span>
    <input ref={input} type="file" name={name} disabled={disabled}
      accept="image/jpeg,image/png,image/webp" className="block w-full text-xs"
      onChange={(event) => {
        const selected = event.target.files?.[0];
        setError(""); setFile(null);
        if (!selected) return;
        try { validateCatalogImage(selected); setFile(selected); }
        catch (e) { setError((e as Error).message); event.target.value = ""; }
      }} />
    <span className="block text-xs text-slate-500">JPG، PNG أو WebP — حتى 5 ميجابايت</span>
    {error && <span role="alert" className="block text-red-600">{error}</span>}
    {preview && <img src={preview} alt={`معاينة ${label}`} className="h-28 w-40 object-contain rounded-xl border" />}
  </label>;
}
