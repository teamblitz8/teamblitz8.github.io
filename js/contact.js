const format = () => {
    const embed = document.querySelector("embed");
    const company = document.querySelector("#company");
    const textarea = document.querySelector("textarea");

    if (embed && window.innerWidth >= 1000) {
        embed.style.width = `${embed.offsetHeight * 0.96}px`;
    }
    else if (embed) {
        embed.style.width = "100%";
    }

    if (!company || !textarea) {
        return;
    }

    if (window.innerWidth >= 1000) {
        const companyWidth = company.offsetWidth;
        textarea.style.width = `${companyWidth}px`;
        document.querySelector("#submit").style.width = `${companyWidth}px`;
        document.querySelector("#first-name").style.width = `calc(${companyWidth / 2}px - 1.75vh)`;
        document.querySelector("#last-name").style.width = `calc(${companyWidth / 2}px - 1.75vh)`;
        textarea.style.minHeight = `${companyWidth * 0.25}px`;
    }
    else {
        document.querySelector("#email").removeAttribute("size");
        company.removeAttribute("size");
        textarea.style.minHeight = `${company.offsetWidth * 0.5}px`;
    }
}

window.addEventListener('load', format);
window.addEventListener('resize', format);

const form = document.querySelector("#contact-form");

const inputValidation = (event) => {
    event.preventDefault();
    ["first-name", "last-name", "email", "company", "message"].forEach((id, index) => {
        const field = document.querySelector(`#${id}`);

        if (field.validity.valid) {
            field.nextElementSibling.style.display = "none";
            field.className = "";
        }
        else {
            error(index + 1);
        }
    });
};

if (form) {
    form.addEventListener("submit", inputValidation);
}

const error = (field) => {
    const ids = ["first-name", "last-name", "email", "company", "message"];
    const type = document.querySelector(`#${ids[field - 1]}`);

    if (!type) {
        return;
    }

    if (type.validity.valueMissing) {
        type.nextElementSibling.textContent = "This is required.";
    }
    else if (type.validity.typeMismatch) {
        type.nextElementSibling.textContent = "Please enter a valid email address.";
    }
    else if (type.validity.tooShort) {
        type.nextElementSibling.textContent = `This should be at least ${type.minLength} characters long.`;
    }
    else if (type.validity.tooLong) {
        type.nextElementSibling.textContent = `This should be less than ${type.maxLength} characters long.`;
    }


    type.nextElementSibling.className = "error active";
    type.className = "invalid";
    document.querySelector("#overall").textContent = "Please inspect and correct any errors below.";
    return false;
};