"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createRepositorySchema, type CreateRepositoryInput } from "@/lib/schemas";

const field = "mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/70";

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? <p id={id} className="mt-1 text-xs text-bad">{msg}</p> : null;
}

export function AddRepositoryForm() {
  const router = useRouter();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateRepositoryInput>({
    resolver: zodResolver(createRepositorySchema),
    defaultValues: { fullName: "", defaultBranch: "main", ownerEmail: "" },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = localStorage.getItem("secureship_mail_id");
      const branch = localStorage.getItem("secureship_github_branch");
      if (email || branch) {
        reset({
          fullName: "",
          defaultBranch: branch || "main",
          ownerEmail: email || "",
        });
      }
    }
  }, [reset]);

  async function onSubmit(values: CreateRepositoryInput) {
    setResult(null);
    try {
      const res = await fetch("/api/repositories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setResult({ ok: false, message: body.error ?? "Could not add the repository." });
      setResult({ ok: true, message: `Added ${body.fullName}.` });
      reset();
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="fullName" className="text-sm font-medium">Repository</label>
        <input id="fullName" placeholder="your-org/your-repo" aria-invalid={!!errors.fullName} aria-describedby="fullName-err" className={field} {...register("fullName")} />
        <Err id="fullName-err" msg={errors.fullName?.message} />
      </div>
      <div>
        <label htmlFor="defaultBranch" className="text-sm font-medium">Protected branch</label>
        <input id="defaultBranch" aria-invalid={!!errors.defaultBranch} aria-describedby="branch-err" className={field} {...register("defaultBranch")} />
        <Err id="branch-err" msg={errors.defaultBranch?.message} />
      </div>
      <div>
        <label htmlFor="ownerEmail" className="text-sm font-medium">Owner email for alerts</label>
        <input id="ownerEmail" type="email" placeholder="you@example.com" aria-invalid={!!errors.ownerEmail} aria-describedby="email-err" className={field} {...register("ownerEmail")} />
        <Err id="email-err" msg={errors.ownerEmail?.message} />
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={isSubmitting} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60">
          {isSubmitting ? "Adding…" : "Add repository"}
        </button>
        <p role="status" className={`text-sm ${result?.ok ? "text-ok" : "text-bad"}`}>{result?.message}</p>
      </div>
    </form>
  );
}
