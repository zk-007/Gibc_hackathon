"use server";

import { revalidatePath } from "next/cache";
import { bumpSweep } from "@/session/activeBrief";

export async function actionResimulate() {
  bumpSweep();
  revalidatePath("/simulate");
}
