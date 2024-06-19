const inputt = document.getElementById("searchbar").addEventListener("input", () => searching());

const showSorts = () => {
    let divvy = document.getElementById("sorts");
    if (divvy.style.display === 'inline') {
        divvy.style.display = 'none';
    }
    else {
        divvy.style.display = 'inline';
    }
}

const showFilters = () => {
    let divvy = document.getElementById("filters");
    if (divvy.style.display === 'inline') {
        divvy.style.display = 'none';
    }
    else {
        divvy.style.display = 'inline';
    }
}

const searching = () => {
    let yash = document.getElementById("yash");
    let pranit = document.getElementById("pranit");
    let chen = document.getElementById("chen");
    let josh = document.getElementById("josh");
    let ray = document.getElementById("rayhaan");
    let anu = document.getElementById("anu");
    let noResults = document.getElementById("noresult");
    if (inputt.textContent) {
        switch (inputt.textContent[0].toLowerCase) {
            case "y":
                pranit.style.display = none;
                chen.style.display = none;
                josh.style.display = none;
                ray.style.display = none;
                anu.style.display = none;
                noResults.style.display = none;
                yash.style.display = inline-block;
                break;
            case "p":
                pranit.style.display = inline-block;
                chen.style.display = none;
                josh.style.display = none;
                ray.style.display = none;
                anu.style.display = none;
                yash.style.display = none;
                noResults.style.display = none;
                break;
            case "c":
                pranit.style.display = inline-block;
                chen.style.display = none;
                josh.style.display = none;
                ray.style.display = none;
                anu.style.display = none;
                yash.style.display = none;
                noResults.style.display = none;
                break;
            case "j":
                pranit.style.display = inline-block;
                chen.style.display = none;
                josh.style.display = none;
                ray.style.display = none;
                anu.style.display = none;
                yash.style.display = none;
                noResults.style.display = none;
                break;
            case "r":
                pranit.style.display = inline-block;
                chen.style.display = none;
                josh.style.display = none;
                ray.style.display = none;
                anu.style.display = none;
                yash.style.display = none;
                noResults.style.display = none;
                break;
            case "a":
                pranit.style.display = inline-block;
                chen.style.display = none;
                josh.style.display = none;
                ray.style.display = none;
                anu.style.display = none;
                yash.style.display = none;
                noResults.style.display = none;
                break;
            default:
                noResults.style.display = inline;
                pranit.style.display = none;
                chen.style.display = none;
                josh.style.display = none;
                ray.style.display = none;
                anu.style.display = none;
                yash.style.display = none;
        }
    }
}