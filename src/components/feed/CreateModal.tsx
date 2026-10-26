import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CreateChoices } from "@/components/create/ComposerParts";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function handlePhotoReport() {
    onClose();
    navigate("/create", { state: { reportMode: true } });
  }

  function handleText() {
    onClose();
    navigate("/create", { state: { textMode: true, text: "" } });
  }

  return (
    <dialog
      ref={ref}
      className="dispatch-create-dialog"
      aria-labelledby="hv-create-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dispatch-dialog-intro">
        <div><p className="dispatch-eyebrow">YOUR CORNER. YOUR VOICE.</p><h2 id="hv-create-title">Start a little<br /><em>something local.</em></h2></div>
        <button type="button" className="dispatch-icon" aria-label="Close create post" onClick={onClose}><X size={19} /></button>
      </div>
      <CreateChoices compact onReport={handlePhotoReport} onText={handleText} />
    </dialog>
  );
}
