import AuthExperience from "@/components/hivez/AuthExperience";
import CompleteProfile from "@/pages/CompleteProfile/CompleteProfile";

function Signup() {
  return <AuthExperience mode="signup" />;
}

export { Signup as SignupPage, CompleteProfile as CompleteProfilePage };
export default Signup;
