const format = () => {
    const section = document.getElementById("inverted");
    const first = section.children[0];
    const second = section.children[1];

    const arr = [document.querySelector(".i1"), document.querySelector(".i2"), document.querySelector(".i3"), document.querySelector(".i4"), document.querySelector(".i5"), document.querySelector(".i6")];
    let maxHeight = 0;

    for (let i of arr) {
        if (i.offsetHeight > maxHeight) {
            maxHeight = i.offsetHeight;
        }
    }

    if (window.innerWidth >= 1000) {
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

        const newWidth = document.querySelector(".carousel-container").offsetWidth / 3
        document.querySelector(".i1").style.width = `calc(${newWidth}px - 1vw)`;
        document.querySelector(".i2").style.width = `calc(${newWidth}px - 1vw)`;
        document.querySelector(".i3").style.width = `calc(${newWidth}px - 1vw)`;
        document.querySelector(".i4").style.width = `calc(${newWidth}px - 1vw)`;
        document.querySelector(".i5").style.width = `calc(${newWidth}px - 1vw)`;
        document.querySelector(".i6").style.width = `calc(${newWidth}px - 1vw)`;

        document.querySelector(".carousel-container").style.height = `calc(${maxHeight}px + 2vw)`;
        document.querySelector(".carousel").style.height = `calc(${maxHeight}px + 2vw)`;
        document.querySelector(".controls").style.height = `calc(${maxHeight}px + 2vw)`;
    }
    else {
        if (first.classList.contains("text")) {
            section.insertBefore(second, first);
        }
        document.querySelectorAll(".excess").forEach(article => {
            article.style.display = "none";
        })

        document.querySelector(".carousel-container").style.height = `calc(${maxHeight}px + 6vh)`;
        document.querySelector(".carousel").style.height = `calc(${maxHeight}px + 6vh)`;
        document.querySelector(".controls").style.height = `calc(${maxHeight}px + 6vh)`;
    }

    document.querySelector(".i1").style.height = `${maxHeight}px`;
    document.querySelector(".i2").style.height = `${maxHeight}px`;
    document.querySelector(".i3").style.height = `${maxHeight}px`;
    document.querySelector(".i4").style.height = `${maxHeight}px`;
    document.querySelector(".i5").style.height = `${maxHeight}px`;
    document.querySelector(".i6").style.height = `${maxHeight}px`;

    document.querySelector(".i2").className = `img i2 inactive-right`;
    document.querySelector(".i3").style.height = `img i2 inactive-right`;
    document.querySelector(".i4").style.height = `img i2 inactive-right`;
    document.querySelector(".i5").style.height = `img i2 inactive-right`;
    document.querySelector(".i6").style.height = `img i2 inactive-left`;
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

const next = () => {
    if (window.innerWidth >= 1000) {
        const lefted = document.querySelector(".i1");
        const moved = document.querySelector(".i2");
        const fromRight = document.querySelector(".i3");
        const appearer = document.querySelector(".i4");
        const hidden = document.querySelector(".i5");
        const gone = document.querySelector(".i6");

        lefted.className = "img inactive-left i6";
        moved.className = `img carousel-first i1`;
        fromRight.className = `img carousel-second i2`;
        appearer.className = `img carousel-third i3`;
        hidden.className = "img inactive-right i4";
        gone.className = "img inactive-right i5";
    }
    else {
        const lefted = document.querySelector(".i1");
        const moved = document.querySelector(".i2");
        const fromRight = document.querySelector(".i3");
        const appearer = document.querySelector(".i4");
        const hidden = document.querySelector(".i5");
        const gone = document.querySelector(".i6");

        lefted.className = "img inactive-left i6";
        moved.className = "img carousel-first i1";
        fromRight.className = `img inactive-right i2`;
        appearer.className = `img inactive-right i3`;
        hidden.className = "img inactive-right i4";
        gone.className = "img inactive-right i5";
    }
}

const prev = () => {
    if (window.innerWidth >= 1000) {
        const lefted = document.querySelector(".i1");
        const moved = document.querySelector(".i2");
        const fromRight = document.querySelector(".i3");
        const appearer = document.querySelector(".i4");
        const hidden = document.querySelector(".i5");
        const gone = document.querySelector(".i6");

        lefted.className = "img carousel-second i2";
        moved.className = `img carousel-third i3`;
        fromRight.className = `img inactive-right i4`;
        appearer.className = `img inactive-right i5`;
        hidden.className = "img inactive-left i6";
        gone.className = "img carousel-first i1";
    }
    else {
        const lefted = document.querySelector(".i1");
        const moved = document.querySelector(".i2");
        const fromRight = document.querySelector(".i3");
        const appearer = document.querySelector(".i4");
        const hidden = document.querySelector(".i5");
        const gone = document.querySelector(".i6");

        lefted.className = "img inactive-right i2";
        gone.className = "img carousel-first i1";
        fromRight.className = `img inactive-right i4`;
        moved.className = `img inactive-right i3`;
        hidden.className = "img inactive-left i6";
        appearer.className = "img inactive-right i5";
    }
}