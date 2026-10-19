const format = () => {
    if (window.innerWidth > 1000) {
        document.querySelectorAll(".half-section").forEach(section => {
            const text = section.querySelector(".text");
            const imgs = section.querySelector(".imgs");

            const target = imgs.offsetHeight;

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
        });
        document.querySelectorAll(".excess").forEach(article => {
            article.style.display = "inline-block";
        })
    }
    else {
        const section = document.getElementById("inverted");
        const first = section.children[0];
        const second = section.children[1];
        section.insertBefore(second, first);
    }

    for (let i of document.querySelectorAll(".season")) {
        i.style['max-height'] = `${i.querySelector(".button-container").offsetHeight}px`
    }
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

const images = document.querySelectorAll(".imgs");

for (let i of images) {
    if (i.id === "regs-23" || "regs-24" || "nats-25") continue;
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

window.addEventListener('load', format);
window.addEventListener('resize', format);

const expand = (which) => {
    if (which === "23") {
        const menu = document.querySelector(".first");
        const content = menu.querySelector(".content");
        if (content.className === "content open") {
            content.className = "content";
            menu.className = "season first"
            content.querySelector(".show").querySelector("model-viewer").className = "imgs see";
            content.querySelector(".show").className = "show see";
            content.querySelector(".stats-container").className = "stats-container see";
            content.querySelector(".stats-container").querySelector(".statistics").className = "statistics see";
            menu.querySelector(".button-container button i").className = "fa-solid fa-chevron-down";
        }
        else {
            menu.className = "season first expanded";
            content.className = "content open";
            content.querySelector(".show").querySelector("model-viewer").className = "imgs";
            content.querySelector(".show").className = "show";
            content.querySelector(".stats-container").className = "stats-container";
            content.querySelector(".stats-container").querySelector(".statistics").className = "statistics";
            menu.querySelector(".button-container button i").className = "fa-solid fa-x";
        }
    }
    else if (which === "24") {
        const menu = document.querySelector(".second");
        const content = menu.querySelector(".content");
        if (content.className === "content open") {
            content.className = "content";
            menu.className = "season second"
            content.querySelector(".show").querySelector("model-viewer").className = "imgs see";
            content.querySelector(".show").className = "show see";
            content.querySelector(".stats-container").className = "stats-container see";
            content.querySelector(".stats-container").querySelector(".statistics").className = "statistics see";
            menu.querySelector(".button-container button i").className = "fa-solid fa-chevron-down";
        }
        else {
            menu.className = "season second expanded";
            content.className = "content open";
            content.querySelector(".show").querySelector("model-viewer").className = "imgs";
            content.querySelector(".show").className = "show";
            content.querySelector(".stats-container").className = "stats-container";
            content.querySelector(".stats-container").querySelector(".statistics").className = "statistics";
            menu.querySelector(".button-container button i").className = "fa-solid fa-x";
        }
    }
    else if (which === "25") {
        const menu = document.querySelector(".third");
        const content = menu.querySelector(".content");
        if (content.className === "content open") {
            content.className = "content";
            menu.className = "season third"
            content.querySelector(".show").querySelector("model-viewer").className = "imgs see";
            content.querySelector(".show").className = "show see";
            content.querySelector(".stats-container").className = "stats-container see";
            content.querySelector(".stats-container").querySelector(".statistics").className = "statistics see";
            menu.querySelector(".button-container button i").className = "fa-solid fa-chevron-down";
        }
        else {
            menu.className = "season third expanded";
            content.className = "content open";
            content.querySelector(".show").querySelector("model-viewer").className = "imgs";
            content.querySelector(".show").className = "show";
            content.querySelector(".stats-container").className = "stats-container";
            content.querySelector(".stats-container").querySelector(".statistics").className = "statistics";
            menu.querySelector(".button-container button i").className = "fa-solid fa-x";
        }
    }
}