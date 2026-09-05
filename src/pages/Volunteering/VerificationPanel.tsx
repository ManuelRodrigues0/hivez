import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  activateFallbackVerification,
  listenCommunityConfirmations,
  listenVerificationCases,
  listenVerificationDecisions,
  listenVerificationEvents,
  listenWitnessConfirmations,
  reopenVerificationCase,
  submitCommunityConfirmation,
  submitReviewerDecision,
  submitWitnessConfirmation,
} from "@/services/volunteering";
import { uploadToCloudinary } from "@/services/mediaUpload";
import type {
  ActivityEvidence,
  CommunityConfirmation,
  CommunityMember,
  ReviewerDecision,
  VerificationCase,
  VerificationCaseEvent,
  VerificationDecision,
  VolunteerActivity,
  VolunteerUserSummary,
  WitnessConfirmation,
} from "@/types/volunteering";
import { MORE_EVIDENCE_REASONS, REJECT_REASONS, type VerificationConfidenceLevel } from "@/types/volunteering";
import {
  computeVerificationConfidence,
  isCaseReviewable,
  reviewerDecisionLabel,
  verificationCaseStatusLabel,
  verificationTimeText,
} from "@/utils/verification";

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

const statusStyles: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  DISPUTED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  NEEDS_MORE_EVIDENCE: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  SUBMITTED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  UNDER_REVIEW: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  PARTIALLY_CONFIRMED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};
/** One verification case for a community: progress, evidence comparison,
 *  reviewer decisions, supporting signals and the full audit timeline. */
export default function VerificationPanel({ communityId, evidence, member, summary, activities }: {
  communityId: string;
  evidence: ActivityEvidence[];
  member: CommunityMember | null;
  summary: VolunteerUserSummary | null;
  activities: VolunteerActivity[];
}) {
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [decisions, setDecisions] = useState<VerificationDecision[]>([]);
  const [events, setEvents] = useState<VerificationCaseEvent[]>([]);
  const [witnesses, setWitnesses] = useState<WitnessConfirmation[]>([]);
  const [communityConfirmations, setCommunityConfirmations] = useState<CommunityConfirmation[]>([]);

  const [decision, setDecision] = useState<ReviewerDecision | "">("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [witnessText, setWitnessText] = useState("");
  const [witnessMediaUrl, setWitnessMediaUrl] = useState("");
  const [confirmResolved, setConfirmResolved] = useState(true);
  const [reopenReason, setReopenReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Ticking clock (minute resolution) so deadline comparisons never run during render.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 60_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => listenVerificationCases(communityId, setCases), [communityId]);

  const caseId = cases[0]?.id || null;

  useEffect(() => {
    if (!caseId) return;
    const unsubs = [
      listenVerificationDecisions(caseId, setDecisions),
      listenVerificationEvents(caseId, setEvents),
      listenWitnessConfirmations(caseId, setWitnesses),
      listenCommunityConfirmations(caseId, setCommunityConfirmations),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [caseId]);

  const caseData = cases[0] || null;
  const canManage = member?.role === "owner" || member?.role === "organizer" || member?.role === "moderator";
  const canDecide = Boolean(
    caseData &&
    summary &&
    isCaseReviewable(caseData.status) &&
    (caseData.primaryReviewerId === summary.uid || caseData.eligibleReviewerIds.includes(summary.uid))
  );

  const myDecision = useMemo(
    () => (summary ? decisions.find((d) => d.reviewerId === summary.uid) : undefined),
    [decisions, summary]
  );
  const myWitness = useMemo(
    () => (summary ? witnesses.find((w) => w.uid === summary.uid) : undefined),
    [witnesses, summary]
  );
  const myCommunityConfirmation = useMemo(
    () => (summary ? communityConfirmations.find((c) => c.uid === summary.uid) : undefined),
    [communityConfirmations, summary]
  );
  const confidence: VerificationConfidenceLevel | null = useMemo(
    () =>
      caseData
        ? computeVerificationConfidence({
            caseData,
            decisions,
            evidence,
            communityConfirmations: caseData.communityConfirmations || 0,
            witnessConfirmations: caseData.witnessConfirmations || 0,
          })
        : null,
    [caseData, decisions, evidence]
  );
  const ownerHasDecided = useMemo(
    () => Boolean(caseData?.primaryReviewerId && decisions.some((d) => d.reviewerId === caseData.primaryReviewerId)),
    [caseData, decisions]
  );
  const deadlinePassed = Boolean(
    nowMs > 0 && caseData?.ownerResponseDeadline && nowMs > caseData.ownerResponseDeadline
  );
async function handleReviewerDecision(event: FormEvent) {
    event.preventDefault();
    if (!caseData || !summary || !decision) return;
    if (decision !== "APPROVE" && !reason.trim()) {
      toast.error("Please choose a reason for this decision.");
      return;
    }
    setBusy("review");
    try {
      await submitReviewerDecision({
        caseData,
        reviewer: summary,
        decision,
        reason: reason.trim() || null,
        comments: comment.trim() || null,
      });
      toast.success("Decision recorded on the verification case.");
      setDecision("");
      setReason("");
      setComment("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record the decision.");
    } finally {
      setBusy(null);
    }
  }

  async function handleWitnessSubmit(event: FormEvent) {
    event.preventDefault();
    if (!caseData || !summary || !witnessText.trim()) return;
    setBusy("witness");
    try {
      await submitWitnessConfirmation({
        caseData,
        user: summary,
        text: witnessText,
        mediaUrl: witnessMediaUrl || undefined,
        mediaType: witnessMediaUrl ? "image" : "text",
      });
      setWitnessText("");
      setWitnessMediaUrl("");
      toast.success("Witness confirmation recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit witness confirmation.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCommunityConfirm() {
    if (!caseData || !summary) return;
    setBusy("community");
    try {
      await submitCommunityConfirmation({
        caseData,
        user: summary,
        resolved: confirmResolved,
        note: comment.trim() || undefined,
      });
      setComment("");
      toast.success("Community confirmation recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit confirmation.");
    } finally {
      setBusy(null);
    }
  }

  async function handleActivateFallback() {
    if (!caseData || !summary || !deadlinePassed || ownerHasDecided) return;
    setBusy("fallback");
    try {
      await activateFallbackVerification(caseData, summary);
      toast.success("Fallback verification activated - eligible reviewers can now decide.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to activate fallback.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReopen() {
    if (!caseData || !summary) return;
    setBusy("reopen");
    try {
      await reopenVerificationCase(caseData, summary, reopenReason.trim());
      setReopenReason("");
      toast.success("Verification case reopened.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reopen the case.");
    } finally {
      setBusy(null);
    }
  }
return (
    <section className="space-y-4">
      {!caseData ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <ShieldCheck size={28} className="mx-auto text-zinc-400" />
          <h3 className="mt-3 font-black text-zinc-950 dark:text-white">Community verification</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            A verification case is created automatically when volunteers submit completion
            evidence. The post owner reviews it together with authorized community reviewers,
            and the issue is only marked verified after the required confirmations are met.
          </p>
        </div>
      ) : (
        <CaseOverview caseData={caseData} confidence={confidence} deadlinePassed={deadlinePassed} ownerHasDecided={ownerHasDecided} activities={activities} />
      )}

      {caseData && (
        <>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">Reviewed by {caseData.reviewerQuorum || 0} eligible source{caseData.reviewerQuorum === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">{caseData.evidenceIds.length} evidence submission{caseData.evidenceIds.length === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">{communityConfirmations.length} community & {witnesses.length} witness signals</span>
          </div>

          {caseData.evidenceIds.length > 0 && evidence.length > 0 && (
            <EvidenceComparison evidence={evidence} />
          )}

          {isCaseReviewable(caseData.status) && canDecide && (
            <ReviewerDecisionPanel
              myDecision={myDecision}
              decision={decision}
              onDecision={setDecision}
              reason={reason}
              onReason={setReason}
              comment={comment}
              onComment={setComment}
              onSubmit={handleReviewerDecision}
              busy={busy === "review"}
            />
          )}

          <SupportSignalsPanel
            caseData={caseData}
            summary={summary}
            isMember={Boolean(member)}
            witnesses={witnesses}
            communityConfirmations={communityConfirmations}
            myWitness={myWitness}
            myCommunityConfirmation={myCommunityConfirmation}
            witnessText={witnessText}
            setWitnessText={setWitnessText}
            witnessMediaUrl={witnessMediaUrl}
            confirmResolved={confirmResolved}
            setConfirmResolved={setConfirmResolved}
            comment={comment}
            setComment={setComment}
            onWitnessSubmit={handleWitnessSubmit}
            onCommunityConfirm={handleCommunityConfirm}
            busy={busy}
            onPickWitnessMedia={async (file: File) => {
              try {
                const result = await uploadToCloudinary(file);
                setWitnessMediaUrl(result.secure_url);
              } catch {
                toast.error("Media upload failed.");
              }
            }}
          />

          {canManage && (
            <ManagerPanel
              caseData={caseData}
              deadlinePassed={deadlinePassed}
              ownerHasDecided={ownerHasDecided}
              onActivateFallback={handleActivateFallback}
              reopenReason={reopenReason}
              setReopenReason={setReopenReason}
              onReopen={handleReopen}
              busy={busy === "fallback" || busy === "reopen"}
            />
          )}

          <TimelinePanel events={events} decisions={decisions} />
        </>
      )}
    </section>
  );
}
function CaseOverview({ caseData, confidence, deadlinePassed, ownerHasDecided, activities }: {
  caseData: VerificationCase;
  confidence: VerificationConfidenceLevel | null;
  deadlinePassed: boolean;
  ownerHasDecided?: boolean;
  activities: VolunteerActivity[];
}) {
  const linkedActivity = activities.find((a) => a.id === caseData.activityId);
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-zinc-500" />
          <h3 className="font-black text-zinc-950 dark:text-white">Verification case</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${statusStyles[caseData.status] || "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"}`}>
          {verificationCaseStatusLabel(caseData.status)}
        </span>
      </div>

      {caseData.fallbackActivated ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>
            The owner response window expired, so the eligible reviewer quorum now decides this
            case (no single owner approval required).
          </p>
        </div>
      ) : caseData.ownerResponseDeadline ? (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          <Clock size={13} />
          {deadlinePassed
            ? "Owner response window has passed."
            : ownerHasDecided
              ? "The post owner has already responded."
              : `Waiting on the post owner's verdict until ${new Date(caseData.ownerResponseDeadline).toLocaleString([], { month: "short", day: "numeric" })}.`}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Approvals" value={`${caseData.approvalCount} / ${caseData.requiredApprovals}`} tone="ok" />
        <Metric label="Rejections" value={`${caseData.rejectionCount} / ${caseData.requiredRejections}`} tone="bad" />
        <Metric label="More evidence" value={`${caseData.moreEvidenceCount}`} tone="info" />
        <Metric label="Template" value={caseData.verificationTemplate ? pretty(caseData.verificationTemplate) : "standard"} tone="plain" />
      </div>

      {confidence && (
        <p className="mt-3 text-xs text-zinc-500">
          Verification confidence (from real case data only):{" "}
          <span className={`font-black uppercase ${confidence === "HIGH" ? "text-emerald-600 dark:text-emerald-400" : confidence === "MODERATE" ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>{confidence}</span>
        </p>
      )}

      {linkedActivity && (
        <p className="mt-2 text-xs font-semibold text-zinc-500">
          Linked action: {linkedActivity.title}
        </p>
      )}
      {caseData.disputeNote && (
        <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">{caseData.disputeNote}</p>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "ok" | "bad" | "info" | "plain" }) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-red-500 dark:text-red-400"
        : tone === "info"
          ? "text-sky-600 dark:text-sky-400"
          : "text-zinc-950 dark:text-white";
  return (
    <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
      <p className={`text-lg font-black ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
function ReviewerDecisionPanel({ myDecision, decision, onDecision, reason, onReason, comment, onComment, onSubmit, busy }: {
  myDecision?: VerificationDecision;
  decision: ReviewerDecision | "";
  onDecision: (d: ReviewerDecision | "") => void;
  reason: string;
  onReason: (v: string) => void;
  comment: string;
  onComment: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy?: boolean;
}) {
  if (myDecision) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Your review</p>
        <p className="mt-1 text-sm font-black text-zinc-950 dark:text-white">
          {reviewerDecisionLabel(myDecision.decision)}
        </p>
        {myDecision.reason && <p className="mt-0.5 text-xs text-zinc-500">{myDecision.reason}</p>}
        {myDecision.comments && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{myDecision.comments}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={16} className="text-zinc-500" />
        <p className="text-sm font-black text-zinc-950 dark:text-white">
          Your review
          <span className="font-semibold text-zinc-500"> — confirming fixed means you personally verified the issue appears resolved.</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDecision("APPROVE")}
          className={`flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition ${decision === "APPROVE" ? "bg-emerald-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>
          <CheckCircle2 size={13} /> Confirm fixed
        </button>
        <button
          type="button"
          onClick={() => onDecision("REJECT")}
          className={`flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition ${decision === "REJECT" ? "bg-red-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>
          <XCircle size={13} /> Reject
        </button>
        <button
          type="button"
          onClick={() => onDecision("MORE_EVIDENCE")}
          className={`flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition ${decision === "MORE_EVIDENCE" ? "bg-amber-500 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>
          <MessageSquare size={13} /> Request more evidence
        </button>
      </div>

      {decision && decision !== "APPROVE" && (
        <select value={reason} onChange={(e) => onReason(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
          <option value="">Choose a reason…</option>
          {(decision === "REJECT" ? REJECT_REASONS : MORE_EVIDENCE_REASONS).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}

      <textarea value={comment} onChange={(e) => onComment(e.target.value)} placeholder="Optional details for the record (visible to all members)…" className="min-h-16 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />

      <button disabled={!decision || busy} className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
        Submit review
      </button>
    </form>
  );
}
function EvidenceComparison({ evidence }: { evidence: ActivityEvidence[] }) {
  const before = evidence.find((e) => e.kind === "BEFORE" || Boolean(e.beforeMediaUrl));
  const after = evidence.find((e) => e.kind === "AFTER" || Boolean(e.afterMediaUrl) || (e.kind !== "BEFORE" && Boolean(e.mediaUrl) && e !== before));

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <Eye size={16} className="text-zinc-500" />
        <h4 className="text-sm font-black text-zinc-950 dark:text-white">
          Evidence comparison {evidence.length === 0 ? "" : `(${evidence.length} submission${evidence.length === 1 ? "" : "s"})`}
        </h4>
      </div>

      {(before || after) ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {(before?.beforeMediaUrl || before?.mediaUrl) ? (
              <img src={before?.beforeMediaUrl || before?.mediaUrl} alt="Before" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center text-[11px] font-bold uppercase text-zinc-400">Before</div>
            )}
            <p className="px-3 py-2 text-[11px] font-bold uppercase text-zinc-500">Before</p>
          </div>
          <div className="overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {(after?.afterMediaUrl || after?.mediaUrl) ? (
              <img src={after?.afterMediaUrl || after?.mediaUrl} alt="After" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center text-[11px] font-bold uppercase text-zinc-400">After</div>
            )}
            <p className="px-3 py-2 text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">After</p>
          </div>
        </div>
      ) : null}

      {evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          {evidence.map((item) => (
            <div key={item.id} className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-black text-zinc-950 dark:text-white">
                  {item.user.displayName}
                  <span className="ml-1 font-semibold text-zinc-500">{item.kind ? `• ${pretty(item.kind)}` : ""}</span>
                </p>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500 dark:bg-zinc-800">{pretty(item.status)}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{item.description}</p>
              {item.completedAt && <p className="mt-1 text-[11px] font-semibold text-zinc-500">Completed {item.completedAt}</p>}
              {item.afterMediaUrl && <img src={item.afterMediaUrl} alt="" className="mt-2 max-h-40 rounded-xl object-cover" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function SupportSignalsPanel({ caseData, summary, isMember, witnesses, communityConfirmations, myWitness, myCommunityConfirmation, witnessText, setWitnessText, witnessMediaUrl, confirmResolved, setConfirmResolved, comment, setComment, onWitnessSubmit, onCommunityConfirm, busy, onPickWitnessMedia }: {
  caseData: VerificationCase;
  summary: VolunteerUserSummary | null;
  isMember: boolean;
  witnesses: WitnessConfirmation[];
  communityConfirmations: CommunityConfirmation[];
  myWitness?: WitnessConfirmation;
  myCommunityConfirmation?: CommunityConfirmation;
  witnessText: string;
  setWitnessText: (v: string) => void;
  witnessMediaUrl: string;
  confirmResolved: boolean;
  setConfirmResolved: (v: boolean) => void;
  comment: string;
  setComment: (v: string) => void;
  onWitnessSubmit: (e: FormEvent) => void;
  onCommunityConfirm: () => void;
  busy: string | null;
  onPickWitnessMedia: (file: File) => void;
}) {
  const resolvedCount = communityConfirmations.filter((c) => c.resolved).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-zinc-500" />
            <h4 className="text-sm font-black text-zinc-950 dark:text-white">Community confirmations</h4>
          </div>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            {resolvedCount}{communityConfirmations.length > resolvedCount ? ` / ${communityConfirmations.length}` : ""}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Members who visited the location can confirm the issue looks resolved (supporting signal only).</p>

        {communityConfirmations.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {communityConfirmations.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                {c.resolved
                  ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                  : <XCircle size={13} className="shrink-0 text-red-400" />}
                <p className="min-w-0 truncate text-zinc-600 dark:text-zinc-400">
                  <span className="font-black text-zinc-950 dark:text-white">{c.user.displayName}</span>
                  {c.note ? ` — ${c.note}` : ""}
                </p>
                <span className="ml-auto shrink-0 text-[10px] font-semibold text-zinc-400">{verificationTimeText(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {isMember && summary && (
          <div className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
            {myCommunityConfirmation ? (
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                You confirmed this issue {myCommunityConfirmation.resolved ? "looks resolved" : "still looks open"}.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setConfirmResolved(true)} className={`h-8 rounded-full px-3 text-xs font-bold transition ${confirmResolved ? "bg-emerald-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>Looks resolved</button>
                  <button type="button" onClick={() => setConfirmResolved(false)} className={`h-8 rounded-full px-3 text-xs font-bold transition ${!confirmResolved ? "bg-red-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>Still open</button>
                </div>
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional note…" className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
                <button onClick={onCommunityConfirm} disabled={busy === "community"} className="mt-2 h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                  Submit confirmation
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-zinc-500" />
            <h4 className="text-sm font-black text-zinc-950 dark:text-white">Witness confirmations</h4>
          </div>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{caseData.witnessConfirmations || 0}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Volunteers who performed the work can provide first-hand witness evidence.</p>
{witnesses.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {witnesses.map((w) => (
              <div key={w.id} className="text-xs text-zinc-600 dark:text-zinc-400">
                <p><span className="font-black text-zinc-950 dark:text-white">{w.user.displayName}</span> — {w.text}</p>
                {w.mediaUrl && <img src={w.mediaUrl} alt="" className="mt-1 max-h-32 rounded-xl object-cover" />}
              </div>
            ))}
          </div>
        )}

        {isMember && summary && !myWitness && (
          <form onSubmit={onWitnessSubmit} className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
            <textarea value={witnessText} onChange={(e) => setWitnessText(e.target.value)} placeholder="What did you witness, and when?" className="min-h-16 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <div className="mt-2 flex items-center gap-2">
              {witnessMediaUrl ? (
                <img src={witnessMediaUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 dark:border-zinc-800">
                  <Camera size={14} />
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPickWitnessMedia(file);
                  }} />
                </label>
              )}
              <button disabled={!witnessText.trim() || busy === "witness"} className="h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                Add witness note
              </button>
            </div>
          </form>
        )}
        {myWitness && <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">You shared a witness confirmation.</p>}
      </div>
    </div>
  );
}
function ManagerPanel({ caseData, deadlinePassed, ownerHasDecided, onActivateFallback, reopenReason, setReopenReason, onReopen, busy }: {
  caseData: VerificationCase;
  deadlinePassed: boolean;
  ownerHasDecided: boolean;
  onActivateFallback: () => void;
  reopenReason: string;
  setReopenReason: (v: string) => void;
  onReopen: () => void;
  busy: boolean;
}) {
  const closed = caseData.status === "VERIFIED" || caseData.status === "REJECTED";
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <Zap size={15} className="text-zinc-500" />
        <h4 className="text-sm font-black text-zinc-950 dark:text-white">Manager controls</h4>
      </div>

      {!caseData.fallbackActivated && !ownerHasDecided && deadlinePassed && isCaseReviewable(caseData.status) && (
        <div className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            The owner has not responded. You can close the owner window and let the eligible
            reviewer quorum decide this case.
          </p>
          <button onClick={onActivateFallback} disabled={busy} className="mt-2 h-9 rounded-full bg-amber-500 px-4 text-xs font-bold text-white disabled:opacity-50">
            Activate fallback verification
          </button>
        </div>
      )}

      {closed && (
        <div className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
          <input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Reason for reopening…" className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
          <button onClick={onReopen} disabled={busy || !reopenReason.trim()} className="mt-2 flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-xs font-bold disabled:opacity-50 dark:border-zinc-800">
            <RotateCcw size={13} /> Reopen verification case
          </button>
        </div>
      )}
    </div>
  );
}

function TimelinePanel({ events, decisions }: { events: VerificationCaseEvent[]; decisions: VerificationDecision[] }) {
  const fallbackTimeline = events.length === 0
    ? decisions.map((d) => ({ id: d.id, eventType: d.decision as VerificationCaseEvent["eventType"], text: `${d.reviewer.displayName} ${d.decision.toLowerCase().replace("_", " ")}`, createdAt: d.createdAt }))
    : [];
  const rows = events.length > 0 ? events : fallbackTimeline;

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <Clock size={15} className="text-zinc-500" />
        <h4 className="text-sm font-black text-zinc-950 dark:text-white">Verification timeline</h4>
      </div>
      {rows.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-5 text-zinc-700 dark:text-zinc-300">{row.text}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{verificationTimeText(row.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs font-semibold text-zinc-500">No verification activity yet.</p>
      )}
    </div>
  );
}