import { Link } from "react-router-dom";

const notFoundVideoSrc = "/assets/hivez-404.webm";

export default function NotFound() {
  return (
    <section className="app-not-found-page" aria-labelledby="not-found-title">
      <div className="app-not-found-composition">
        <h1 id="not-found-title" className="sr-only">
          Page not found
        </h1>
        <p className="sr-only">
          The page you requested could not be found.
        </p>

        <video
          className="app-not-found-video"
          src={notFoundVideoSrc}
          aria-label="Page not found"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />

        <Link to="/" className="app-not-found-button" aria-label="Return to Hive home">
          Return to Hive
        </Link>
      </div>
    </section>
  );
}
