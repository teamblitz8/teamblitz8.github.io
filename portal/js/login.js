const form = document.querySelector('form');
const errorText = document.querySelector('.error');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const rememberMe = document.querySelector('#forever');
let attempts = 0;

form.addEventListener('submit', (e) => {
    let errorPresent = false;
    e.preventDefault();
    if (attempts > 5) {
        errorText.textContent = 'You have been blocked from making further attempts. Please contact the administrator.';
        errorPresent = true;
    }

    if (!username.value || !password.value) {
        errorText.textContent = 'You must provide both a username and password.';
        attempts++;
        errorPresent = true;
    }

    if (errorPresent) {
        errorText.className = 'error visible';
        return;
    }
    else {
        errorText.className = 'error';
    }
})