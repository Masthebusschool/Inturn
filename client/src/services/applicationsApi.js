// service api class calls the backend apis for frontend
import axios from 'axios';

// one axios instance for all trackboard calls
// withCredentials: sends the login session cookie with every request
const api = axios.create({
    baseURL: '/api/applications',
    withCredentials: true,
});

// axios throws on any error status (4xx / 5xx) by itself, so no res.ok check needed
// res.data = the JSON the backend sent back

// Get all user's applications
export async function getApplications() {
    const res = await api.get('');
    return res.data;
}

// Create application by manual
export async function addApplication(details) {
    const res = await api.post('', details);
    return res.data;
}

// Update status move card to another column
export async function updateStatus(id, status) {
    const res = await api.patch(`/${id}`, { status: status });
    return res.data;
}

// Update Interview Date let user set interview date if moved card
export async function updateInterviewDate(id, interviewAt) {
    const res = await api.patch(`/${id}/interview`, { interviewAt: interviewAt });
    return res.data;
}

// Update Favourite star or unstar a card
export async function updateFavourite(id, isFavourite) {
    const res = await api.patch(`/${id}/favourite`, { isFavourite: isFavourite });
    return res.data;
}

// Checklist add a task to the card
export async function addTask(id, text) {
    const res = await api.post(`/${id}/tasks`, { text: text });
    return res.data;
}

// Checklist tick / untick a task
export async function updateTask(id, taskId, done) {
    const res = await api.patch(`/${id}/tasks/${taskId}`, { done: done });
    return res.data;
}

// Checklist remove a task
export async function deleteTask(id, taskId) {
    const res = await api.delete(`/${id}/tasks/${taskId}`);
    return res.data;
}

// Delete Application
export async function deleteApplication(id) {
    const res = await api.delete(`/${id}`);
    return res.data;
}