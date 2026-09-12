"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";

import {
  initialSignOutActionState,
  type SignOutAction,
} from "@/app/(app)/_lib/sign-out-state";
import { Button } from "@/components/ui/button";

type SignOutFormProps = {
  action: SignOutAction;
  presentation?: "default" | "navigation" | "icon";
};

export function SignOutForm({
  action,
  presentation = "default",
}: SignOutFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialSignOutActionState,
  );
  const iconOnly = presentation === "icon";
  const navigation = presentation === "navigation";

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-2 ${iconOnly ? "items-end" : "items-start"}`}
    >
      <Button
        type="submit"
        variant={iconOnly || navigation ? "ghost" : "default"}
        size={iconOnly ? "icon" : "default"}
        className={navigation ? "w-full justify-start" : undefined}
        aria-label={iconOnly ? "Sign out" : undefined}
        disabled={pending}
      >
        <LogOut
          data-icon={iconOnly ? undefined : "inline-start"}
          aria-hidden="true"
        />
        {iconOnly ? null : pending ? "Signing out…" : "Sign out"}
      </Button>
      {state.error ? (
        <p
          role="alert"
          className="max-w-64 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
