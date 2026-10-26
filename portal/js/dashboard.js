document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/dashboard/', {
            method: 'GET',
            credentials: 'include'
        });
        let data;
        try {
            data = await response.json();
        }
        catch {
            throw new Error();
        }

        if (response.ok) {
            const greeting = document.querySelector('#greeting');
            greeting.textContent = `Hello, ${data.username}`;
        }
        else {
            if (!data) {
                throw new Error();
            }
            else if (typeof data !== 'object') {
                throw new Error();
            }
            else if (!Object.hasOwn(data, 'message')) {
                throw new Error();
            }
            
            if (data.message === 'Unauthorised') {
                window.location.replace('https://teamblitz.pages.dev/portal/login');
            }
        }
    }
    catch (error) {
        console.error(error);
    }
});

const logout = async () => {
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/logout/', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            window.location.replace('https://teamblitz.uk');
        }
        else {
            throw new Error();
        }
    }
    catch (error) {
        console.error(error);
    }
}