import { Suspense } from "react";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="perch-shell" style={{ paddingTop: 48, color: "#6B6B6B" }}>
          Loading
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
