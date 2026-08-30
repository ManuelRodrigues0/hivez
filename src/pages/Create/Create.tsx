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
    const detected = await userLocation.requestLocation();
    if (!detected) return;
    setLocationSnapshot(detected);
    setLocation(locationLabel(detected));
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
        navigate("/");
        return;
      }

      const filesToUpload = isMultiple ? media : singleFile ? [singleFile] : [];
      const uploadResults = await uploadFilesToCloudinary(filesToUpload);
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
      navigate("/");
    } catch (error) {
      console.error(error);
      alert("Upload failed.");
    } finally {
      setPosting(false);
    }
  }

  async function handleReportFile(file: File | undefined | null) {
    if (!file) return;
    setReportError("");
    setVerification(null);

    const validation = await validateReportMedia(file);
    setMediaValidation(validation);
    if (!validation.ok) {
      setReportError(validation.blockingError || "This file cannot be used.");
      return;
    }

    setReportFile(file);
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
      const result = await verifyReportEvidence(selectedReportCategory.id, reportFile);
      setVerification(result);
      setReportStep("verify");
    } finally {
      setVerificationBusy(false);
    }
  }

  function selectReportCategory(nextCategory: ReportCategoryConfig) {
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
      const verificationConfidence = localModel?.confidence ?? gemini?.confidence ?? null;
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
                prediction: localModel.predictedClass,
                confidence: localModel.confidence,
                modelVersion: localModel.modelVersion,
                passed: localModel.passed,
                source: localModel.source,
                reason: localModel.reason,
              }
            : null,
          gemini: gemini || { enabled: false },
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
    <main className="app-create-page min-h-screen bg-white dark:bg-black">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
        <button onClick={() => navigate(-1)} className="text-sm text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300">
          Cancel
        </button>
        <h1 className="text-base font-semibold text-zinc-900 dark:text-white">New Post</h1>
        <button
          onClick={uploadToCloudinary}
          disabled={posting}
          className="rounded-full bg-black px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {posting ? "Posting..." : "Share"}
        </button>
      </div>

      <div className={`mx-auto w-full ${isTextOnly ? "max-w-3xl lg:p-8 p-4" : "max-w-4xl lg:p-6 p-4"}`}>
        <div className={`border-b border-zinc-200 dark:border-zinc-800 ${isTextOnly ? "p-8" : "p-4"}`}>
          <div className="mb-4 flex items-center gap-3">
            <img src={user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{user?.displayName || "Hivez User"}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">@{user?.email?.split("@")[0] || "user"}</p>
            </div>
          </div>

          <textarea
            placeholder="What's on your mind?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={isTextOnly ? 12 : 4}
            className={`w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-600 ${isTextOnly ? "text-base" : ""}`}
          />

          {previewItems.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {previewItems.map((item, index) => (
                <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
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
                <span key={tag} className="text-xs text-sky-500">{tag}</span>
              ))}
            </div>
          )}

          {showOptions && (
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Add to Hive</label>
              <div className="flex flex-wrap gap-2">
                {COMMUNITIES.map((community) => (
                  <button
                    key={community.id}
                    onClick={() => setCategory(community.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm transition md:px-4 ${
                      category === community.id
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
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
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Add Location</label>
              <div className="flex flex-col gap-2 md:max-w-xl">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Area, city or lat,lng"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onBlur={applyManualCoordinates}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-600"
                  />
                  <button type="button" onClick={detectPostLocation} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm font-semibold transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                    <LocateFixed size={16} />
                    Detect
                  </button>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
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
      <main className="min-h-screen bg-white text-zinc-950 dark:bg-black dark:text-white">
        <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <button type="button" onClick={() => (reportStep === "category" ? navigate(-1) : setReportStep(previousReportStep(reportStep)))} className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <ArrowLeft size={20} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold">Photo Report</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{stepLabel(reportStep)}</p>
            </div>
            <button type="button" onClick={() => navigate("/")} className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:hover:text-white">Cancel</button>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-6 grid grid-cols-6 gap-1.5">
            {(["category", "media", "verify", "location", "details", "preview"] as ReportStep[]).map((step) => (
              <div key={step} className={`h-1.5 rounded-full ${stepOrder(step) <= stepOrder(reportStep) ? "bg-zinc-950 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-800"}`} />
            ))}
          </div>

          {reportStep === "category" && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">What are you reporting?</h1>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {REPORT_CATEGORIES.map((item) => {
                  const Icon = iconMap[item.icon] || CircleHelp;
                  return (
                    <button key={item.id} type="button" onClick={() => selectReportCategory(item)} className="flex min-h-24 items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-400 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-600 dark:hover:bg-zinc-900">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-black"><Icon size={22} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{item.title}</span>
                        <span className="mt-1 block text-sm leading-5 text-zinc-500 dark:text-zinc-400">{item.description}</span>
                      </span>
                      <ChevronRight size={18} className="text-zinc-400" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {reportStep === "media" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">{currentCategory.mediaTitle}</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{currentCategory.mediaHelp}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {currentCategory.cameraAllowed && <ReportAction onClick={() => cameraInputRef.current?.click()} icon={Camera} label={currentCategory.cameraLabel || "Open Camera"} />}
                {currentCategory.galleryAllowed && <ReportAction onClick={() => galleryInputRef.current?.click()} icon={ImagePlus} label={currentCategory.galleryLabel || "Choose from Gallery"} />}
                {currentCategory.videoAllowed && <ReportAction onClick={() => videoInputRef.current?.click()} icon={FileVideo} label={currentCategory.videoLabel || "Upload Video"} />}
              </div>

              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleReportFile(event.target.files?.[0])} />
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleReportFile(event.target.files?.[0])} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => handleReportFile(event.target.files?.[0])} />

              {reportFile && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                    {reportFile.type.startsWith("video") ? <video src={reportPreviewUrl} className="h-full w-full object-cover" controls playsInline disablePictureInPicture /> : <img src={reportPreviewUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-semibold">{reportFile.name}</p>
                      <p className="text-xs text-zinc-500">{Math.round(reportFile.size / 1024)} KB</p>
                    </div>
                    <button type="button" onClick={() => { setReportFile(null); setMediaValidation(null); setVerification(null); }} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-sm font-semibold dark:border-zinc-700">
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

              <div className="mt-6 flex justify-end gap-2">
                {mediaValidation?.warnings.length ? <button type="button" onClick={runVerification} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold dark:border-zinc-700">Continue Anyway</button> : null}
                <button type="button" onClick={runVerification} disabled={verificationBusy || (currentCategory.requiresMedia && !reportFile)} className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                  {verificationBusy && <Loader2 size={16} className="animate-spin" />}
                  Run AI Check
                </button>
              </div>
            </section>
          )}

          {reportStep === "verify" && currentCategory && verification && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">AI Check Complete</h1>
              <div className="mt-5 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${verification.status === "ai_checked" || verification.status === "local_model_only" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                    {verification.status === "ai_checked" || verification.status === "local_model_only" ? <Check size={22} /> : <AlertTriangle size={22} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{currentCategory.title}</p>
                    <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">{verification.message}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Metric label="Local model" value={verification.localModel?.available ? verification.localModel.predictedClass || "Analyzed" : "Unavailable"} />
                  <Metric label="Local confidence" value={formatConfidence(verification.localModel?.confidence)} />
                  <Metric label="Image relevance" value={verification.gemini.enabled ? (verification.gemini.imageRelevant ? "Good" : "Needs review") : "Not checked"} />
                  <Metric label="Image quality" value={verification.gemini.imageQuality || "Not checked"} />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                {verification.status === "requires_review" && <button type="button" onClick={() => setReportStep("media")} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold dark:border-zinc-700">Upload Another</button>}
                <button type="button" onClick={() => setReportStep("location")} className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black">Continue</button>
              </div>
            </section>
          )}

          {reportStep === "location" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">Where did this happen?</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Use your current location or type an area. Coordinates help this report appear on the Hivez map.</p>
              <div className="mt-5 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="Area, city or lat,lng" value={location} onChange={(event) => setLocation(event.target.value)} onBlur={applyManualCoordinates} className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900" />
                  <button type="button" onClick={detectReportLocation} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 px-4 text-sm font-semibold dark:border-zinc-700">
                    {locationBusy ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                    Detect
                  </button>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <MapPin size={14} />
                  {locationSnapshot ? `${locationLabel(locationSnapshot, location)} (${locationSnapshot.latitude.toFixed(5)}, ${locationSnapshot.longitude.toFixed(5)})` : "Location permission is optional. You can continue with a typed location."}
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => setReportStep("details")} className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black">Continue</button>
              </div>
            </section>
          )}

          {reportStep === "details" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">Add details</h1>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold">What happened?</label>
                  <textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={5} placeholder="Describe the issue clearly..." className="w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900" />
                </div>
                {currentCategory.fields.map((field) => (
                  <div key={field.id}>
                    <label className="mb-2 block text-sm font-semibold">{field.label}{field.required ? " *" : ""}</label>
                    <input value={reportFields[field.id] || ""} onChange={(event) => updateReportField(field.id, event.target.value)} placeholder={field.placeholder} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900" />
                  </div>
                ))}
                <div>
                  <label className="mb-2 block text-sm font-semibold">Urgency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["normal", "important", "urgent"] as ReportUrgency[]).map((item) => (
                      <button key={item} type="button" onClick={() => setReportUrgency(item)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize ${reportUrgency === item ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-200 dark:border-zinc-700"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {reportError && <p className="mt-4 text-sm font-medium text-red-500">{reportError}</p>}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => canContinueDetails() ? setReportStep("preview") : setReportError("Add the required report details.")} className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black">Preview</button>
              </div>
            </section>
          )}

          {reportStep === "preview" && currentCategory && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight">Preview report</h1>
              <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                {reportFile && (
                  <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                    {reportFile.type.startsWith("video") ? <video src={reportPreviewUrl} className="h-full w-full object-cover" controls playsInline disablePictureInPicture /> : <img src={reportPreviewUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BadgeCheck size={18} className="text-sky-500" />
                    <span>{currentCategory.title}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-zinc-800 dark:text-zinc-200">{reportDescription}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-3 py-1.5 font-semibold capitalize dark:bg-zinc-900">{reportUrgency}</span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1.5 font-semibold dark:bg-zinc-900">{verificationLabel(verification)}</span>
                    {(location || locationSnapshot) && <span className="rounded-full bg-zinc-100 px-3 py-1.5 font-semibold dark:bg-zinc-900">{locationLabel(locationSnapshot, location)}</span>}
                  </div>
                </div>
              </div>
              {reportError && <p className="mt-4 text-sm font-medium text-red-500">{reportError}</p>}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setReportStep("details")} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold dark:border-zinc-700">Edit</button>
                <button type="button" onClick={submitReport} disabled={posting} className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">
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
    <button type="button" onClick={onClick} className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold transition hover:border-zinc-400 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-600">
      <Icon size={24} />
      <span>{label}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
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
  if (verification.status === "ai_checked") return "AI Checked";
  if (verification.status === "local_model_only") return "Local AI Checked";
  if (verification.status === "requires_review") return "Requires Review";
  return "Pending";
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
