const phone = () => {
    let nav = document.getElementById("nav");

    if (nav.className === "phone") {
        nav.className = "";
    }
    else {
        nav.className = "phone";
    }
}

const format = () => {
    document.querySelectorAll(".half-section").forEach(section => {
        const text = section.querySelector(".text");
        const imgs = section.querySelector(".imgs");

        const target = imgs.offsetHeight;

        if (text.id === "awards") {
            document.getElementById("awards").style.height = `${target - document.getElementById("awards").parentElement.children[0].offsetHeight}px`;
        }

        let low = 100;
        let high = window.innerWidth;
        let best = high;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);

            text.style.width = `${mid}px`;

            if (text.offsetHeight > target) {
                low = mid + 1;
            }
            else {
                best = mid;
                high = mid - 1;
            }
        }

        text.style.width = `${best}px`;
        document.getElementById("awards").style.width = `${document.getElementById("img-4").offsetWidth}px`;
    });

    document.getElementsByClassName("p-container")[0].style.height = `${document.getElementsByClassName("countdown")[0].style.height - document.getElementsByClassName("timer-container")[0].offsetHeight}px`
};

const sec1 = () => {
    let imgs = document.querySelectorAll(".sec-1");
    imgs.forEach(img => {
        if (img.classList.contains("bottom")) {
            img.classList.remove("bottom");
            img.classList.add("mid");
        }
        else if (img.classList.contains("mid")) {
            img.classList.remove("mid");
            img.classList.add("top");
        }
        else if (img.classList.contains("top")) {
            img.classList.remove("top");
            img.classList.add("bottom");
        }
    });
}

const sec2 = () => {
    console.log("Running");
    let imgs = document.querySelectorAll(".sec-2");
    imgs.forEach(img => {
        if (img.classList.contains("bottom")) {
            img.classList.remove("bottom");
            img.classList.add("mid");
        }
        else if (img.classList.contains("mid")) {
            img.classList.remove("mid");
            img.classList.add("top");
        }
        else if (img.classList.contains("top")) {
            img.classList.remove("top");
            img.classList.add("bottom");
        }
    });
}

window.addEventListener('load', format);
window.addEventListener('resize', format);