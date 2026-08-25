export const homeKeys = {
  all: ["home"] as const,
  data: () => [...homeKeys.all, "data"] as const,
};
