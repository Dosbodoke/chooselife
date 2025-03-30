// Use type safe message keys with `next-intl`
// Refer to the documentation on https://next-intl-docs.vercel.app/docs/typescript
type Messages = typeof import("./messages/en.json");
declare interface IntlMessages extends Messages {}
