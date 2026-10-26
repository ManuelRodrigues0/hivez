import { useNavigate } from "react-router-dom";
import { ComposerHeader, CreateChoices, DispatchFooter } from "./ComposerParts";

export default function CreateEntry() {
  const navigate = useNavigate();
  return <main className="hv-dispatch dispatch-entry">
    <ComposerHeader label="THE NEIGHBOURHOOD STARTS WITH YOU" onBack={() => navigate("/")} />
    <div className="dispatch-entry-body">
      <div className="dispatch-entry-intro"><p className="dispatch-eyebrow"><span /> A LITTLE LOCAL. A LOT POSSIBLE.</p><h1>Good things<br />start <em>with you.</em></h1><p>What you notice. What you know. What you care about.<br />There’s a place for it here.</p></div>
      <CreateChoices onReport={() => navigate("/create", { replace: true, state: { reportMode: true } })} onText={() => navigate("/create", { replace: true, state: { textMode: true, text: "" } })} />
    </div>
    <DispatchFooter>Your voice belongs here.</DispatchFooter>
  </main>;
}
