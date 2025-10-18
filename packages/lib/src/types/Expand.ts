// Expands composite type definitions to a readable form.
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
