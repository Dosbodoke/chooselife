import { MergeDeep } from "type-fest";
import { Database as DatabaseGenerated } from "./database-generated.types";
export type * from "./database-generated.types";
// export { Json } from "./database-generated.types";

export type Functions = Database["public"]["Functions"];
// Supabase does not generate types for non defaul SQL data types, this type represent a postgis POINT
// Notice that it should be called as POINT(longitude latitude)
export type Point = `POINT(${number} ${number})`;

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
      };
    };
  }
>;
