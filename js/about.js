const more = (person) => {
    const bio = document.getElementById(person).querySelector(".bio");
    const icon = document.getElementById(`${person}-butt`).querySelector("i");
    const expanded = bio.classList.toggle("expanded");

    icon.className = expanded
        ? "fa-solid fa-x"
        : "fa-solid fa-chevron-down";
}