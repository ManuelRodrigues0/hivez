import { useRef, useState } from "react";
import {
  Camera,
  Check,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { profileAvatarOptions } from "@/data/profileAvatars";

type ProfileImagePickerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  onFileSelected?: (file: File) => Promise<void> | void;
  onFileError?: (message: string) => void;
  onRemove?: () => void;
  uploading?: boolean;
};

const fallbackProfileSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#f7f5f1"/>
        <stop offset="100%" stop-color="#dfe7f1"/>
      </linearGradient>
    </defs>
    <rect width="220" height="220" rx="110" fill="url(#bg)"/>
    <circle cx="110" cy="85" r="40" fill="#d7dce2"/>
    <path d="M48 182c14-28 36-42 62-42s48 14 62 42" fill="#d7dce2"/>
    <circle cx="95" cy="80" r="4" fill="#3d4657"/>
    <circle cx="126" cy="80" r="4" fill="#3d4657"/>
    <path d="M92 104c7 8 29 8 36 0" stroke="#3d4657" stroke-width="5" stroke-linecap="round" fill="none"/>
  </svg>
`)}`;

export function ProfileImagePicker({
  value,
  onChange,
  onFileSelected,
  onFileError,
  onRemove,
  uploading = false,
}: ProfileImagePickerProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const selectedAvatar = profileAvatarOptions.find(
    (option) => option.src === value
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onFileError?.("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onFileError?.("Image must be smaller than 5MB.");
      return;
    }

    if (onFileSelected) {
      await onFileSelected(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      onChange(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="hivez-profile-photo-panel">
      <div className="hivez-profile-preview-shell">
        <img
          src={value || fallbackProfileSvg}
          alt="Profile preview"
          className="hivez-profile-preview-image"
        />
        <div className="hivez-profile-preview-badge">Profile photo</div>
      </div>

      <div className="hivez-profile-picker-actions">
        <button
          type="button"
          className="hivez-profile-picker-button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} />
          Upload
        </button>

        <button
          type="button"
          className="hivez-profile-picker-button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
        >
          <Camera size={16} />
          Camera
        </button>

        <button
          type="button"
          className="hivez-profile-picker-button"
          onClick={() => setAvatarOpen((open) => !open)}
        >
          <Sparkles size={16} />
          Avatar
        </button>
      </div>

      {(value || selectedAvatar) && onRemove && (
        <button type="button" className="hivez-profile-remove-button" onClick={onRemove}>
          <Trash2 size={14} />
          Remove image
        </button>
      )}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {avatarOpen && (
        <div className="hivez-profile-avatar-panel">
          <div className="hivez-profile-avatar-grid">
            {profileAvatarOptions.map((avatar) => {
              const selected = value === avatar.src;

              return (
                <button
                  key={avatar.id}
                  type="button"
                  className={`hivez-profile-avatar-option ${selected ? "is-selected" : ""}`}
                  onClick={() => {
                    onChange(avatar.src);
                    setAvatarOpen(false);
                  }}
                  aria-label={`Choose ${avatar.name}`}
                  title={avatar.name}
                >
                  <img src={avatar.src} alt={avatar.name} />
                  {selected && (
                    <span className="hivez-profile-avatar-check">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
