import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState, useCallback } from "react";

import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { COMMUNITIES } from "../../constants/communities";

import {
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
  doc,
  increment,
  updateDoc,
} from "firebase/firestore";
import type { PostMediaItem } from "@/components/feed/MediaGrid";
import { Volume2, VolumeX } from "lucide-react";
import { createIssueCommunityForPost, getUserSummary } from "@/services/volunteering";

export default function Create() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isTextMode = state?.textMode;
  const media: File | File[] | undefined = state?.media;
  const textContent: string | undefined = state?.text;

  const [caption, setCaption] = useState(textContent || "");
  const [posting, setPosting] = useState(false);
  const [category, setCategory] = useState(COMMUNITIES[0].id);
  const [location, setLocation] = useState("");
  const [mutedVideos, setMutedVideos] = useState<Set<number>>(new Set());

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

  const isTextOnly = isTextMode || (!media && textContent);
  
  // Hide category/location for text-only posts
  const showOptions = !isTextOnly;
  const isMultiple = Array.isArray(media);
  const singleFile = !isMultiple ? media : undefined;
  const filesToPreview = isMultiple ? media : singleFile ? [singleFile] : [];
  const previewItems: PostMediaItem[] = filesToPreview.map((file, index) => ({
    url: URL.createObjectURL(file),
    type: file.type.startsWith("video") ? "video" : "image",
    muted: mutedVideos.has(index),
  }));

  const isVideo = useMemo(() => {
    if (isTextOnly) return false;
    if (isMultiple) {
      return media[0].type.startsWith("video");
    }
    return singleFile!.type.startsWith("video");
  }, [media, isMultiple, singleFile, isTextOnly]);

  if (!isTextMode && !media && !textContent) {
    navigate("/");
    return null;
  }

  const extractHashtags = useCallback((text: string): string[] => {
    const matches = text.match(/#[\w]+/g);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
  }, []);

  async function uploadToCloudinary() {
    if (!user) return;

    try {
      setPosting(true);

      // For text-only posts, skip upload
      if (isTextOnly) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const profile = userDoc.data();
        const hashtags = extractHashtags(caption);

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
          mediaUrl: "",
          mediaType: "text",
          likes: 0,
          comments: 0,
          shares: 0,
          createdAt: serverTimestamp(),
        });

        await createIssueCommunityForPost({
          postId: postRef.id,
          ownerId: user.uid,
          owner: await getUserSummary(user.uid),
          caption,
          category,
          location: location.trim() || null,
          mediaUrl: "",
          mediaType: "text",
        });

        // Increment user's post count
        await updateDoc(doc(db, "users", user.uid), {
          posts: increment(1),
        });

        navigate("/");
        return;
      }

      // Upload media
      const filesToUpload = isMultiple ? media : (singleFile ? [singleFile] : []);
      const uploadPromises = filesToUpload.map(async (file) => {
        if (!file) return null;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "hivez_upload");

        const endpoint = file.type.startsWith("video")
          ? "https://api.cloudinary.com/v1_1/dpotccr5q/video/upload"
          : "https://api.cloudinary.com/v1_1/dpotccr5q/image/upload";

        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        return response.json();
      }).filter(Boolean);

      const uploadResults = await Promise.all(uploadPromises);
      const mediaItems: PostMediaItem[] = uploadResults.map((result, index) => ({
        url: result.secure_url,
        type: filesToUpload[index].type.startsWith("video") ? "video" : "image",
        muted: mutedVideos.has(index),
      }));
      const mediaUrls = mediaItems.map((item) => item.url);

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const profile = userDoc.data();
      const hashtags = extractHashtags(caption);

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
        mediaUrl: mediaUrls[0],
        mediaUrls,
        mediaItems,
        mediaType: mediaItems[0]?.type || (isVideo ? "video" : "image"),
        likes: 0,
        comments: 0,
        shares: 0,
        createdAt: serverTimestamp(),
      });

      await createIssueCommunityForPost({
        postId: postRef.id,
        ownerId: user.uid,
        owner: await getUserSummary(user.uid),
        caption,
        category,
        location: location.trim() || null,
        mediaUrl: mediaUrls[0],
        mediaType: mediaItems[0]?.type || (isVideo ? "video" : "image"),
      });

      // Increment user's post count
      await updateDoc(doc(db, "users", user.uid), {
        posts: increment(1),
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
    <main className="app-create-page min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Cancel
        </button>

        <h1 className="text-base font-semibold text-zinc-900 dark:text-white">New Post</h1>

        <button
          onClick={uploadToCloudinary}
          disabled={posting}
          className="rounded-full bg-black px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {posting ? "Posting..." : "Share"}
        </button>
      </div>

      <div className={`mx-auto w-full ${isTextOnly ? 'max-w-3xl lg:p-8 p-4' : 'max-w-4xl lg:p-6 p-4'}`}>
        {/* Post Details */}
        <div className={`border-b border-zinc-200 dark:border-zinc-800 ${isTextOnly ? 'p-8' : 'p-4'}`}>
          {/* User Info */}
          <div className="mb-4 flex items-center gap-3">
            <img
              src={user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{user?.displayName || "Hivez User"}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">@{user?.email?.split("@")[0] || "user"}</p>
            </div>
          </div>

          {/* Caption Input */}
          <textarea
            placeholder="What's on your mind?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={isTextOnly ? 12 : 4}
            className={`w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-600 ${isTextOnly ? 'text-base' : ''}`}
          />

          {previewItems.length > 0 && (
            <div className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {previewItems.map((item, index) => (
                  <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
                    {item.type === "video" ? (
                      <>
                        <video
                          src={item.url}
                          className="h-full w-full object-cover"
                          muted={item.muted}
                          controls
                        />
                        <button
                          onClick={() => toggleMute(index)}
                          className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/90"
                        >
                          {item.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                      </>
                    ) : (
                      <img src={item.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags Preview */}
          {extractHashtags(caption).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {extractHashtags(caption).map((tag, idx) => (
                <span key={idx} className="text-xs text-sky-500">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Category Selector */}
          {showOptions && (
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Add to Hive
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMUNITIES.map((community) => (
                  <button
                    key={community.id}
                    onClick={() => setCategory(community.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 md:px-4 py-2 text-sm transition whitespace-nowrap ${
                      category === community.id
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
                    }`}
                  >
                    <span>{community.icon}</span>
                    <span className="hidden md:inline">{community.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location Input */}
          {showOptions && (
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Add Location
              </label>
              <input
                type="text"
                placeholder="Add location..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full md:max-w-md rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-600"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
