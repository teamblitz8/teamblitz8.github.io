function hamburgerify() {
    var x = document.getElementById("toppy");
    if (x.className === "topnav") {
      x.className += " responsive";
    } else {
      x.className = "topnav";
    }
  }