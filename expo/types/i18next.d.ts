import { resources } from "~/app/_layout";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: typeof resources["en"];
  }
}