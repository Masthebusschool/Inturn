import { ref } from "vue";

export const resumeSkills = ref([]);
export const matchingResumeName = ref("");

export function setMatchingResume(name, skills) {
  const cleanedSkills = [];
  const seen = [];

  if (Array.isArray(skills)) {
    for (let i = 0; i < skills.length; i++) {
      if (typeof skills[i] === "string") {
        const skill = skills[i].trim();
        const key = skill.toLowerCase();

        if (skill !== "" && !seen.includes(key)) {
          cleanedSkills.push(skill);
          seen.push(key);
        }
      }
    }
  }

  resumeSkills.value = cleanedSkills;
  matchingResumeName.value = name || "Selected resume";
}