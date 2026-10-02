import { useQueryState } from "nuqs";

export function useLoginModal() {
  const [loginModal, setLoginModal] = useQueryState("loginModal");
  const open = loginModal === "open";

  function toggleLoginModal(status: "open" | "closed") {
    return setLoginModal(status);
  }

  return { open, toggleLoginModal };
}
