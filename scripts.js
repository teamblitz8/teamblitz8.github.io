function hamburgerify() {
    var x = document.getElementById("nav");
    if (x.className === "nav") {
        x.className += " responsive";
    }
    else {
        x.className = "nav";
    }
}