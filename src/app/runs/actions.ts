"use server";

import { revalidatePath } from "next/cache";
import {
  approveRun,
  editPreview,
  postponeRun,
  resetAndSeedDemoRuns,
  resumeRun,
  skipRun,
} from "@/runs/memoryStore";

export async function actionSeedRuns() {
  await resetAndSeedDemoRuns();
  revalidatePath("/runs");
}

export async function actionApprove(id: string) {
  try {
    await approveRun(id);
    revalidatePath("/runs");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approve failed";
    if (/Invalid login|BadCredentials|535/i.test(message)) {
      return {
        ok: false as const,
        error:
          "Gmail rejected the password. Generate a real App Password in your Google account (not the xxxx placeholder). 2-Step Verification must be on.",
      };
    }
    return { ok: false as const, error: message };
  }
}

export async function actionSkip(id: string) {
  await skipRun(id);
  revalidatePath("/runs");
}

export async function actionPostpone(id: string, minutes = 60) {
  await postponeRun(id, minutes);
  revalidatePath("/runs");
}

export async function actionResume(id: string) {
  resumeRun(id);
  revalidatePath("/runs");
}

export async function actionEditPreview(id: string, subject: string, body: string) {
  editPreview(id, { subject, body });
  revalidatePath("/runs");
}
