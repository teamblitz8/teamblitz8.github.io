window.onload = (e) => {
    let images = document.getElementsByClassName("img");
    for (let i of images) {
        let posOrNeg = "";
        if (Math.random() > 0.5) {
            posOrNeg = "-"
        }
        const para = `rotate(${posOrNeg}${Math.floor(Math.random() * 10)}deg)`
        i.style.transform = para;
        i.parentElement.style.transform = para;
    }
}

const phone = () => {
    let nav = document.getElementById("nav");

    if (nav.className === "phone") {
        nav.className = "";
    }
    else {
        nav.className = "phone";
    }
}

const flick = (c) => {
    let list = document.getElementsByClassName(c);
    for (let i of list) {
        if (i.className.includes("top")) {
            i.className = `bottom ${c} img`;
        }
        else if (i.className.includes("middle")) {
            i.className = `top ${c} img`
        }
        else if (i.className.includes("bottom")) {
            i.className = `middle ${c} img`
        }
    }
}