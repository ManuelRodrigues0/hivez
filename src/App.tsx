import { Toaster } from "sonner";

import AppRouter from "./router/AppRouter";

export default function App() {
  return (
    <>
      <AppRouter />
      <Toaster richColors closeButton position="top-right" duration={Infinity} />
    </>
  );
}
