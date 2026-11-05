import { ref } from "vue";
import { api } from "../lib/api.js";

export const resumeSkills = ref([]);
export const matchingResumeName = ref("");

export const matchingResumeLoading = ref(false);
export const matchingResumeError = ref("");

let restoreRequest = null;
let revision = 0;

export function setMatchingResume(name, skills) {
  revision += 1;

  const uniqueSkills = new Map();

  for (const skill of Array.isArray(skills) ? skills : []) {
    if (typeof skill !== "string") continue;

    const cleaned = skill.trim();

    if (cleaned) {
      uniqueSkills.set(cleaned.toLowerCase(), cleaned);
    }
  }

  resumeSkills.value = [...uniqueSkills.values()];
  matchingResumeName.value = name || "";
}

export function clearMatchingResume() {
  setMatchingResume("", []);
  matchingResumeError.value = "";
}

function getResumeSkills(resume) {
  return [
    ...(resume.skills || []),

    ...(resume.experience || []).flatMap(
      (experience) => experience.skills || []
    ),

    ...(resume.projects || []).flatMap(
      (project) => project.skills || []
    ),
  ];
}

export function setMatchingFromResume(resume) {
  setMatchingResume(resume.name, getResumeSkills(resume));
}

export async function restoreMatchingResume() {
  // Avoid starting the same request twice.
  if (restoreRequest) return restoreRequest;

  const startingRevision = revision;

  matchingResumeLoading.value = true;
  matchingResumeError.value = "";

  restoreRequest = (async () => {
    try {
      const { resume } = await api("/api/resumes/primary");

      // Do not overwrite skills updated in the editor while loading.
      if (revision !== startingRevision) return;

      if (!resume) {
        clearMatchingResume();
        return;
      }

      setMatchingResume(
        resume.name || "Profile resume",
        getResumeSkills(resume)
      );
    } catch (error) {
      if (revision === startingRevision) {
        matchingResumeError.value =
          error.message || "Could not restore resume skills.";
      }
    } finally {
      matchingResumeLoading.value = false;
    }
  })();

  try {
    await restoreRequest;
  } finally {
    restoreRequest = null;
  }
}