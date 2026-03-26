const phone = () => {
    let nav = document.getElementById("nav");

    if (nav.className === "phone") {
        nav.className = "";
    }
    else {
        nav.className = "phone";
    }
}