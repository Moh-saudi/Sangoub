import { useEffect, useId, useRef, useState } from "react";
import { validateCatalogImage, uploadCatalogImage } from "../lib/catalogImages";
import { Upload, Image as ImageIcon, X, Loader2, CheckCircle2 } from "lucide-react";

interface ImageFileFieldProps {
  name: string;
  label: string;
  disabled: boolean;
  currentUrl?: string;
  urlFieldName?: string;
  collection?: "stores" | "products" | "banners";
  entityId?: string;
  onUploadSuccess?: (url: string) => void;
}

export function ImageFileField({
  name,
  label,
  disabled,
  currentUrl = "",
  urlFieldName,
  collection,
  entityId,
  onUploadSuccess,
}: ImageFileFieldProps) {
  const fieldId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const form = input.current?.form;
    const reset = () => {
      setFile(null);
      setUploadedUrl("");
      setUploadNotice("");
      setError("");
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  const displayImage = uploadedUrl || preview || currentUrl;

  async function handleFileSelect(selected: File) {
    setError("");
    setFile(null);
    setUploadNotice("");

    try {
      validateCatalogImage(selected);
      setFile(selected);

      // If unified direct upload is requested
      if (collection && entityId) {
        setIsUploading(true);
        const res = await uploadCatalogImage(collection, entityId, selected);
        if (res?.url) {
          setUploadedUrl(res.url);
          setUploadNotice("تم رفع واستبدال الصورة بنجاح!");
          onUploadSuccess?.(res.url);
        }
      }
    } catch (e: any) {
      setError(e?.message || "حدث خطأ أثناء معالجة الصورة.");
      if (input.current) input.current.value = "";
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-1.5 my-2">
      <label className="block font-bold text-xs text-slate-700">{label}</label>

      {/* Hidden file input for native form submission */}
      <input
        id={fieldId}
        ref={input}
        type="file"
        name={name}
        disabled={disabled || isUploading}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          handleFileSelect(selected);
        }}
      />

      {/* Hidden url field to preserve existing or newly uploaded URL safely without exposing raw text */}
      {urlFieldName && (
        <input
          type="hidden"
          name={urlFieldName}
          value={uploadedUrl || currentUrl || ""}
        />
      )}

      {/* Modern Secure Image Preview & Upload Box (Zero Exposed URLs) */}
      <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden relative">
          {displayImage ? (
            <img
              src={displayImage}
              alt={`معاينة ${label}`}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/brand/sangoub-mark-white-128.png";
              }}
            />
          ) : (
            <ImageIcon size={26} className="text-slate-300" />
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
              <Loader2 size={16} className="animate-spin text-orange-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate mb-0.5">
            {isUploading
              ? "جاري الرفع والمعالجة..."
              : uploadNotice
              ? uploadNotice
              : file
              ? `صورة مختارة: ${file.name}`
              : currentUrl
              ? `تم تعيين ${label}`
              : `لم يتم اختيار ${label} بعد`}
          </p>
          <p className="text-[10.5px] text-slate-500 mb-2">
            رفع آمن ومباشر من جهازك (JPG، PNG، WebP حتى 5 ميجابايت)
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => input.current?.click()}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>جاري الرفع...</span>
                </>
              ) : (
                <>
                  <Upload size={13} />
                  <span>
                    {displayImage ? "استبدال الصورة من جهازك" : "رفع صورة من جهازك"}
                  </span>
                </>
              )}
            </button>

            {(file || uploadedUrl) && (
              <button
                type="button"
                disabled={disabled || isUploading}
                onClick={() => {
                  if (input.current) input.current.value = "";
                  setFile(null);
                  setUploadedUrl("");
                  setUploadNotice("");
                  setError("");
                }}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <X size={12} />
                <span>إلغاء</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {uploadNotice && (
        <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          <span>{uploadNotice}</span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
