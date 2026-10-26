import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

export type ProfileDraft = { username: string; bio: string; photoURL: string };
export type ProfileAccount = { uid: string; displayName: string | null };

/** The existing onboarding writes and field names, separated from presentation. */
export async function saveCompletedProfile(
  account: ProfileAccount,
  draft: ProfileDraft,
) {
  const username = draft.username.trim().replace(/^@+/, "").toLowerCase();
  if (username.length < 3)
    throw new Error("Username must be at least 3 characters.");
  const taken = await getDoc(doc(db, "usernames", username));
  if (taken.exists())
    throw Object.assign(
      new Error("That username is already taken. Try another."),
      { code: "profile/username-taken" },
    );
  await setDoc(
    doc(db, "users", account.uid),
    {
      username,
      usernameLower: username,
      displayNameLower: (account.displayName || "").toLowerCase(),
      bio: draft.bio,
      photoURL: draft.photoURL || "",
      privacy: {
        account: "public",
        messages: "everyone",
        mentions: "everyone",
        comments: "everyone",
        discoverable: true,
      },
      accountPrivacy: "public",
      isPrivate: false,
      profileCompleted: true,
    },
    { merge: true },
  );
  await setDoc(doc(db, "usernames", username), { uid: account.uid });
}

/** Original Cloudinary upload destination and preset, with a checked response. */
export async function uploadOnboardingPhoto(file: File) {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", "hivez_upload");
  const response = await fetch(
    "https://api.cloudinary.com/v1_1/dpotccr5q/image/upload",
    { method: "POST", body },
  );
  const data: { secure_url?: string } = await response.json();
  if (
    !response.ok ||
    typeof data.secure_url !== "string" ||
    !data.secure_url.startsWith("https://")
  )
    throw new Error("Profile photo upload failed. Please try again.");
  return data.secure_url;
}
