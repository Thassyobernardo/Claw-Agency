/**
 * /signup — permanent redirect to /onboarding
 * Kept so existing marketing links don't 404.
 */
import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/onboarding");
}
