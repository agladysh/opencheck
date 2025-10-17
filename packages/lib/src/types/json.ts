// Borrowed from arktype.io @ark/util (MIT)
export type JsonStructure = JsonObject | JsonArray;
export interface JsonObject {
  [k: string]: Json;
}
export type JsonArray = Json[];
export type JsonPrimitive = string | boolean | number | null;
export type Json = JsonStructure | JsonPrimitive;
