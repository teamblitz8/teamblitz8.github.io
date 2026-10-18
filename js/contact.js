const format = () => {
    document.querySelector("embed").style.width = `${document.querySelector("embed").offsetHeight * (0.96)}px`;
    document.querySelector("textarea").style.width = `${document.querySelector("#company").offsetWidth}px`;
    document.querySelector("#submit").style.width = `${document.querySelector("#company").offsetWidth}px`;
    document.querySelector("#first-name").style.width = `calc(${document.querySelector("#company").offsetWidth / 2}px - 1.75vh)`;
    document.querySelector("#last-name").style.width = `calc(${document.querySelector("#company").offsetWidth / 2}px - 1.75vh)`;
    document.querySelector("textarea").style["min-height"] = `${document.querySelector("#company").offsetWidth * 0.25}px`;
}

window.addEventListener('load', format);
window.addEventListener('resize', format);

const form = document.querySelector("#contact-form");

const inputValidation = (event) => {
    event.preventDefault();
    let fullyValid = true;

    const firstName = document.querySelector("#first-name");
    const lastName = document.querySelector("#last-name");
    const email = document.querySelector("#email");
    const company = document.querySelector("#company");
    const message = document.querySelector("#message");

    if (firstName.validity.valid) {
        firstName.nextElementSibling.style.display = "none";
        firstName.className = "";
    }
    else {
        error(1);
        fullyValid = false;
    }

    if (lastName.validity.valid) {
        lastName.nextElementSibling.style.display = "none";
        lastName.className = "";
    }
    else {
        error(2);
        fullyValid = false;
    }

    if (email.validity.valid) {
        email.nextElementSibling.style.display = "none";
        email.className = "";
    }
    else {
        error(3);
        fullyValid = false;
    }

    if (company.validity.valid) {
        company.nextElementSibling.style.display = "none";
        company.className = "";
    }
    else {
        error(4);
        fullyValid = false;
    }

    if (message.validity.valid) {
        message.nextElementSibling.style.display = "none";
        message.className = "";
    }
    else {
        error(5);
        fullyValid = false;
    }
};

form.addEventListener("submit", inputValidation);

const error = (field) => {
    let type = 0;
    switch (field) {
        case 1:
            type = document.querySelector("#first-name");
            break;
        case 2:
            type = document.querySelector("#last-name");
            break;
        case 3:
            type = document.querySelector("#email");
            break;
        case 4:
            type = document.querySelector("#company");
            break;
        case 5:
            type = document.querySelector("#message");
            break;
        default:
            type = false;
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