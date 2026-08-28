import { MergeDeep } from "type-fest";
import type {
  Database as DatabaseGenerated,
  Enums,
} from "./database-generated.types";
export type * from "./database-generated.types";

export type Locales = Enums<"language">;
export type Functions = Database["public"]["Functions"];

// Supabase does not generate types for non-default SQL data types. This type
// represents the PostGIS POINT shape used by the existing highline tables.
export type Point = `POINT(${number} ${number})`;

type NotificationSchema = Partial<Record<Locales, string>>;

export type Database = MergeDeep<
  DatabaseGenerated,
  {
    public: {
      Tables: {
        highline: {
          Row: {
            anchor_a: Point | null;
            anchor_b: Point | null;
          };
          Insert: {
            anchor_a?: Point | null;
            anchor_b?: Point | null;
          };
          Update: {
            anchor_a?: Point | null;
            anchor_b?: Point | null;
          };
        };
        notifications: {
          Row: {
            body: NotificationSchema | null;
            title: NotificationSchema | null;
          };
          Insert: {
            body?: NotificationSchema | null;
            title?: NotificationSchema | null;
          };
          Update: {
            body?: NotificationSchema | null;
            title?: NotificationSchema | null;
          };
        };
      };
    };
  }
>;
