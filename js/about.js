const more = (person) => {
    let a = document.getElementById(person).getElementsByClassName("bio")[0];
    let button = document.getElementById(`${person}-butt`);
    if (!a.className.includes("expanded")) {
        a.className = "bio expanded";
        button.getElementsByTagName("i")[0].className = "fa-solid fa-x"
    }
    else {
        a.className = "bio";
        button.getElementsByTagName("i")[0].className = "fa-solid fa-chevron-down"
    }
}