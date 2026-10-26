import { useRef, useState } from "react";
import { ArrowRight, Eye, ImagePlus, Loader2, LocateFixed, MapPin, PenLine, Plus, Volume2, VolumeX, X } from "lucide-react";
import { COMMUNITIES } from "@/constants/communities";
import type { PostMediaItem } from "@/components/feed/MediaGrid";
import { ComposerHeader, DispatchFooter, DispatchIdentity } from "./ComposerParts";

interface Props {
  name: string; username: string; photoURL?: string; visibility: string;
  caption: string; onCaption: (value: string) => void;
  category: string; onCategory: (value: string) => void;
  location: string; onLocation: (value: string) => void; locationSummary: string;
  onLocationBlur: () => void; onDetect: () => void; locationBusy: boolean;
  sensitive: boolean; onSensitive: (value: boolean) => void;
  files: File[]; previews: PostMediaItem[]; onFiles: (files: File[]) => void;
  onRemove: (index: number) => void; onMute: (index: number) => void;
  posting: boolean; error: string; onPost: () => void; onBack: () => void;
}

export default function PostComposer(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ready = Boolean(props.caption.trim() || props.files.length);
  const hive = COMMUNITIES.find(item => item.id === props.category);
  return <main className="hv-dispatch">
    <ComposerHeader label="A NOTE TO YOUR NEIGHBOURHOOD" onBack={props.onBack} />
    <div className="dispatch-page-title"><div><p className="dispatch-eyebrow">THE LOCAL DISPATCH / NEW POST</p><h1>A little from <em>your corner.</em></h1></div><span className="dispatch-draft-status"><i /> Unpublished</span></div>
    <div className="dispatch-workspace dispatch-post-workspace">
      <section className="dispatch-canvas" aria-label="Write your post" onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); props.onFiles(Array.from(event.dataTransfer.files)); }} data-dragging={dragging}>
        <div className="dispatch-canvas-bar"><span>{preview ? "YOUR POST, AT A GLANCE" : "A BLANK PAGE. A GOOD START."}</span><button type="button" className="dispatch-text-button" onClick={() => setPreview(!preview)} aria-pressed={preview}>{preview ? <PenLine size={15} /> : <Eye size={15} />}{preview ? "Keep writing" : "Preview"}</button></div>
        <DispatchIdentity name={props.name} username={props.username} photoURL={props.photoURL} visibility={props.visibility} />
        {preview ? <div className="dispatch-written-preview"><span className="dispatch-hive-label">{hive?.name}</span><p>{props.caption || "Your words will appear here."}</p>{props.location && <span className="dispatch-preview-place"><MapPin size={14} />{props.location}</span>}</div> : <textarea id="dispatch-post-text" className="dispatch-writing" aria-label="Post text" placeholder={"What’s happening\naround you?"} value={props.caption} onChange={event => props.onCaption(event.target.value)} rows={7} disabled={props.posting} />}
        {props.previews.length > 0 && <div className={`dispatch-contact-sheet ${props.previews.length === 1 ? "is-single" : ""}`}>
          {props.previews.map((item, index) => <figure key={item.url}>
            {item.type === "video" ? <video src={item.url} muted={item.muted} controls playsInline disablePictureInPicture /> : <img src={item.url} alt={`Attachment ${index + 1}: ${props.files[index]?.name || "photo"}`} />}
            <figcaption><span>{String(index + 1).padStart(2, "0")} / {props.files[index]?.name}</span>{item.type === "video" && <button type="button" onClick={() => props.onMute(index)} aria-label={item.muted ? "Unmute attachment" : "Mute attachment"}>{item.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>}<button type="button" onClick={() => props.onRemove(index)} aria-label={`Remove attachment ${index + 1}`} disabled={props.posting}><X size={15} /></button></figcaption>
          </figure>)}
        </div>}
        {!preview && <div className="dispatch-attach-bar"><button type="button" className="dispatch-text-button" onClick={() => inputRef.current?.click()} disabled={props.posting}><ImagePlus size={19} />{props.files.length ? "Add another photo or video" : "Add photos or video"}<Plus size={15} /></button><span>or drop them here</span></div>}
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={event => { props.onFiles(Array.from(event.target.files || [])); event.target.value = ""; }} aria-label="Attach photos or videos" />
        <div className="dispatch-writing-foot"><span>Your words. Your perspective.</span><span>{props.caption.length.toLocaleString()} characters</span></div>
        {props.error && <p className="dispatch-error" role="alert">{props.error}</p>}
      </section>
      <aside className="dispatch-sidebar">
        <div className="dispatch-sidebar-heading"><span className="dispatch-eyebrow">THE FINISHING TOUCHES</span><h2>Help it find<br /><em>your people.</em></h2></div>
        <div className="dispatch-field"><label htmlFor="dispatch-hive">Post to a Hive <span>01</span></label><select id="dispatch-hive" value={props.category} onChange={event => props.onCategory(event.target.value)}>{COMMUNITIES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p>The people who care about the same thing.</p></div>
        <div className="dispatch-field"><label htmlFor="dispatch-location">Add a place <span>OPTIONAL</span></label><div className="dispatch-location-input"><MapPin size={16} /><input id="dispatch-location" placeholder="Area, city or lat,lng" value={props.location} onChange={event => props.onLocation(event.target.value)} onBlur={props.onLocationBlur} /></div><button type="button" className="dispatch-text-button" onClick={props.onDetect} disabled={props.locationBusy}>{props.locationBusy ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}Use my location</button><p>{props.locationSummary}</p></div>
        <label className="dispatch-sensitive"><input type="checkbox" checked={props.sensitive} onChange={event => props.onSensitive(event.target.checked)} /><span><strong>Sensitive content</strong><small>Let people choose before they view.</small></span></label>
        <div className="dispatch-publish"><p>Ready for the neighbourhood?</p><button type="button" className="dispatch-primary" disabled={!ready || props.posting} onClick={props.onPost}>{props.posting ? <><Loader2 size={18} className="animate-spin" /> Sharing your post…</> : <>Share post <ArrowRight size={20} /></>}</button><small>{props.visibility === "public" ? "Visible to everyone on Hivez." : "Visible to your followers."} Nothing is posted until you share.</small></div>
      </aside>
    </div>
    <DispatchFooter>There’s good in starting a conversation.</DispatchFooter>
  </main>;
}
