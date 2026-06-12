import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { LoadingBlock } from "../../components/Feedback";
import { useAuth } from "./AuthContext";

export function LogoutPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    let cancelled = false;
    signOut().finally(() => {
      if (!cancelled) {
        navigate("/login", { replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, signOut]);

  return <LoadingBlock label="Signing out" />;
}
