import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID?.trim() || "your_project_id",
    dataset: process.env.SANITY_STUDIO_DATASET?.trim() || "production",
  },
});
