export function generateId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

export function formatDate() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}