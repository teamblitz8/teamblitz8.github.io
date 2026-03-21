const phone = () => {
    let nav = document.getElementById("nav");
    let links = document.getElementsByClassName("text-link");

    if (nav.className === "phone") {
        nav.className = "";
        for (let i of links) {
            i.style.display = "none";
        }
    }
    else {
        nav.className = "phone";
        for (let i of links) {
            i.style.display = "inline-block";
        }
    }
}