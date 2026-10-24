const form = document.querySelector('form');
const errorText = document.querySelector('.error');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const rememberMe = document.querySelector('#forever');
let attempts = 0;

form.addEventListener('submit', async (e) => {
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

    if (username.value.length > 24 || password.value.length > 50) {
        errorText.textContent = 'Invalid username or password.';
        attempts++;
        errorPresent = true;
    }

    if (errorPresent) {
        errorText.className = 'error visible';
        return;
    }
    else {
        errorText.className = 'error';
        try {
            const response = await fetch('https://back.teamblitz.workers.dev/api/auth/', {
                method: 'POST',
                body: JSON.stringify({ username: username.value, password: password.value }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(response.status);
            }
            
            errorText.textContent = 'Logging in..';
            errorText.className = 'error visible success'
        }
        catch (e) {
            console.error(e);
            if (e === 401) {
                errorText.textContent = 'Invalid username or password.';
                attempts++;
                errorText.className = 'error visible'
            }
            else if (e === 403) {
                errorText.textContent = 'Your account has been disabled. Please contact the administrator.';
                attempts++;
                errorText.className = 'error visible'
            }
            else if (e === 500) {
                errorText.textContent = '500 Internal Server Error: Please contact the administrator.';
                attempts++;
                errorText.className = 'error visible'
            }
            else {
                errorText.textContent = 'There is a network issue. Please try again.';
                attempts++;
                errorText.className = 'error visible';
            }
        }
    }
})