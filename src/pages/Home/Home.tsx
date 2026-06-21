import TopBar from "../../components/layout/TopBar";
import BottomNav from "../../components/layout/BottomNav";
import Feed from "../../components/feed/Feed";

export default function Home() {
  return (
    <>
      <TopBar />

      <main className="bg-black text-white">
        <Feed />
      </main>

      <BottomNav />
    </>
  );
}