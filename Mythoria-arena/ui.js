export function renderList(container, items) {
    if (!container) return;

    container.innerHTML = "";

    items.forEach(item => {
        const li = document.createElement("li");

        li.className =
            "border-b border-[#D4B66A]/20 pb-2";

        const time = document.createElement("span");
        time.className = "text-[#D4B66A] mr-2";
        time.textContent = `[${item.time}]`;

        const message = document.createElement("span");
        message.textContent = item.message;

        li.append(time, message);
        container.appendChild(li);
    });
}

export function clearForm(form) {
    if (form) {
        form.reset();
    }
}

