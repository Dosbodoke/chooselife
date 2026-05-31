import "@tanstack/react-query";

export interface ChooselifeQueryMeta extends Record<string, unknown> {
  authScope?: string;
  persistOffline?: boolean;
}

export interface ChooselifeMutationMeta extends Record<string, unknown> {
  persistOfflineMutation?: boolean;
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: ChooselifeQueryMeta;
    mutationMeta: ChooselifeMutationMeta;
  }
}
