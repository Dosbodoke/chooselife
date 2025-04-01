import { MergeDeep } from "type-fest";
import type {
  Database as DatabaseGenerated,
  Enums,
} from "./database-generated.types";
export type * from "./database-generated.types";

export type Locales = Enums<"language">;
export type Functions = Database["public"]["Functions"];
// Supabase does not generate types for non defaul SQL data types, this type represent a postgis POINT
// Notice that it should be called as POINT(longitude latitude)
export type Point = `POINT(${number} ${number})`;

type NotificationSchema = Record<Locales, string>;

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
