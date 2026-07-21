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
};

const sec = (cl) => {
    let imgs = document.querySelectorAll(`.${cl}`);
    imgs.forEach(img => {
        if (img.classList.contains("bottom")) {
            img.classList.remove("bottom");
            img.classList.add("mid");
            img.style.transform = "translateX(1.5%) translateY(-2.5%)";
            img.style.transition = "transform 0.3s ease-in";
        }
        else if (img.classList.contains("mid")) {
            img.classList.remove("mid");
            img.classList.add("top");
            img.style.transform = "translateX(0) translateY(0)";
        }
        else if (img.classList.contains("top")) {
            img.classList.remove("top");
            img.classList.add("bottom");
            img.style.transform = "translateX(3%) translateY(-5%)";
            img.style.transition = "transform 0.3s ease-in";
        }
    });
}

window.addEventListener('load', format);
window.addEventListener('resize', format);

const images = document.getElementsByClassName("imgs");

for (let i of images) {
    i.children[3].addEventListener("mouseenter", (e) => {
        for (let j of e.target.parentElement.children) {
            if (j.classList.contains("mid")) {
                j.style.transform = "translateX(1.5%) translateY(-2.5%)";
                j.style.transition = "transform 0.3s ease-in";
            }
            else if (j.classList.contains("bottom")) {
                j.style.transform = "translateX(3%) translateY(-5%)";
                j.style.transition = "transform 0.3s ease-in";
            }
        }
    });
    i.children[3].addEventListener("mouseleave", (e) => {
        for (let j of e.target.parentElement.children) {
            if (j.classList.contains("bottom")) {
                j.style.transform = "translateX(0) translateY(0)";
                j.style.transition = "transform 0.3s ease-in";
            }
            else if (j.classList.contains("mid")) {
                j.style.transform = "translateX(0) translateY(0)";
                j.style.transition = "transform 0.3s ease-in";
            }
        }
    });
}