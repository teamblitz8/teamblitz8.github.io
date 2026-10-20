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

        for (let i of document.querySelectorAll(".season")) {
            i.style['max-height'] = `${i.querySelector(".button-container").offsetHeight}px`;
        }
    }
    else {
        const section = document.getElementById("inverted");
        const first = section.children[0];
        const second = section.children[1];
        section.insertBefore(second, first);

        for (let i of document.querySelectorAll(".season")) {
            i.insertBefore(i.querySelector(".button-container"), i.querySelector(".content"));
        }
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

for (const image of document.querySelectorAll(".imgs")) {
    if (["regs-23", "regs-24", "nats-25"].includes(image.id)) {
        continue;
    }

    const trigger = image.children[3];
    if (!trigger) {
        continue;
    }

    trigger.addEventListener("mouseenter", (e) => {
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
    trigger.addEventListener("mouseleave", (e) => {
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

const expand = (which) => {
    const selector = { "23": ".first", "24": ".second", "25": ".third" }[which];
    const menu = selector ? document.querySelector(selector) : null;

    if (!menu) {
        return;
    }

    const content = menu.querySelector(".content");
    const expanded = content.classList.toggle("open");

    menu.classList.toggle("expanded", expanded);
    content.querySelectorAll(".show, .stats-container, .statistics, model-viewer")
        .forEach(element => element.classList.toggle("see", !expanded));

    menu.querySelector(".button-container i").className = expanded
        ? "fa-solid fa-x"
        : "fa-solid fa-chevron-down";
}