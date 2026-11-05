const STORAGE_KEY = "mythoria-arena-history";

export function loadItems() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

export function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addItem(items, item) {
    items.push(item);

    // Keep the latest 50 history entries.
    if (items.length > 50) {
        items.shift();
    }

    return items;
}
