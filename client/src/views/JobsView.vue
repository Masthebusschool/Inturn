<template>
  <section>
    <h1 class="h3">Jobs</h1>
    <p class="text-body-secondary">Live internship and job listings from public job boards, searchable by keyword, role, and location.</p>
    <div class="alert alert-info">Coming soon.</div>

    <input v-model="search" type="search" placeholder="Search by company or role...">

    <p v-if="loading">Loading internships...</p>
    <p v-else>Error.</p>



  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"

const jobs = ref([]);
const search = ref("");
const loading = ref(true);

const searchJobs = computed(() => {
  const keyword = search.value.trim().toLowercase();

  return jobs.value.filter(job => {
    job.company.toLowercase().includes(keyword) || job.role.toLowercase().includes(keyword)
  });
})

onMounted(async () => {
  // will add api later
  const url = ""
  try {
    const response = await axios.get(url);
    console.log(response.data)
    jobs.value = response.data;
    
  } catch (error) {
      console.log('There was an error: ' + error.message)
  }

})

</script>
