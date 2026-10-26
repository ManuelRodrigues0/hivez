import { useAuth } from "@/context/AuthContext";
import {
  saveCompletedProfile,
  uploadOnboardingPhoto,
} from "@/services/completeProfile";
import CompleteProfileExperience from "./CompleteProfileExperience";

export default function CompleteProfile() {
  const { user, refreshProfileStatus } = useAuth();
  return (
    <CompleteProfileExperience
      displayName={user?.displayName || ""}
      onUpload={uploadOnboardingPhoto}
      onComplete={async (draft) => {
        if (!user)
          throw new Error("Please sign in before completing your profile.");
        await saveCompletedProfile(user, draft);
        await refreshProfileStatus();
      }}
    />
  );
}
