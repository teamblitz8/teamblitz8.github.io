const phone = () => {
    let nav = document.getElementById("nav");
    let links = document.getElementsByClassName("text-link");

    if (nav.className === "phone") {
        nav.className = "";
    }
    else {
        nav.className = "phone";
    }
}