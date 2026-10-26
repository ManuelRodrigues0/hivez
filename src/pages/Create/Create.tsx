import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import CreateEntry from "@/components/create/CreateEntry";
import PostComposer from "@/components/create/PostComposer";
import { ComposerHeader, DispatchChecklist, DispatchFooter, DispatchIdentity } from "@/components/create/ComposerParts";
import { db } from "../../firebase/firebase";
import { COMMUNITIES } from "../../constants/communities";

import { addDoc, collection, doc, getDoc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import type { PostMediaItem } from "@/components/feed/MediaGrid";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  FileVideo,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createIssueCommunityForPost, getUserSummary } from "@/services/volunteering";
import { useUserLocation } from "@/context/LocationContext";
import { createLocationSnapshot, locationLabel, type LocationSnapshot } from "@/services/location";
import { REPORT_CATEGORIES, getReportCategory, type ReportCategoryConfig, type ReportUrgency } from "@/config/reportCategories";
import { validateReportMedia, type MediaValidationResult } from "@/services/mediaValidation";
import { verifyReportEvidence, type ReportVerificationResult } from "@/services/reportVerification";
import HiveSearch from "@/components/hiveSearch/HiveSearch";
import { buildHiveRegistry, intelAnalyzeIssue, intelAssistDescription, type HiveRegistryEntry } from "@/services/omnirouteIntel";
import { categoryFromHive, createProvisionalHive, isNewIssueCategory } from "@/services/hives";
import { visibilityForProfile } from "@/services/privacy";

type ReportStep = "category" | "media" | "verify" | "location" | "details" | "preview";

/** Clean new-issue analysis result surfaced from the OmniRoute intelligence gateway. */
interface IssueAnalysis {
  meaningfulness: string;
  descriptionImageMatch: boolean | null;
  consistencyNote: string | null;
  existingHiveId: string | null;
  existingHiveConfidence: number | null;
  proposal: { name: string; description: string; aliases: string[]; keywords: string[] } | null;
}

export default function Create() {
  const route = useLocation();
  return <CreateWorkspace key={route.key} />;
}

function CreateWorkspace() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, profile: profileCtx } = useAuth();
  const userLocation = useUserLocation();

  const isReportMode = Boolean(state?.reportMode);
  const isTextMode = state?.textMode;
  const media: File | File[] | undefined = state?.media;
  const textContent: string | undefined = state?.text;
  const [postFiles, setPostFiles] = useState<File[]>(() => Array.isArray(media) ? media : media ? [media] : []);
  const [postError, setPostError] = useState("");

  const [caption, setCaption] = useState(textContent || "");
  const [posting, setPosting] = useState(false);
  const [category, setCategory] = useState(COMMUNITIES[0].id);
  const [location, setLocation] = useState("");
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(userLocation.location);
  const [mutedVideos, setMutedVideos] = useState<Set<number>>(new Set());
  const [sensitivePost, setSensitivePost] = useState(false);

  const [reportStep, setReportStep] = useState<ReportStep>("category");
  const [selectedReportCategory, setSelectedReportCategory] = useState<ReportCategoryConfig | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(Array.isArray(media) ? media[0] || null : media || null);
  const [mediaValidation, setMediaValidation] = useState<MediaValidationResult | null>(null);
  const [verification, setVerification] = useState<ReportVerificationResult | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const evidenceRequest = useRef(0);
  const [reportDescription, setReportDescription] = useState("");
  const [reportUrgency, setReportUrgency] = useState<ReportUrgency>("normal");
  const [reportFields, setReportFields] = useState<Record<string, string>>({});
  const [reportError, setReportError] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);

  // OmniRoute intelligence: description assistance + new-issue analysis.
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistSuggestion, setAssistSuggestion] = useState<{ suggestion: string | null; hints: string[] } | null>(null);
  const [issueAnalysis, setIssueAnalysis] = useState<IssueAnalysis | null>(null);
  const [issueAnalysisBusy, setIssueAnalysisBusy] = useState(false);
  const [analysisRegistry, setAnalysisRegistry] = useState<HiveRegistryEntry[]>([]);
  const [createdHive, setCreatedHive] = useState<{ id: string; name: string } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isReportMode) return;
    document.querySelector<HTMLElement>(".dispatch-stage-title")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [isReportMode, reportStep]);

  const isTextOnly = postFiles.length === 0;
  const isMultiple = postFiles.length > 1;
  const singleFile = postFiles[0];
  const previewSources = useMemo(() => {
    return postFiles.map(file => ({url: URL.createObjectURL(file), type: file.type.startsWith("video") ? "video" as const : "image" as const}));
  }, [postFiles]);
  useEffect(() => () => previewSources.forEach(item => URL.revokeObjectURL(item.url)), [previewSources]);
  const previewItems: PostMediaItem[] = previewSources.map((item,index) => ({...item, muted: mutedVideos.has(index)}));
  const reportPreviewUrl = useMemo(() => reportFile ? URL.createObjectURL(reportFile) : "", [reportFile]);
  useEffect(() => () => { if (reportPreviewUrl) URL.revokeObjectURL(reportPreviewUrl); }, [reportPreviewUrl]);

  const isVideo = useMemo(() => {
    if (isTextOnly || isReportMode) return false;
    if (isMultiple) return Boolean(postFiles[0]?.type.startsWith("video"));
    return Boolean(singleFile?.type.startsWith("video"));
  }, [postFiles, isMultiple, singleFile, isTextOnly, isReportMode]);

  const extractHashtags = useCallback((text: string): string[] => {
    const matches = text.match(/#[\w]+/g);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
  }, []);

  if (!isReportMode && !isTextMode && !media && !textContent) {
    return <CreateEntry />;
  }

  function toggleMute(index: number) {
    setMutedVideos((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function addPostFiles(files: File[]) {
    if (posting) return;
    setPostError("");
    const accepted: File[] = [];
    for (const file of files) {
      const result = await validateReportMedia(file);
      if (result.ok) accepted.push(file);
      else setPostError(result.blockingError || "This file cannot be attached.");
    }
    if (accepted.length) setPostFiles(current => [...current, ...accepted]);
  }

  function removePostFile(index: number) {
    setPostFiles(current => current.filter((_, itemIndex) => itemIndex !== index));
    setMutedVideos(current => new Set([...current].filter(item => item !== index).map(item => item > index ? item - 1 : item)));
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
    if (!user || posting || (!caption.trim() && !postFiles.length)) return;

    try {
      setPosting(true);
      setPostError("");
      logReport(isTextOnly ? "Text post submission started" : "Media post submission started");

      if (isTextOnly) {
        // Live profile from AuthContext, fresh without an extra read.
        const profile = profileCtx || (await getDoc(doc(db, "users", user.uid))).data();
        const hashtags = extractHashtags(caption);
        const visibility = visibilityForProfile(profile);

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
          locationSnapshot: cleanUndefined(locationSnapshot),
          mediaUrl: "",
          mediaType: "text",
          likes: 0,
          comments: 0,
          shares: 0,
          reHives: 0,
          visibility,
          sensitive: sensitivePost,
          createdAt: serverTimestamp(),
        });

        await createIssueCommunityForPost({
          postId: postRef.id,
          ownerId: user.uid,
          owner: await getUserSummary(user.uid),
          caption,
          category,
          location: location.trim() || null,
          locationSnapshot: cleanUndefined(locationSnapshot),
          mediaUrl: "",
          mediaType: "text",
        });

        await updateDoc(doc(db, "users", user.uid), { posts: increment(1) });
        logReport(`Text post submitted: ${postRef.id}`);
        navigate("/");
        return;
      }

      const filesToUpload = postFiles;
      logReport(`Uploading ${filesToUpload.length} media file(s)`);
      const uploadResults = await uploadFilesToCloudinary(filesToUpload);
      logReport("Cloudinary upload completed");
      const mediaItems: PostMediaItem[] = uploadResults.map((result, index) => ({
        url: result.secure_url,
        type: filesToUpload[index].type.startsWith("video") ? "video" : "image",
        muted: mutedVideos.has(index),
      }));
      const mediaUrls = mediaItems.map((item) => item.url);

      // Live profile from AuthContext, fresh without an extra read.
      const profile = profileCtx || (await getDoc(doc(db, "users", user.uid))).data();
      const hashtags = extractHashtags(caption);
      const visibility = visibilityForProfile(profile);

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
        locationSnapshot: cleanUndefined(locationSnapshot),
        mediaUrl: mediaUrls[0],
        mediaUrls,
        mediaItems,
        mediaType: mediaItems[0]?.type || (isVideo ? "video" : "image"),
        likes: 0,
        comments: 0,
        shares: 0,
        reHives: 0,
        visibility,
        sensitive: sensitivePost,
        createdAt: serverTimestamp(),
      });

      await createIssueCommunityForPost({
        postId: postRef.id,
        ownerId: user.uid,
        owner: await getUserSummary(user.uid),
        caption,
        category,
        location: location.trim() || null,
        locationSnapshot: cleanUndefined(locationSnapshot),
        mediaUrl: mediaUrls[0],
        mediaType: mediaItems[0]?.type || (isVideo ? "video" : "image"),
      });

      await updateDoc(doc(db, "users", user.uid), { posts: increment(1) });
      logReport(`Media post submitted: ${postRef.id}`);
      navigate("/");
    } catch (error) {
      console.error("[Report] Upload failed", error);
      setPostError(error instanceof Error ? error.message : "Could not share your post. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleReportFile(file: File | undefined | null) {
    if (!file) return;
    const request = ++evidenceRequest.current;
    setEvidenceBusy(true);
    logReport(`Evidence selected: ${file.type}, ${Math.round(file.size / 1024)} KB`);
    setReportError("");
    setVerification(null);

    const validation = await validateReportMedia(file);
    if (request !== evidenceRequest.current) return;
    setEvidenceBusy(false);
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
    evidenceRequest.current += 1;
    setEvidenceBusy(false);
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

  function handleDiscoverySelect(_hiveId: string, hive: HiveRegistryEntry) {
    logReport(`Hive discovered: ${hive.name}`);
    selectReportCategory(categoryFromHive(hive));
  }

  async function runDescriptionAssist() {
    if (assistBusy) return;
    if (!reportDescription.trim()) {
      setReportError("Add a short description first, then we can help you improve it.");
      return;
    }
    setReportError("");
    setAssistBusy(true);
    try {
      const result = await intelAssistDescription(reportDescription);
      if (result) {
        setAssistSuggestion({ suggestion: result.suggestion, hints: result.completenessHints });
      } else {
        setAssistSuggestion(null);
        setReportError("Description assistance is unavailable right now. Your text was not changed.");
      }
    } finally {
      setAssistBusy(false);
    }
  }

  function acceptAssistSuggestion() {
    const suggestion = assistSuggestion?.suggestion;
    if (!suggestion) return;
    setReportDescription(suggestion);
    setAssistSuggestion(null);
    logReport("Description assistance suggestion accepted");
  }

  function editAssistSuggestion() {
    // Load the suggestion into the textarea so the user can edit it freely.
    const suggestion = assistSuggestion?.suggestion;
    if (!suggestion) return;
    setReportDescription(suggestion);
    setAssistSuggestion(null);
  }

  function discardAssistSuggestion() {
    setAssistSuggestion(null);
    logReport("Description assistance suggestion discarded");
  }

  async function runIssueAnalysis() {
    if (issueAnalysisBusy) return;
    if (!reportDescription.trim()) {
      setReportError("Describe the issue first so we can check whether an existing Hive already covers it.");
      return;
    }
    setReportError("");
    setIssueAnalysisBusy(true);
    setIssueAnalysis(null);
    try {
      const registry = await buildHiveRegistry();
      setAnalysisRegistry(registry);
      const imageDataUrl = await compressImageForIntel(reportFile);
      const result = await intelAnalyzeIssue({ description: reportDescription, imageDataUrl, registry });
      setIssueAnalysis(result);
      if (!result) {
        setReportError("Issue analysis is unavailable right now. You can continue manually.");
      }
    } finally {
      setIssueAnalysisBusy(false);
    }
  }

  function applyExistingHive() {
    const hiveId = issueAnalysis?.existingHiveId;
    if (!hiveId) return;
    const hive = analysisRegistry.find((entry) => entry.id === hiveId);
    if (!hive) {
      setReportError("That Hive is no longer available.");
      return;
    }
    logReport(`Existing Hive applied: ${hive.name}`);
    setIssueAnalysis(null);
    selectReportCategory(categoryFromHive(hive));
  }

  async function proposeHive() {
    const proposal = issueAnalysis?.proposal;
    if (!proposal || !user) return;
    try {
      const created = await createProvisionalHive(
        { name: proposal.name, description: proposal.description, aliases: proposal.aliases, keywords: proposal.keywords },
        user.uid,
      );
      setCreatedHive({ id: created.id, name: proposal.name });
      logReport(`Provisional Hive created: ${proposal.name}`);
      const registry = await buildHiveRegistry();
      const hive = registry.find((entry) => entry.id === created.id);
      if (hive) selectReportCategory(categoryFromHive(hive));
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Could not create the Hive.");
    }
  }

  function canContinueDetails() {
    if (!reportDescription.trim()) return false;
    return selectedReportCategory?.fields.every((field) => !field.required || reportFields[field.id]?.trim()) ?? false;
  }

  function openReportPreview() {
    if (canContinueDetails()) {
      setReportError("");
      setReportStep("preview");
      return;
    }
    setReportError("Add the required report details.");
    const missing = selectedReportCategory?.fields.find(field => field.required && !reportFields[field.id]?.trim());
    document.getElementById(!reportDescription.trim() ? "report-description" : `report-field-${missing?.id}`)?.focus();
  }

  async function submitReport() {
    if (!user || !selectedReportCategory || posting) return;
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

      // Live profile from AuthContext, fresh without an extra read.
      const profile = profileCtx || (await getDoc(doc(db, "users", user.uid))).data();
      const visibility = visibilityForProfile(profile);
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
        locationSnapshot: cleanUndefined(locationSnapshot),
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
        reHives: 0,
        visibility,
        sensitive: sensitivePost,
        createdAt: serverTimestamp(),
      }));

      await createIssueCommunityForPost({
        postId: postRef.id,
        ownerId: user.uid,
        owner: await getUserSummary(user.uid),
        caption: captionText,
        category: selectedReportCategory.communityId,
        location: location.trim() || null,
        locationSnapshot: cleanUndefined(locationSnapshot),
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

  return <PostComposer
    name={profileCtx?.displayName || user?.displayName || "Hivez User"}
    username={profileCtx?.username || user?.email?.split("@")[0] || "user"}
    photoURL={profileCtx?.photoURL || user?.photoURL || ""}
    visibility={visibilityForProfile(profileCtx)}
    caption={caption} onCaption={setCaption}
    category={category} onCategory={setCategory}
    location={location} onLocation={setLocation}
    locationSummary={locationSnapshot ? locationLabel(locationSnapshot, location) : "Optional. Coordinates help neighbours find this on the map."}
    onLocationBlur={applyManualCoordinates} onDetect={detectReportLocation} locationBusy={locationBusy}
    sensitive={sensitivePost} onSensitive={setSensitivePost}
    files={postFiles} previews={previewItems} onFiles={addPostFiles}
    onRemove={removePostFile} onMute={toggleMute}
    posting={posting} error={postError} onPost={uploadToCloudinary} onBack={() => navigate("/create", { replace: true, state: null })}
  />;

  function renderReportFlow() {
    const currentCategory = selectedReportCategory || (state?.categoryId ? getReportCategory(state.categoryId) : null);
    const reportSteps: ReportStep[] = currentCategory && !currentCategory.requiresMedia && !verification
      ? ["category", "media", "location", "details", "preview"]
      : ["category", "media", "verify", "location", "details", "preview"];
    function goBack() {
      if (posting || verificationBusy) return;
      setReportError("");
      if (reportStep === "category") navigate("/create", { replace: true, state: null });
      else setReportStep(reportSteps[Math.max(0, reportSteps.indexOf(reportStep) - 1)]);
    }

    return (
      <main className="hv-dispatch dispatch-report">
        <ComposerHeader label="A LOCAL REPORT / ONE STEP TOWARD CHANGE" onBack={goBack} />
        <div className="dispatch-page-title"><div><p className="dispatch-eyebrow">THE LOCAL DISPATCH / PHOTO REPORT</p><h1>Notice it. Share it. <em>Change it.</em></h1></div><span className="dispatch-draft-status"><i /> Unpublished</span></div>
        <nav className="dispatch-progress" aria-label="Report progress"><ol>
          {reportSteps.map((step, index) => <li key={step} className={step === reportStep ? "is-current" : stepOrder(step) < stepOrder(reportStep) ? "is-complete" : ""}>
            <button type="button" aria-current={step === reportStep ? "step" : undefined} disabled={stepOrder(step) > stepOrder(reportStep) || posting || verificationBusy} onClick={() => { setReportError(""); setReportStep(step); }}><span>{stepOrder(step) < stepOrder(reportStep) ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</span>{stepLabel(step)}</button>
          </li>)}
        </ol></nav>
        <div className="dispatch-workspace dispatch-report-workspace">
          <div className="dispatch-report-stage" key={reportStep}>
            <p className="dispatch-stage-index">{String(stepOrder(reportStep) + 1).padStart(2, "0")} / {stepLabel(reportStep)}</p>
          {reportStep === "category" && (
            <section>
              <h2 tabIndex={-1} className="dispatch-stage-title">What needs a little attention?</h2>
              <p className="dispatch-stage-copy">Find a Hive where people care about the same thing. A few words are all you need.</p>

              <div className="dispatch-hive-search">
                <HiveSearch
                  placeholder="Search a problem, a place, a Hive…"
                  maxResults={5}
                  onSelect={handleDiscoverySelect}
                  onCreateNewIssue={() => selectReportCategory(getReportCategory("other") ?? REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1])}
                />
              </div>
              <button type="button" className="dispatch-new-issue" onClick={() => selectReportCategory(getReportCategory("other") ?? REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1])}>Something a little different? Report another issue <ArrowRight size={17} /></button>
            </section>
          )}

          {reportStep === "media" && currentCategory && (
            <section>
              <h2 tabIndex={-1} className="dispatch-stage-title">{currentCategory.mediaTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{currentCategory.mediaHelp}</p>

              {!reportFile && <div className="dispatch-evidence-empty"><ImagePlus size={35} strokeWidth={1.1} /><strong>Every picture gives us a starting point.</strong><span>Choose a clear photo or video. Keep the useful details in view.</span></div>}

              <div className="dispatch-evidence-actions">
                {currentCategory.cameraAllowed && <ReportAction disabled={verificationBusy || evidenceBusy} onClick={() => cameraInputRef.current?.click()} icon={Camera} label={currentCategory.cameraLabel || "Open Camera"} />}
                {currentCategory.galleryAllowed && <ReportAction disabled={verificationBusy || evidenceBusy} onClick={() => galleryInputRef.current?.click()} icon={ImagePlus} label={currentCategory.galleryLabel || "Choose from Gallery"} />}
                {currentCategory.videoAllowed && <ReportAction disabled={verificationBusy || evidenceBusy} onClick={() => videoInputRef.current?.click()} icon={FileVideo} label={currentCategory.videoLabel || "Upload Video"} />}
              </div>

              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void handleReportFile(event.target.files?.[0]); event.target.value = ""; }} />
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void handleReportFile(event.target.files?.[0]); event.target.value = ""; }} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => { void handleReportFile(event.target.files?.[0]); event.target.value = ""; }} />
              {evidenceBusy && <p className="dispatch-stage-copy" role="status">Reading your evidence…</p>}

              {reportFile && (
                <div className="dispatch-evidence-preview">
                  <div className="dispatch-evidence-image">
                    {reportFile.type.startsWith("video") ? <video src={reportPreviewUrl} className="h-full w-full object-contain" controls playsInline disablePictureInPicture /> : <img src={reportPreviewUrl} alt="Selected report evidence" className="h-full w-full object-contain" />}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-semibold">{reportFile.name}</p>
                      <p className="text-xs text-muted-foreground">{Math.round(reportFile.size / 1024)} KB</p>
                    </div>
                    <button type="button" disabled={verificationBusy || evidenceBusy} onClick={() => { evidenceRequest.current += 1; setReportFile(null); setMediaValidation(null); setVerification(null); setReportError(""); }} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-semibold">
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

              {reportError && <p className="dispatch-error" role="alert">{reportError}</p>}

              {verificationBusy && (
                <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-foreground">
                  <div className="flex items-center gap-2 font-semibold">
                    <Loader2 size={16} className="animate-spin" />
                    Checking image...
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <p>Checking image quality and relevance to your selected Hive.</p>
                    <p>This may take a moment. Please keep this page open.</p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                {!currentCategory.requiresMedia && !reportFile ? <button type="button" onClick={() => setReportStep("location")} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Continue without a photo</button> : null}
                <button type="button" onClick={runVerification} disabled={verificationBusy || evidenceBusy || (currentCategory.requiresMedia && !reportFile)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {verificationBusy && <Loader2 size={16} className="animate-spin" />}
                  {verificationBusy ? "Checking your evidence…" : "Check photo & continue"}
                </button>
              </div>
            </section>
          )}

          {reportStep === "verify" && currentCategory && verification && (
            <section>
              <h2 tabIndex={-1} className="dispatch-stage-title">{verificationTitle(verification)}</h2>
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
                {(verification.finalDecision === "VERIFIED" || !currentCategory.requiresMedia) && <button type="button" onClick={() => setReportStep("location")} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Continue</button>}
              </div>
            </section>
          )}

          {reportStep === "location" && currentCategory && (
            <section>
              <h2 tabIndex={-1} className="dispatch-stage-title">Where did this happen?</h2>
              <p className="mt-2 text-sm text-muted-foreground">Use your current location or type an area. Coordinates help this report appear on the Hivez map.</p>
              <div className="mt-5 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input type="text" aria-label="Report location" placeholder="Area, city or lat,lng" value={location} onChange={(event) => setLocation(event.target.value)} onBlur={applyManualCoordinates} className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/50" />
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
              <h2 tabIndex={-1} className="dispatch-stage-title">Give the picture a little context.</h2><p className="dispatch-stage-copy">The story behind it helps your neighbours know how to help.</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="report-description" className="mb-2 block text-sm font-semibold">Tell us what you noticed.</label>
                  <textarea id="report-description" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={5} placeholder="What happened? When did you notice it? What would help?" className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm text-foreground outline-none transition focus:border-primary/50" />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={runDescriptionAssist}
                      disabled={assistBusy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-primary/50 hover:bg-muted disabled:opacity-50"
                    >
                      {assistBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      Improve wording
                    </button>
                    <span className="text-xs text-muted-foreground">Optional. Your text is only changed when you accept a suggestion.</span>
                  </div>

                  {assistSuggestion && (
                    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Sparkles size={13} /> Suggested wording
                      </p>
                      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm leading-6 text-foreground">{assistSuggestion.suggestion || "Your description is already clear."}</p>
                      {assistSuggestion.hints.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {assistSuggestion.hints.map((hint) => (
                            <li key={hint} className="flex gap-1.5"><span>•</span><span>{hint}</span></li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={acceptAssistSuggestion} disabled={!assistSuggestion.suggestion} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                          <Check size={13} /> Accept
                        </button>
                        <button type="button" onClick={editAssistSuggestion} disabled={!assistSuggestion.suggestion} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                          Edit
                        </button>
                        <button type="button" onClick={discardAssistSuggestion} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {currentCategory.fields.map((field) => (
                  <div key={field.id}>
                    <label htmlFor={`report-field-${field.id}`} className="mb-2 block text-sm font-semibold">{field.label}{field.required ? " *" : ""}</label>
                    <input id={`report-field-${field.id}`} required={field.required} value={reportFields[field.id] || ""} onChange={(event) => updateReportField(field.id, event.target.value)} placeholder={field.placeholder} className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/50" />
                  </div>
                ))}
                <div>
                  <label className="mb-2 block text-sm font-semibold">Urgency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["normal", "important", "urgent"] as ReportUrgency[]).map((item) => (
                      <button key={item} type="button" onClick={() => setReportUrgency(item)} aria-pressed={reportUrgency === item} className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize ${reportUrgency === item ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedReportCategory && isNewIssueCategory(selectedReportCategory.id) && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Sparkles size={13} /> New issue check
                    </p>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">
                      We'll first check whether an existing Hive already covers this. If not, we may propose a new one — you stay in control.
                    </p>
                    <button
                      type="button"
                      onClick={runIssueAnalysis}
                      disabled={issueAnalysisBusy || !reportDescription.trim()}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {issueAnalysisBusy && <Loader2 size={14} className="animate-spin" />}
                      {issueAnalysisBusy ? "Checking..." : "Check for an existing Hive"}
                    </button>

                    {createdHive && (
                      <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-foreground">
                        <span className="font-semibold">New Hive created:</span> {createdHive.name}. Your report will be filed under it.
                      </p>
                    )}

                    {issueAnalysis && (
                      <div className="mt-3 space-y-3 text-sm">
                        {issueAnalysis.meaningfulness === "NOT_A_MEANINGFUL_REPORTABLE_ISSUE" && (
                          <p className="rounded-xl bg-muted p-3 text-muted-foreground">
                            This doesn't look like a community issue we can build a Hive around, but you can still file it under a general category.
                          </p>
                        )}
                        {issueAnalysis.descriptionImageMatch === false && issueAnalysis.consistencyNote && (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                            {issueAnalysis.consistencyNote}
                          </p>
                        )}
                        {issueAnalysis.existingHiveId && (
                          <div className="rounded-xl bg-muted p-3">
                            <p className="font-semibold">An existing Hive may already cover this.</p>
                            <button type="button" onClick={applyExistingHive} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                              <Check size={13} /> Use this Hive
                            </button>
                          </div>
                        )}
                        {issueAnalysis.proposal && (
                          <div className="rounded-xl bg-muted p-3">
                            <p className="font-semibold">Proposed new Hive</p>
                            <p className="mt-1 font-medium">{issueAnalysis.proposal.name}</p>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{issueAnalysis.proposal.description}</p>
                            <button type="button" onClick={proposeHive} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                              <Check size={13} /> Create this Hive
                            </button>
                          </div>
                        )}
                        {(issueAnalysis.meaningfulness === "UNCERTAIN" || issueAnalysis.meaningfulness === "NOT_ENOUGH_EVIDENCE") && (
                          <p className="text-xs text-muted-foreground">
                            We weren't certain. You can still continue with your report.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {reportError && <p className="dispatch-error" role="alert">{reportError}</p>}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={openReportPreview} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Preview</button>
              </div>
            </section>
          )}

          {reportStep === "preview" && currentCategory && (
            <section>
              <h2 tabIndex={-1} className="dispatch-stage-title">Ready to put it out there?</h2><p className="dispatch-stage-copy">One last look before your neighbours see it.</p>
              <DispatchIdentity name={profileCtx?.displayName || user?.displayName || "Hivez User"} username={profileCtx?.username || "user"} photoURL={profileCtx?.photoURL || user?.photoURL || ""} visibility={visibilityForProfile(profileCtx)} />
              <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
                {reportFile && (
                  <div className="dispatch-evidence-image">
                    {reportFile.type.startsWith("video") ? <video src={reportPreviewUrl} className="h-full w-full object-contain" controls playsInline disablePictureInPicture /> : <img src={reportPreviewUrl} alt="Selected report evidence" className="h-full w-full object-contain" />}
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {verification?.finalDecision === "VERIFIED" ? <BadgeCheck size={18} className="text-primary" /> : <Camera size={18} className="text-primary" />}
                    <span>{currentCategory.title}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-foreground">{reportDescription}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-3 py-1.5 font-semibold capitalize">{reportUrgency}</span>
                    <span className="rounded-full bg-muted px-3 py-1.5 font-semibold">{verification ? verificationLabel(verification) : currentCategory.requiresMedia ? "Check pending" : "No image check needed"}</span>
                    {(location || locationSnapshot) && <span className="rounded-full bg-muted px-3 py-1.5 font-semibold">{locationLabel(locationSnapshot, location)}</span>}
                  </div>
                  {currentCategory.fields.some(field => reportFields[field.id]?.trim()) && <dl className="dispatch-preview-details">{currentCategory.fields.filter(field => reportFields[field.id]?.trim()).map(field => <div key={field.id}><dt>{field.label}</dt><dd>{reportFields[field.id]}</dd></div>)}</dl>}
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sensitivePost}
                  onChange={(e) => setSensitivePost(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  Mark as sensitive content — viewers with content filters will see a warning before it is shown.
                </span>
              </label>
              {reportError && <p className="dispatch-error" role="alert">{reportError}</p>}
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
          <aside className="dispatch-sidebar dispatch-report-sidebar">
            <span className="dispatch-eyebrow">YOUR REPORT, TAKING SHAPE</span>
            <div className="dispatch-report-summary">
              {reportFile ? <div className="dispatch-summary-image">{reportFile.type.startsWith("video") ? <video src={reportPreviewUrl} muted playsInline preload="metadata" /> : <img src={reportPreviewUrl} alt="Your report evidence" />}<span>{reportFile.type.startsWith("video") ? "VIDEO EVIDENCE" : "PHOTO EVIDENCE"}</span></div> : <div className="dispatch-summary-placeholder"><Camera size={27} strokeWidth={1.2} /><p>A small observation.<br /><em>A starting point.</em></p></div>}
              <div className="dispatch-summary-copy"><span className="dispatch-hive-label">{currentCategory?.title || "FIND YOUR HIVE"}</span><p>{reportDescription || "The things you notice can become the things we change together."}</p>{location && <span className="dispatch-preview-place"><MapPin size={14} />{location}</span>}</div>
            </div>
            <DispatchChecklist items={[
              { label: currentCategory ? currentCategory.title : "Find the people who care", complete: Boolean(currentCategory) },
              { label: "Bring the issue into view", complete: Boolean(reportFile) },
              { label: "Add the details that matter", complete: Boolean(reportDescription.trim()) },
            ]} />
            <p className="dispatch-sidebar-note">{reportStep === "category" ? "Start with the closest match. You can always go back and change it." : reportStep === "media" ? "A clear, unedited photo helps people understand the whole picture." : reportStep === "verify" ? "Image checks assess relevance and quality. They cannot confirm that an event happened." : reportStep === "location" ? "Only share a location you’re comfortable making visible to your audience." : reportStep === "details" ? "A place, a time, and what would help next. The useful details are often the simple ones." : "Take one last look. Your report is only shared when you press Submit Report."}</p>
          </aside>
        </div>
        <DispatchFooter>Your perspective can make a difference.</DispatchFooter>
      </main>
    );
  }
}

function ReportAction({ onClick, icon: Icon, label, disabled }: { onClick: () => void; icon: LucideIcon; label: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="dispatch-evidence-action">
      <Icon size={23} strokeWidth={1.5} />
      <span>{label}</span><ArrowRight size={17} />
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

function stepLabel(step: ReportStep) {
  if (step === "category") return "Hive";
  if (step === "media") return "Evidence";
  if (step === "verify") return "Check";
  if (step === "location") return "Place";
  if (step === "details") return "Details";
  return "Review";
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

/** Compresses an optional report image for the OmniRoute new-issue analysis. */
async function compressImageForIntel(file: File | null): Promise<string | null> {
  if (!file || !file.type.startsWith("image/")) return null;
  try {
    const url = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    const maxEdge = 768;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    URL.revokeObjectURL(url);
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}
