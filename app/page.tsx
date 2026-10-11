import { redirect } from "next/navigation";

// This page only redirects, so there is no UI for the dev-time instant-navigation check to validate.
export const instant = false;

export default function Home() {
  redirect("/dashboard");
}
