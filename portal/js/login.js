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

    if (username.value.length > 24 || password.value.length > 24) {
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
            const response = await fetch('http://127.0.0.1:8787/api/auth/', {
                method: 'POST',
                body: JSON.stringify({ username: username.value, password: password.value }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(response.status);
            }

            // const data = await response.json();
            // console.log(data);

            // document.getElementById("results").textContent = data[0].username;
        }
        catch (e) {
            if (e.status === 401) {
                errorText.textContent = 'Invalid username or password.';
                attempts++;
            }
            else {
                errorText.textContent = "There is a network issue. Please try again.";
                attempts++;
                errorText.className = "error visible";
            }
        }
    }
})