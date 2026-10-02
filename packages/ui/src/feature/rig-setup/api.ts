import type { TypedSupabaseClient } from "../../supabase-provider";

export type RigStatuses = "rigged" | "planned" | "unrigged";

const rigSetupSelectStatement = `
    *,
    rig_setup_webbing (
      *,
      webbing_id (
        *,
        model ( * )
      )
    )
`;

export async function fetchRigSetups(
  supabase: TypedSupabaseClient,
  highlineID: string,
) {
  const { data, error } = await supabase
    .from("rig_setup")
    .select(rigSetupSelectStatement)
    .eq("highline_id", highlineID)
    .order("rig_date", { ascending: false });

  if (error) throw error;
  return data;
}

export type Setup = Awaited<ReturnType<typeof fetchRigSetups>>;

export async function fetchRigSetupById(
  supabase: TypedSupabaseClient,
  rigSetupID: string,
): Promise<Setup[number] | null> {
  const { data, error } = await supabase
    .from("rig_setup")
    .select(rigSetupSelectStatement)
    .eq("id", +rigSetupID)
    .single();

  // Handle specific error from .single() when no row is found
  if (error) {
    if (error.code === "PGRST116") {
      // "JSON object requested, multiple (or no) rows returned"
      console.warn(
        `No single rig setup found for ID ${rigSetupID}. Returning null.`,
        error.message,
      );
      return null;
    }
    throw error;
  }
  return data;
}

/**
 * Where a setup sits on the timeline: still up, taken down, or only planned.
 */
export function getRigSetupStatus(
  setup: Pick<Setup[number], "is_rigged" | "unrigged_at">,
): RigStatuses {
  if (setup.is_rigged) return "rigged";
  if (setup.unrigged_at) return "unrigged";
  return "planned";
}
