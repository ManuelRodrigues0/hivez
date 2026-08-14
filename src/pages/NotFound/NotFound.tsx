import { ArrowRight, Home } from "lucide-react";
import { Link } from "react-router-dom";

const notFoundVideoSrc = "/assets/hivez-404.webm";

export default function NotFound() {
  return (
    <section className="app-not-found-page" aria-labelledby="not-found-title">
      <div className="app-not-found-composition">
        <video
          className="app-not-found-video"
          src={notFoundVideoSrc}
          aria-label="Page not found"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
        />

        <div className="app-not-found-copy">
          <h1 id="not-found-title">Page not found</h1>
          <p>The hive you were looking for is not here anymore.</p>
        </div>

        <Link to="/" className="app-not-found-button" aria-label="Return to Hive home">
          <Home size={18} aria-hidden="true" />
          <span>Return to Hive</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
