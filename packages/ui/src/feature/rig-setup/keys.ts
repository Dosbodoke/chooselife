export const rigSetupKeyFactory = {
  all: ({ highlineID }: { highlineID: string }) =>
    ["highline", highlineID, "rigSetup"] as const,
  single: ({
    highlineID,
    rigSetupID,
  }: {
    highlineID: string;
    rigSetupID: string;
  }) => ["highline", highlineID, "rigSetup", rigSetupID] as const,
  riggers: (profileIDs: string[]) =>
    ["rigSetup", "riggers", [...profileIDs].sort()] as const,
};
