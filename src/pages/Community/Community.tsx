import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  PawPrint,
  Trash2,
  Droplet,
  Route,
  Lightbulb,
  Car,
  TreePine,
  Zap,
  HeartHandshake,
  UserSearch,
} from "lucide-react";
import PageIntro from "@/components/layout/PageIntro";

import Feed from "@/components/feed/Feed";
import { COMMUNITIES } from "@/constants/communities";

export default function Community() {
  const { id } = useParams();
  const navigate = useNavigate();

  const community = useMemo(() => COMMUNITIES.find((c) => c.id === id), [id]);

  if (!community) {
    return (
      <div className="app-empty-state">
        <div className="app-surface max-w-sm p-8">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Hive Not Found
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            This community is not available yet.
          </p>
          <button
            onClick={() => navigate("/")}
            className="app-primary-button mt-6"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  const icons = {
    "lost-pets": PawPrint,
    waste: Trash2,
    "water-leakage": Droplet,
    roads: Route,
    "street-lights": Lightbulb,
    "illegal-parking": Car,
    "fallen-trees": TreePine,
    "electric-hazards": Zap,
    "blood-requests": HeartHandshake,
    "missing-persons": UserSearch,
  };
  const Icon = icons[community.id as keyof typeof icons] || Users;
  return (
    <div className="hv-route hv-hive-page app-page app-community-page">
      <PageIntro
        eyebrow="A SHARED CONCERN. A PLACE TO CONNECT."
        title={community.name}
        description={community.description}
        action={
          <button className="hv-button-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Back
          </button>
        }
      />
      <div className="hv-hive-about">
        <span className="hv-hive-symbol">
          <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <h2>The conversation starts here.</h2>
          <p>Local reports, useful updates, and neighbours who care.</p>
        </div>
      </div>
      <Feed category={community.id} />
    </div>
  );
}
