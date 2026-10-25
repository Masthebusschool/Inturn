// service api class calls the backend apis for frontend
const baseUrl = '/api/applications';

async function request(url, options={}) {
    const res = await fetch(url, {
        credentials: 'include',
        headers: {'Content-Type': 'application/json' },
        ...options, // provide copy of all options stated
    });

    if(!res.ok) throw new Error(`Request failed! (${res.status})`);
    if(res.status === 204) return null;
    return res.json();
}

// Get all user's applications
export function getApplications() {
    return request(baseUrl);
}

// Create application by manual
export function addApplication(details) {
  return request(BASE, { method: 'POST', body: JSON.stringify(details)})
}

// Update status: move card to another column
export function updateStatus(id, status) {
    return request(`${baseUrl}/${id}`, { method: 'PATCH', body: JSON.stringify({ status: status })});
}

// Update Interview Date: let user set interview date if moved card
export function updateInterviewDate(id, interviewAt) {
    return request(`${baseUrl}/${id}/interview`, { method: 'PATCH', body: JSON.stringify({ interviewAt: interviewAt })});
}

// Delete Application
export function deleteApplication(id) {
    return request(`${baseUrl}/${id}`, { method: 'DELETE' });
}