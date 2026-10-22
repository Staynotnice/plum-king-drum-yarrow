import { createFileRoute } from "@tanstack/react-router";
import { Saltwatch } from "@/components/Saltwatch";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Saltwatch />;
}
