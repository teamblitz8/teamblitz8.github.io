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
    const section = document.getElementById("inverted");
    const first = section.children[0];
    const second = section.children[1];
    if (window.innerWidth > 1000) {
        if (!first.classList.contains("text")) {
            section.insertBefore(second, first);
        }
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
        document.querySelectorAll(".excess").forEach(article => {
            article.style.display = "inline-block";
        })
    }
    else {
        if (first.classList.contains("text")) {
            section.insertBefore(second, first);
        }
        document.querySelectorAll(".excess").forEach(article => {
            article.style.display = "none";
        })
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

window.addEventListener('load', format);
window.addEventListener('resize', format);

const images = document.querySelectorAll(".imgs");

for (let i of images) {
    if (i.id === "car-model") continue;
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

const countdown = document.querySelectorAll(".timer-container")[0];
const countdownDate = new Date("Jan 21, 2027 09:00:00").getTime();

setInterval(() => {
    const now = new Date().getTime();
    const distance = countdownDate - now;

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdown.children[0].children[0].innerText = days;
    countdown.children[1].children[0].innerText = hours;
    countdown.children[2].children[0].innerText = minutes;
    countdown.children[3].children[0].innerText = seconds;
}, 1000);