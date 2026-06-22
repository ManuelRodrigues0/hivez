import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";

import { db } from "../../firebase/firebase";

import {
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
  doc,
} from "firebase/firestore";

export default function Create() {
  const { state } = useLocation();

  const navigate = useNavigate();

  const { user } = useAuth();

  const [caption, setCaption] = useState("");

  const [posting, setPosting] = useState(false);

  const file: File | undefined = state?.media;

  const preview = useMemo(() => {
    if (!file) return "";

    return URL.createObjectURL(file);
  }, [file]);

  if (!file) {
    navigate("/");
    return null;
  }

  const isVideo = file.type.startsWith("video");

  async function uploadToCloudinary() {
    if (!file || !user) return;

    try {
      setPosting(true);

      const formData = new FormData();

      formData.append("file", file);

      formData.append(
        "upload_preset",
        "hivez_upload"
      );

      const endpoint = isVideo
        ? "https://api.cloudinary.com/v1_1/dpotccr5q/video/upload"
        : "https://api.cloudinary.com/v1_1/dpotccr5q/image/upload";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );

      const profile = userDoc.data();

      await addDoc(collection(db, "posts"), {
        uid: user.uid,

        username: profile?.username || "",

        displayName:
          profile?.displayName ||
          user.displayName ||
          "",

        photoURL:
          profile?.photoURL ||
          user.photoURL ||
          "",

        verified:
          profile?.verified || false,

        caption,

        mediaUrl: data.secure_url,

        mediaType: isVideo
          ? "video"
          : "image",

        likes: 0,

        comments: 0,

        shares: 0,

        createdAt: serverTimestamp(),
      });

      navigate("/");
    } catch (error) {
      console.error(error);

      alert("Upload failed.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <button
          onClick={() => navigate("/")}
          className="text-zinc-400"
        >
          Cancel
        </button>

        <h1 className="text-lg font-semibold">
          New Thread
        </h1>

        <button
          onClick={uploadToCloudinary}
          disabled={posting}
          className="font-semibold text-blue-500 disabled:text-zinc-500"
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>

      <div className="p-5">
        {isVideo ? (
          <video
            src={preview}
            controls
            className="mb-5 w-full rounded-2xl"
          />
        ) : (
          <img
            src={preview}
            className="mb-5 w-full rounded-2xl"
          />
        )}

        <textarea
          placeholder="Start a thread..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="h-36 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 p-4 outline-none"
        />
      </div>
    </main>
  );
}