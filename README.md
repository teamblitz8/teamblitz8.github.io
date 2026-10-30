# Blitz STEM Racing Website
This is a website and full-stack app wholly developed by Chen dedicated to Blitz, a STEM Racing Professional Class team, providing both public information about the team and internal functions to improve team work efficiency.

## Main site
This is the main part of the site you will see when visiting the domain. This portion of the site is mainly targeted twoard attracting potential sponsors and introducing the team and what the STEM Racing program is. Pages include:

- A homepage, summarising what STEM Racing is and who we are as a collective team.
    - Small chunks of text are paired next to stacks of images which can be clicked through.
    - Chips which show the awards we have won, which change to reveal the competition they were won at when hovered on.
    - An embed showing an interactive 3D model of our National Finals car, run by Google's Model Viewer script.
    - A small carousel which can be clicked through to read parts of our journey.
    - A timer counting down the days to the Regional Finals.
    - An Instagram embed widget powered by Behold which displays our most recent Instagram posts.
- An about us page, introducing each team member and listing areas why we are valuable to have as a partner.
    - Each team member's name, role and image is shown, and their individual card can be expanded to reveal a description of their work.
    - Reasons why we are valuable as a partner are individually shown on cards below.
    - On mobile, all member cards take up the whole horizontal width rather than being side by side.
- Exploration of our journey
    - A responsive timeline using ::before pseudo-elements.
    - Each point in our journey is marked by a circle SVG and a corresponding description of it.
    - This resizes on mobile to take up more horizontal space and align all cards on one side of the screen.
- An our work page
    - Includes a file finder where we have organised competition materials into their relevant seasons
    - Car files include a 3D model preview, some basic statistics and a download link.
    - These are the only materials we have released thus far, we may release more in the future.
- A sponsorship prospectus for prospectus sponsors on the Contact Us page, which is embedded as a PDF on the page.

All pages have a consistent layout with a responsive navigation menu that transforms into a hamburger menu on mobile devices, a large image acting as a banner and a footer on the bottom with our social media links. Upon clicking the hamburger menu the menu expands to reveal each link.

The site should adapt to different viewport sizes. Images may load slowly on mobile devices as some banner images can be quite large.

### What doesn't work yet?

- Contact form on Contact Us page.
- There's some unused pages dedicated to a blog. Not sure if this will happen though. Maybe if I have hours to kill on a week in Terra.

![alt text](https://github.com/teamblitz8/teamblitz8.github.io/blob/development-subdomain/imgs/misc/website-homepage.png?raw=true)

> How was this developed?

It is just a static HTML/CSS/JS site with no backend.

## Portal
This part of the site involved a lot of learning for me. It is designed to allow team members to log in and see the work of other members (specifically allowing them to download car design 3D model files), to allow them to build on others' work and make it better. It also makes it easier to share files especially when people are away from home and see performance of each others' designs. Key features include:
- A fully secure login system
    - Passwords are hashed using PBKDF2-HMAC-SHA512. Their hash and salts are stored in the database and checked with a hashed version of the user's input.
    - There is protection against timing attacks by running hash calculations to delay time if say the username was incorrect.
    - Date and time of logins are recorded in the database.
    - There is some rate limiting based off IP addresses. This should be fine as I am planning to manage accounts on the Wrangler CLI since there should only be 5 accounts, all of them used by people I know.
- Authentication using session tokens
    - Session tokens are also hashed with the same algorithm using a pepper, passed to the client as a cookie
    - Expired session tokens are deleted off the database daily with a Cloudflare Cron Trigger which fires every night at midnight.
- Loading the latest car designs, related statistics, files and other information that may help someone improve on it
    - To make things easier this is split into multiple requests; one for metadata and one for each file.
    - This allows me to send files as binary blobs and generally make things easier instead of needing to convert between Base64.

### What doesn't work yet?

A lot!

- Upload button and form is UI only
- Load more button doesn't fetch anything
- My Account is UI only
- My Designs is an empty page but will be used to load designs made by your account
- Remember me checkbox

![alt text](https://github.com/teamblitz8/teamblitz8.github.io/blob/development-subdomain/imgs/misc/portal-dashboard.png?raw=true)

> How was this developed?

The backend and API endpoints are handled on the Cloudflare Workers network. I used the native Cloudflare D1 database solution since it was pretty well supported by Cloudflare and relatively easy to get started with. It's an SQLite-based database. For file storage I used Cloudflare's R2 object storage solution which also pairs very well with Workers.

As you can tell, I love cloudflare

## Usage
Go to https://teamblitz.pages.dev to see the latest version of the site in action.

The portal can be accessed at https://teamblitz.pages.dev/portal.

The portal is strictly for internal team use only. If you would like to see a demo of the portal, see the ship on Terra for sample login details

## To-do
- Complete upload button logic
- Complete the contact form on the main site
- Transfer the site from being hosted on GitHub Pages to Cloudflare on custom domain.
- Create the UI for the account and My Designs page
- My Designs should be somewhat similar to the dashboard.
- Complete the load more button.
- My Account should include an area to change password and log out of all sessions.
- Add a filter, sort by bar on the dashboard
- Fix up the spaghetti code on the backend
- Prompt first-time users to change password upon login.
- Reduce CPU time of the worker
- Add rate-limiting across all API endpoints on the backend
- Add remember me functionality
- Improve how errors are handled on both ends

## Enquiries
If you have any sponsorship enquiries for my team, please contact us at business@teamblitz.uk.

This is my first ever full-stack app, so it's not going to be the best. Pretty fun to make tho