import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useMemo, useRef, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { COMMUNITIES } from "../../constants/communities";

import { addDoc, collection, doc, getDoc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import type { PostMediaItem } from "@/components/feed/MediaGrid";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  Car,
  Check,
  ChevronRight,
  CircleHelp,
  Construction,
  Dog,
  Droplets,
  FileVideo,
  HeartHandshake,
  HeartPulse,
  HousePlus,
  ImagePlus,
  Lightbulb,
  Loader2,
  LocateFixed,
  MapPin,
  RefreshCw,
  Trash2,
  TreePine,
  UserRoundSearch,
  Volume2,
  VolumeX,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createIssueCommunityForPost, getUserSummary } from "@/services/volunteering";
import { useUserLocation } from "@/context/LocationContext";
import { createLocationSnapshot, locationLabel, type LocationSnapshot } from "@/services/location";
import { REPORT_CATEGORIES, getReportCategory, type ReportCategoryConfig, type ReportUrgency } from "@/config/reportCategories";
import { validateReportMedia, type MediaValidationResult } from "@/services/mediaValidation";
import { verifyReportEvidence, type ReportVerificationResult } from "@/services/reportVerification";

const iconMap: Record<string, LucideIcon> = {
  Car,
  CircleHelp,
  Construction,
  Dog,
  Droplets,
  HeartHandshake,
  HeartPulse,
  HousePlus,
  Lightbulb,
  Trash2,
  TreePine,
  UserRoundSearch,
  Waves,
  Zap,
};

type ReportStep = "category" | "media" | "verify" | "location" | "details" | "preview";

export default function Create() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userLocation = useUserLocation();

  const isReportMode = Boolean(state?.reportMode);
  const isTextMode = state?.textMode;
  const media: File | File[] | undefined = state?.media;
  const textContent: string | undefined = state?.text;

  const [caption, setCaption] = useState(textContent || "");
  const [posting, setPosting] = useState(false);
  const [category, setCategory] = useState(COMMUNITIES[0].id);
  const [location, setLocation] = useState("");
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(userLocation.location);
  const [mutedVideos, setMutedVideos] = useState<Set<number>>(new Set());

  const [reportStep, setReportStep] = useState<ReportStep>("category");
  const [selectedReportCategory, setSelectedReportCategory] = useState<ReportCategoryConfig | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(Array.isArray(media) ? media[0] || null : media || null);
  const [mediaValidation, setMediaValidation] = useState<MediaValidationResult | null>(null);
  const [verification, setVerification] = useState<ReportVerificationResult | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [reportUrgency, setReportUrgency] = useState<ReportUrgency>("normal");
  const [reportFields, setReportFields] = useState<Record<string, string>>({});
  const [reportError, setReportError] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isTextOnly = isTextMode || (!isReportMode && !media && textContent);
  const showOptions = !isTextOnly;
  const isMultiple = Array.isArray(media);
  const singleFile = !isMultiple ? media : undefined;
  const filesToPreview = isMultiple ? media : singleFile ? [singleFile] : [];
  const previewItems: PostMediaItem[] = filesToPreview.map((file, index) => ({
    url: URL.createObjectURL(file),
    type: file.type.startsWith("video") ? "video" : "image",
    muted: mutedVideos.has(index),
  }));

  const isVideo = useMemo(() => {
    if (isTextOnly || isReportMode) return false;
    if (isMultiple) return media[0].type.startsWith("video");
    return singleFile!.type.startsWith("video");
  }, [media, isMultiple, singleFile, isTextOnly, isReportMode]);

  const extractHashtags = useCallback((text: string): string[] => {
    const matches = text.match(/#[\w]+/g);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
  }, []);

  if (!isReportMode && !isTextMode && !media && !textContent) {
    navigate("/");
    return null;
  }

  function toggleMute(index: number) {
    setMutedVideos((current) => {
      const next = new Set(current);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  async function detectPostLocation() {
    logReport("Location detection requested");
    const detected = await userLocation.requestLocation();
    if (!detected) {
      logReport("Location detection unavailable or denied");
      return;
    }
    setLocationSnapshot(detected);
    setLocation(locationLabel(detected));
    logReport(`Location captured: ${detected.latitude.toFixed(5)}, ${detected.longitude.toFixed(5)}`);
  }

  async function detectReportLocation() {
    setLocationBusy(true);
    try {
      await detectPostLocation();
    } finally {
      setLocationBusy(false);
    }
  }

  function applyManualCoordinates() {
    const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return;
    const snapshot = createLocationSnapshot({
      latitude: Number(match[1]),
      longitude: Number(match[2]),
      address: location.trim(),
      area: location.trim(),
    });
    setLocationSnapshot(snapshot);
    userLocation.setManualLocation(snapshot);
    logReport(`Manual location applied: ${snapshot.latitude.toFixed(5)}, ${snapshot.longitude.toFixed(5)}`);
  }

  async function uploadFilesToCloudinary(files: File[]) {
    return Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "hivez_upload");

        const endpoint = file.type.startsWith("video")
          ? "https://api.cloudinary.com/v1_1/dpotccr5q/video/upload"
          : "https://api.cloudinary.com/v1_1/dpotccr5q/image/upload";

        const response = await fetch(endpoint, { method: "POST", body: formData });
        if (!response.ok) throw new Error("Upload failed.");
        return response.json() as Promise<{ secure_url: string }>;
      }),
    );
  }

  async function uploadToCloudinary() {
    if (!user) return;

    try {
      setPosting(true);
      logReport(isTextOnly ? "Text post submission started" : "Media post submission started");

      if (isTextOnly) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const profile = userDoc.data();
        const hashtags = extractHashtags(caption);

        const postRef = await addDoc(collection(db, "posts"), {
          uid: user.uid,
          username: profile?.username || "",
          displayName: profile?.displayName || user.displayName || "",
          photoURL: profile?.photoURL || user.photoURL || "",
          verified: profile?.verified || false,
          caption,
          hashtags,
          category,
          location: location.trim() || null,
          locationSnapshot,
          mediaUrl: "",
          mediaType: "text",
          likes: 0,
          comments: 0,
          shares: 0,
          createdAt: serverTimestamp(),
        });

        await createIssueCommunityForPost({
          postId: postRef.id,
          ownerId: user.uid,
          owner: await getUserSummary(user.uid),
          caption,
          category,
          location: location.trim() || null,
          locationSnapshot,
          mediaUrl: "",
          mediaType: "text",
        });

        await updateDoc(doc(db, "users", user.uid), { posts: increment(1) });
        logReport(`Text post submitted: ${postRef.id}`);
        navigate("/");
        return;
      }

      const filesToUpload = isMultiple ? media : singleFile ? [singleFile] : [];
      logReport(`Uploading ${filesToUpload.length} media file(s)`);
      const uploadResults = await uploadFilesToCloudinary(filesToUpload);
      logReport("Cloudinary upload completed");
      const mediaItems: PostMediaItem[] = uploadResults.map((result, index) => ({
        url: result.secure_url,
        type: filesToUpload[index].type.startsWith("video") ? "video" : "image",
        muted: mutedVideos.has(index),
      }));
      const mediaUrls = mediaItems.map((item) => item.url);

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const profile = userDoc.data();
      const hashtags = extractHashtags(caption);

      const postRef = await addDoc(collection(db, "posts"), {
        uid: user.uid,
        username: profile?.username || "",
        displayName: profile?.displayName || user.displayName || "",
        photoURL: profile?.photoURL || user.photoURL || "",
        verified: profile?.verified || false,
        caption,
        hashtags,
        category,
        location: location.trim() || null,
        locationSnapshot,
        mediaUrl: mediaUrls[0],
        mediaUrls,
        mediaItems,
        mediaType: mediaItems[0]?.type || (isVideo ? "video" : "image"),
        likes: 0,
        comments: 0,
        shares: 0,
        createdAt: serverTimestamp(),
      });

      await createIssueCommunityForPost({
        postId: postRef.id,
        ownerId: user.uid,
        owner: await getUserSummary(user.uid),
        caption,
        category,
        location: location.trim() || null,
        locationSnapshot,
        mediaUrl: mediaUrls[0],
        mediaType: mediaItems[0]?.type || (isVideo ? "video" : "image"),
      });

      await updateDoc(doc(db, "users", user.uid), { posts: increment(1) });
      logReport(`Media post submitted: ${postRef.id}`);
      navigate("/");
    } catch (error) {
      console.error("[Report] Upload failed", error);
      alert("Upload failed.");
    } finally {
      setPosting(false);
    }
  }

  async function handleReportFile(file: File | undefined | null) {
    if (!file) return;
    logReport(`Evidence selected: ${file.type}, ${Math.round(file.size / 1024)} KB`);
    setReportError("");
    setVerification(null);

    const validation = await validateReportMedia(file);
    setMediaValidation(validation);
    if (!validation.ok) {
      logReport(`Evidence validation blocked: ${validation.blockingError || "unknown reason"}`);
      setReportError(validation.blockingError || "This file cannot be used.");
      return;
    }

    setReportFile(file);
    logReport(validation.warnings.length ? `Evidence accepted with warnings: ${validation.warnings.join("; ")}` : "Evidence accepted");
  }

  async function runVerification() {
    if (!selectedReportCategory) return;
    if (selectedReportCategory.requiresMedia && !reportFile) {
      setReportError("Add evidence before continuing.");
      return;
    }

    setReportError("");
    setVerificationBusy(true);
    try {
      logReport(`AI verification started for ${selectedReportCategory.title}`);
      const result = await verifyReportEvidence(selectedReportCategory.id, reportFile);
      setVerification(result);
      logReport(`AI verification finished: ${result.finalDecision}`);
      setReportStep("verify");
    } catch (error) {
      console.error("[Report] AI verification crashed", error);
      setReportError("AI verification failed. Please try again.");
    } finally {
      setVerificationBusy(false);
    }
  }

  function selectReportCategory(nextCategory: ReportCategoryConfig) {
    logReport(`Category selected: ${nextCategory.title}`);
    setSelectedReportCategory(nextCategory);
    setCategory(nextCategory.communityId);
    setReportFields({});
    setReportFile(null);
    setMediaValidation(null);
    setVerification(null);
    setReportError("");
    setReportStep(nextCategory.requiresMedia || nextCategory.cameraAllowed || nextCategory.galleryAllowed ? "media" : "details");
  }

  function updateReportField(id: string, value: string) {
    setReportFields((current) => ({ ...current, [id]: value }));
  }

  function canContinueDetails() {
    if (!reportDescription.trim()) return false;
    return selectedReportCategory?.fields.every((field) => !field.required || reportFields[field.id]?.trim()) ?? false;
  }

  async function submitReport() {
    if (!user || !selectedReportCategory) return;
    if (selectedReportCategory.requiresMedia && verification?.finalDecision !== "VERIFIED") {
      setReportError("This report needs a verified image before it can be submitted.");
      setReportStep(verification ? "verify" : "media");
      return;
    }
    if (!canContinueDetails()) {
      setReportError("Add the required report details.");
      return;
    }

    try {
      setPosting(true);
      setReportError("");

      const files = reportFile ? [reportFile] : [];
      const uploadResults = files.length ? await uploadFilesToCloudinary(files) : [];
      const mediaItems: PostMediaItem[] = uploadResults.map((result, index) => ({
        url: result.secure_url,
        type: files[index].type.startsWith("video") ? "video" : "image",
      }));
      const mediaUrl = mediaItems[0]?.url || "";

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const profile = userDoc.data();
      const captionText = reportDescription.trim();
      const localModel = verification?.localModel;
      const gemini = verification?.gemini;
      const verificationConfidence = verification?.verificationScore ?? localModel?.confidence ?? gemini?.confidence ?? null;
      const verificationModelVersion = localModel?.modelVersion || null;
      const verificationStatus = verification?.status || "pending";

      const postRef = await addDoc(collection(db, "posts"), cleanUndefined({
        uid: user.uid,
        username: profile?.username || "",
        displayName: profile?.displayName || user.displayName || "",
        photoURL: profile?.photoURL || user.photoURL || "",
        verified: profile?.verified || false,
        caption: captionText,
        hashtags: extractHashtags(captionText),
        category: selectedReportCategory.communityId,
        postType: "photo_report",
        issueCategory: selectedReportCategory.id,
        issueCategoryTitle: selectedReportCategory.title,
        reportFields,
        urgency: reportUrgency,
        location: location.trim() || null,
        locationSnapshot,
        mediaUrl,
        mediaUrls: mediaUrl ? [mediaUrl] : [],
        mediaItems,
        mediaType: mediaItems[0]?.type || "text",
        reportedAt: serverTimestamp(),
        aiVerification: verification ? {
          localModel: localModel
            ? {
                available: localModel.available,
                status: localModel.status,
                predictions: localModel.predictions,
                topLabel: localModel.topLabel,
                topClassType: localModel.topClassType,
                topConfidence: localModel.topConfidence,
                topConfidencePercent: localModel.topConfidencePercent,
                relevant: localModel.relevant,
                modelVersion: localModel.modelVersion,
                passed: localModel.passed,
                source: localModel.source,
                reason: localModel.reason,
              }
            : null,
          gemini: gemini || { enabled: false },
          providers: verification.providers,
          finalDecision: verification.finalDecision,
          verificationScore: verification.verificationScore,
          agreement: verification.agreement,
          consensus: verification.consensus,
          verifiedAt: verification.verifiedAt,
          finalClassification: verification.finalClassification,
          message: verification.message,
        } : null,
        verificationStatus,
        verificationConfidence,
        verificationModel: selectedReportCategory.verificationModel,
        verificationModelVersion,
        likes: 0,
        comments: 0,
        shares: 0,
        createdAt: serverTimestamp(),
      }));

      await createIssueCommunityForPost({
        postId: postRef.id,
        ownerId: user.uid,
        owner: await getUserSummary(user.uid),
        caption: captionText,
        category: selectedReportCategory.communityId,
        location: location.trim() || null,
        locationSnapshot,
        mediaUrl,
        mediaType: mediaItems[0]?.type || "text",
      });

      await updateDoc(doc(db, "users", user.uid), { posts: increment(1) });
      navigate("/");
    } catch (error) {
      console.error(error);
      setReportError("Report submission failed. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  if (isReportMode) {
    return renderReportFlow();
  }

  return (
    <main className="app-create-page min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground transition hover:text-foreground">
          Cancel
        </button>
        <h1 className="text-base font-semibold text-foreground">New Post</h1>
        <button
          onClick={uploadToCloudinary}
          disabled={posting}
          className="rounded-full bg-primary px-5 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {posting ? "Posting..." : "Share"}
        </button>
      </div>

      <div className={`mx-auto w-full ${isTextOnly ? "max-w-3xl lg:p-8 p-4" : "max-w-4xl lg:p-6 p-4"}`}>
        <div className={`border-b border-border ${isTextOnly ? "p-8" : "p-4"}`}>
          <div className="mb-4 flex items-center gap-3">
            <img src={user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-foreground">{user?.displayName || "Hivez User"}</p>
              <p className="text-xs text-muted-foreground">@{user?.email?.split("@")[0] || "user"}</p>
            </div>
          </div>

          <textarea
            placeholder="What's on your mind?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={isTextOnly ? 12 : 4}
            className={`w-full resize-none rounded-xl border border-border bg-card p-3 text-sm text-foreground outline-none transition focus:border-primary/50 ${isTextOnly ? "text-base" : ""}`}
          />

          {previewItems.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {previewItems.map((item, index) => (
                <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                  {item.type === "video" ? (
                    <>
                      <video src={item.url} className="h-full w-full object-cover" muted={item.muted} controls disablePictureInPicture />
                      <button onClick={() => toggleMute(index)} className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/90">
                        {item.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                    </>
                  ) : (
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}

          {extractHashtags(caption).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {extractHashtags(caption).map((tag) => (
                <span key={tag} className="text-xs text-primary">{tag}</span>
              ))}
            </div>
          )}

          {showOptions && (
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Add to Hive</label>
              <div className="flex flex-wrap gap-2">
                {COMMUNITIES.map((community) => (
                  <button
                    key={community.id}
                    onClick={() => setCategory(community.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm transition md:px-4 ${
                      category === community.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span>{community.icon}</span>
                    <span className="hidden md:inline">{community.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showOptions && (
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Add Location</label>
              <div className="flex flex-col gap-2 md:max-w-xl">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Area, city or lat,lng"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onBlur={applyManualCoordinates}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50"
                  />
                  <button type="button" onClick={detectPostLocation} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:bg-muted">
                    <LocateFixed size={16} />
                    Detect
                  </button>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={14} />
                  {locationSnapshot ? `${locationLabel(locationSnapshot, location)} (${locationSnapshot.latitude.toFixed(5)}, ${locationSnapshot.longitude.toFixed(5)})` : "Location is optional, but coordinates make the post visible in Nearby and Map."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );

  function renderReportFlow() {
    const currentCategory = selectedReportCategory || (state?.categoryId ? getReportCategory(state.categoryId) : null);
    const reportPreviewUrl = reportFile ? URL.createObjectURL(reportFile) : "";

    return (
      <main className="app-create-page min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <button type="button" onClick={() => (reportStep === "category" ? navigate(-1) : setReportStep(previousReportStep(reportStep)))} className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-muted">
              <ArrowLeft size={20} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold">Photo Report</p>
              <p className="text-xs text-muted-foreground">{stepLabel(reportStep)}</p>
            </div>
            <button type="button" onClick={() => navigate("/")} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">Cancel</button>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-6 grid grid-cols-6 gap-1.5">
            {(["category", "media", "verify", "location", "details", "preview"] as ReportStep[]).map((step) => (
              <div key={step} className={`h-1.5 rounded-full ${stepOrder(step) <= stepOrder(reportStep) ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          {reportStep === "category" && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">What are you reporting?</h1>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {REPORT_CATEGORIES.map((item) => {
                  const Icon = iconMap[item.icon] || CircleHelp;
                  return (
                    <button key={item.id} type="button" onClick={() => selectReportCategory(item)} className="flex min-h-24 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-muted">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Icon size={22} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{item.title}</span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span>
                      </span>
                      <ChevronRight size={18} className="text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {reportStep === "media" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">{currentCategory.mediaTitle}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{currentCategory.mediaHelp}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {currentCategory.cameraAllowed && <ReportAction onClick={() => cameraInputRef.current?.click()} icon={Camera} label={currentCategory.cameraLabel || "Open Camera"} />}
                {currentCategory.galleryAllowed && <ReportAction onClick={() => galleryInputRef.current?.click()} icon={ImagePlus} label={currentCategory.galleryLabel || "Choose from Gallery"} />}
                {currentCategory.videoAllowed && <ReportAction onClick={() => videoInputRef.current?.click()} icon={FileVideo} label={currentCategory.videoLabel || "Upload Video"} />}
              </div>

              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleReportFile(event.target.files?.[0])} />
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleReportFile(event.target.files?.[0])} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => handleReportFile(event.target.files?.[0])} />

              {reportFile && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="aspect-[4/3] bg-muted">
                    {reportFile.type.startsWith("video") ? <video src={reportPreviewUrl} className="h-full w-full object-cover" controls playsInline disablePictureInPicture /> : <img src={reportPreviewUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-semibold">{reportFile.name}</p>
                      <p className="text-xs text-muted-foreground">{Math.round(reportFile.size / 1024)} KB</p>
                    </div>
                    <button type="button" onClick={() => { setReportFile(null); setMediaValidation(null); setVerification(null); }} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-semibold">
                      <RefreshCw size={16} />
                      Replace
                    </button>
                  </div>
                </div>
              )}

              {mediaValidation?.warnings.length ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  <div className="flex gap-2">
                    <AlertTriangle size={18} />
                    <div>
                      <p className="font-semibold">Your photo may be difficult to verify.</p>
                      {mediaValidation.warnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
                    </div>
                  </div>
                </div>
              ) : null}

              {reportError && <p className="mt-4 text-sm font-medium text-red-500">{reportError}</p>}

              {verificationBusy && (
                <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-foreground">
                  <div className="flex items-center gap-2 font-semibold">
                    <Loader2 size={16} className="animate-spin" />
                    Checking image...
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <p>Local AI analysis is running first.</p>
                    <p>Cloud checks will stop early if enough systems agree.</p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                {mediaValidation?.warnings.length ? <button type="button" onClick={runVerification} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Continue Anyway</button> : null}
                <button type="button" onClick={runVerification} disabled={verificationBusy || (currentCategory.requiresMedia && !reportFile)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {verificationBusy && <Loader2 size={16} className="animate-spin" />}
                  Run AI Check
                </button>
              </div>
            </section>
          )}

          {reportStep === "verify" && currentCategory && verification && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">{verificationTitle(verification)}</h1>
              <div className="mt-5 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${verification.finalDecision === "VERIFIED" ? "bg-[#3f6f4b]/12 text-[#2f5f3e] dark:bg-primary/25 dark:text-primary" : "bg-[#f2c14e]/25 text-[#8a6100] dark:bg-accent/25 dark:text-accent"}`}>
                    {verification.finalDecision === "VERIFIED" ? <Check size={22} /> : <AlertTriangle size={22} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{currentCategory.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{verification.message}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Metric label="Local model" value={verification.localModel?.available ? verification.localModel.topLabel || "Analyzed" : "Unavailable"} />
                  <Metric label="Local confidence" value={formatConfidence(verification.localModel?.topConfidence)} />
                  <Metric label="AI checks" value={verification.consensus ? `${verification.consensus.successfulChecks} completed` : "Not checked"} />
                  <Metric label="Consensus" value={verification.consensus?.earlyConsensusReached ? "Reached early" : verification.finalDecision.toLowerCase()} />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                {verification.finalDecision !== "VERIFIED" && <button type="button" onClick={() => setReportStep("media")} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Try Another Image</button>}
                {verification.finalDecision === "VERIFIED" && <button type="button" onClick={() => setReportStep("location")} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Continue</button>}
              </div>
            </section>
          )}

          {reportStep === "location" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">Where did this happen?</h1>
              <p className="mt-2 text-sm text-muted-foreground">Use your current location or type an area. Coordinates help this report appear on the Hivez map.</p>
              <div className="mt-5 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="Area, city or lat,lng" value={location} onChange={(event) => setLocation(event.target.value)} onBlur={applyManualCoordinates} className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/50" />
                  <button type="button" onClick={detectReportLocation} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 text-sm font-semibold">
                    {locationBusy ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                    Detect
                  </button>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={14} />
                  {locationSnapshot ? `${locationLabel(locationSnapshot, location)} (${locationSnapshot.latitude.toFixed(5)}, ${locationSnapshot.longitude.toFixed(5)})` : "Location permission is optional. You can continue with a typed location."}
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => setReportStep("details")} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Continue</button>
              </div>
            </section>
          )}

          {reportStep === "details" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">Add details</h1>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold">What happened?</label>
                  <textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={5} placeholder="Describe the issue clearly..." className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm text-foreground outline-none transition focus:border-primary/50" />
                </div>
                {currentCategory.fields.map((field) => (
                  <div key={field.id}>
                    <label className="mb-2 block text-sm font-semibold">{field.label}{field.required ? " *" : ""}</label>
                    <input value={reportFields[field.id] || ""} onChange={(event) => updateReportField(field.id, event.target.value)} placeholder={field.placeholder} className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/50" />
                  </div>
                ))}
                <div>
                  <label className="mb-2 block text-sm font-semibold">Urgency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["normal", "important", "urgent"] as ReportUrgency[]).map((item) => (
                      <button key={item} type="button" onClick={() => setReportUrgency(item)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize ${reportUrgency === item ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {reportError && <p className="mt-4 text-sm font-medium text-red-500">{reportError}</p>}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => canContinueDetails() ? setReportStep("preview") : setReportError("Add the required report details.")} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Preview</button>
              </div>
            </section>
          )}

          {reportStep === "preview" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">Preview report</h1>
              <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
                {reportFile && (
                  <div className="aspect-[4/3] bg-muted">
                    {reportFile.type.startsWith("video") ? <video src={reportPreviewUrl} className="h-full w-full object-cover" controls playsInline disablePictureInPicture /> : <img src={reportPreviewUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BadgeCheck size={18} className="text-primary" />
                    <span>{currentCategory.title}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-foreground">{reportDescription}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-3 py-1.5 font-semibold capitalize">{reportUrgency}</span>
                    <span className="rounded-full bg-muted px-3 py-1.5 font-semibold">{verificationLabel(verification)}</span>
                    {(location || locationSnapshot) && <span className="rounded-full bg-muted px-3 py-1.5 font-semibold">{locationLabel(locationSnapshot, location)}</span>}
                  </div>
                </div>
              </div>
              {reportError && <p className="mt-4 text-sm font-medium text-red-500">{reportError}</p>}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setReportStep("details")} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Edit</button>
                <button type="button" onClick={submitReport} disabled={posting} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {posting && <Loader2 size={16} className="animate-spin" />}
                  Submit Report
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }
}

function ReportAction({ onClick, icon: Icon, label }: { onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-semibold transition hover:border-primary/50 hover:bg-muted">
      <Icon size={24} />
      <span>{label}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}

function previousReportStep(step: ReportStep): ReportStep {
  if (step === "media") return "category";
  if (step === "verify") return "media";
  if (step === "location") return "verify";
  if (step === "details") return "location";
  if (step === "preview") return "details";
  return "category";
}

function stepLabel(step: ReportStep) {
  if (step === "category") return "Select issue";
  if (step === "media") return "Evidence";
  if (step === "verify") return "AI check";
  if (step === "location") return "Location";
  if (step === "details") return "Details";
  return "Preview";
}

function stepOrder(step: ReportStep) {
  return ["category", "media", "verify", "location", "details", "preview"].indexOf(step);
}

function formatConfidence(confidence: number | undefined) {
  if (typeof confidence !== "number") return "Not available";
  return `${Math.round(confidence * 100)}%`;
}

function verificationLabel(verification: ReportVerificationResult | null) {
  if (!verification) return "Pending";
  if (verification.finalDecision === "VERIFIED") return "Verified";
  if (verification.finalDecision === "REJECTED") return "Image Does Not Match";
  return "Uncertain";
}

function verificationTitle(verification: ReportVerificationResult) {
  if (verification.finalDecision === "VERIFIED") return "Verified";
  if (verification.finalDecision === "REJECTED") return "Image Does Not Match Category";
  return "Verification Uncertain";
}

function logReport(message: string) {
  console.info(`[Report] ${message}`);
}

function cleanUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cleanUndefined(item)).filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, cleanUndefined(entry)]),
    ) as T;
  }

  return value;
}
