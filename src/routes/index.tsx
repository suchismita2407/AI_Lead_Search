import { createFileRoute, redirect } from "@tanstack/react-router";

// MVP entry is the login screen.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: () => null,
});